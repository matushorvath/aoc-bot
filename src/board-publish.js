'use strict';

const { formatBoard } = require('./board-format');
const { sendTelegram } = require('./network');
const { mapDaysToChats } = require('./invites');

const { DynamoDB } = require('@aws-sdk/client-dynamodb');
const crypto = require('crypto');

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const publishOneBoard = async (day, chat, message, oldHash, leaderboard, startTimes) => {
    console.log(`publishOneBoard: start ${leaderboard.event} ${day}`);

    const created = [];
    const updated = [];

    const year = Number(leaderboard.event);
    const board = formatBoard(year, day, leaderboard, startTimes);

    // Telegram does not allow us to update messages with exactly the same text,
    // so we store a hash of the text and only update when it changes
    const newHash = crypto.createHash('sha256').update(board).digest('base64');
    console.log(`publishOneBoard: new hash ${newHash}`);

    if (message === undefined) {
        // Create an empty record as a form of mutex
        const saved = await lockBoardMessage(chat);

        // If we weren't able to create the empty record, the board is already being created by someone else
        if (saved) {
            // Send new message and pin it
            message = await sendTelegram('sendMessage', {
                chat_id: chat,
                parse_mode: 'MarkdownV2',
                text: board,
                disable_notification: true,
                disable_web_page_preview: true
            });

            await sendTelegram('pinChatMessage', {
                chat_id: chat,
                message_id: message.result.message_id,
                disable_notification: true
            });

            // Store message id for future updates
            await saveBoardMessage(chat, message.result.message_id, newHash);
            created.push({ year, day });

            console.log('publishOneBoard: message created');
        }
    } else if (newHash !== oldHash) {
        // Update text hash in database
        const saved = await saveBoardMessage(chat, message, newHash);

        // If we weren't able to update the record, the board is already being updated by someone else
        if (saved) {
            // Update existing message
            await sendTelegram('editMessageText', {
                chat_id: chat,
                message_id: message,
                parse_mode: 'MarkdownV2',
                text: board,
                disable_web_page_preview: true
            });

            updated.push({ year, day });

            console.log('publishOneBoard: message updated');
        }
    } else {
        // Existing message is the same as new message
        console.log('publishOneBoard: same text hash, message not updated');
    }

    console.log(`publishOneBoard: done ${leaderboard.event} ${day}`);
    return { created, updated };
};

const mapChatsToMessages = async (chatData) => {
    console.log('mapChatsToMessages: start');

    const map = {};

    const WINDOW = 100;
    for (let i = 0; i < chatData.length; i += WINDOW) {
        const keys = chatData
            .slice(i, i + WINDOW)
            .map(({ chat }) => ({ id: { S: `board:${chat}` } }));

        const params = {
            RequestItems: {
                [DB_TABLE]: {
                    Keys: keys,
                    ProjectionExpression: 'chat, message, sha256'
                }
            }
        };
        const data = await db.batchGetItem(params);

        for (const item of data.Responses[DB_TABLE]) {
            if (item.message !== undefined && item.sha256 !== undefined) {
                map[Number(item.chat.N)] = { message: Number(item.message.N), sha256: item.sha256.S };
            }
        }
    }

    console.log('mapChatsToMessages: done');
    return map;
};

const lockBoardMessage = async (chat) => {
    console.log(`lockBoardMessage: start ${chat}`);

    const params = {
        TableName: DB_TABLE,
        Item: {
            id: { S: `board:${chat}` },
            chat: { N: String(chat) }
        },
        ConditionExpression: 'attribute_not_exists(id)'
    };

    try {
        await db.putItem(params);
    } catch (e) {
        if (e.name === 'ConditionalCheckFailedException') {
            console.log('lockBoardMessage: board already saved');
            return false;
        }
        throw e;
    }

    console.log('lockBoardMessage: done');
    return true;
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
        },
        ConditionExpression: 'attribute_not_exists(sha256) OR sha256 <> :sha256',
        ExpressionAttributeValues: {
            ':sha256': { S: hash }
        }
    };

    try {
        await db.putItem(params);
    } catch (e) {
        if (e.name === 'ConditionalCheckFailedException') {
            console.log('saveBoardMessage: board already saved');
            return false;
        }
        throw e;
    }

    console.log('saveBoardMessage: done');
    return true;
};

const publishBoards = async (leaderboard, startTimes) => {
    console.log('publishBoards: start');

    const year = Number(leaderboard.event);
    const days = Object.values(leaderboard.members).flatMap(member =>
        Object.keys(member.completion_day_level).map(Number));

    const uniqueDays = [...new Set(days)];
    const dayChatMap = await mapDaysToChats(year, uniqueDays);

    const chatData = uniqueDays
        .map(day => ({ day, chat: dayChatMap[day] }))
        .filter(({ chat }) => chat !== undefined);

    const chatMessageMap = await mapChatsToMessages(chatData);
    const messageData = chatData.map(item => ({ ...item, ...chatMessageMap[item.chat] }));

    const results = await Promise.allSettled(messageData
        .map(async ({ day, chat, message, sha256 }) =>
            await publishOneBoard(day, chat, message, sha256, leaderboard, startTimes))
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
