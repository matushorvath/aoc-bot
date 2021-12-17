'use strict';

const { formatBoard } = require('./board-format');
const { sendTelegram } = require('./network');
const { mapDaysToChats } = require('./invites');

const { DynamoDB } = require('@aws-sdk/client-dynamodb');
const crypto = require('crypto');

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const publishOneBoard = async (day, chat, leaderboard, startTimes) => {
    console.log(`publishOneBoard: start ${day}`);

    const created = [];
    const updated = [];

    const year = Number(leaderboard.event);
    const board = formatBoard(year, day, leaderboard, startTimes);

    // Telegram does not allow us to update messages with exactly the same text,
    // so we store a hash of the text and only update when it changes
    const text = `\`\`\`\n${board}\n\`\`\``;
    const textHash = crypto.createHash('sha256').update(text).digest('base64');
    console.log(`publishOneBoard: new hash ${textHash}`);

    const [messageId, oldTextHash] = await findBoardMessage(chat);
    if (messageId) {
        if (textHash !== oldTextHash) {
            // Update existing message
            await sendTelegram('editMessageText', {
                chat_id: chat,
                message_id: messageId,
                parse_mode: 'MarkdownV2',
                text
            });

            // Update text hash in database
            await saveBoardMessage(chat, messageId, textHash);
            updated.push({ year, day });

            console.log('publishOneBoard: message updated');
        } else {
            console.log('publishOneBoard: same text hash, message not updated');
        }
    } else {
        // Send new message
        const message = await sendTelegram('sendMessage', {
            chat_id: chat,
            parse_mode: 'MarkdownV2',
            text,
            disable_notification: true
        });

        await sendTelegram('pinChatMessage', {
            chat_id: chat,
            message_id: message.result.message_id,
            disable_notification: true
        });

        // Store message id for future updates
        await saveBoardMessage(chat, message.result.message_id, textHash);
        created.push({ year, day });

        console.log('publishOneBoard: message created');
    }

    console.log(`publishOneBoard: done ${day}`);
    return { created, updated };
};

const findBoardMessage = async (chat) => {
    console.log(`findBoardMessage: start ${chat}`);

    const params = {
        TableName: DB_TABLE,
        Key: { id: { S: `board:${chat}` } },
        ProjectionExpression: 'message, sha256'
    };

    const data = await db.getItem(params);
    if (!data.Item) {
        console.log('findBoardMessage: no board message found');
        return [];
    }

    const message = Number(data.Item.message.N);
    const hash = data.Item.sha256.S;

    console.log(`findBoardMessage: found board message ${message} ${hash}`);

    return [message, hash];
};

const saveBoardMessage = async (chat, message, hash) => {
    console.log(`saveBoardMessage: start ${chat} ${message}`);

    const params = {
        TableName: DB_TABLE,
        Item: {
            id: { S: `board:${chat}` },
            chat: { N: String(chat) },
            message: { N: String(message) },
            sha256: { S: hash }
        }
    };
    await db.putItem(params);

    console.log('saveBoardMessage: done');
};

const publishBoards = async (leaderboard, startTimes) => {
    console.log('publishBoards: start');

    const year = Number(leaderboard.event);
    const days = Object.values(leaderboard.members).flatMap(member =>
        Object.keys(member.completion_day_level).map(Number));

    const uniqueDays = [...new Set(days)];
    const dayMap = await mapDaysToChats(year, uniqueDays);

    const results = await Promise.allSettled(uniqueDays
        .map(day => ({ day, chat: dayMap[day] }))
        .filter(({ chat }) => chat !== undefined)
        .map(async ({ day, chat }) => await publishOneBoard(day, chat, leaderboard, startTimes))
    );

    const created = [];
    const updated = [];

    for (const result of results) {
        if (result.status === 'rejected') {
            console.log('publishBoards: error', result.reason);
        } else {
            created.push(...result.value.created);
            updated.push(...result.value.updated);
        }
    }

    console.log('publishBoards: done');
    return { created, updated };
};

exports.publishBoards = publishBoards;
