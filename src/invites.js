'use strict';

const { sendTelegram } = require('./network');
const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const getCompletedDays = (selection, leaderboard) => {
    // Get list of completed problems from the leaderboard
    return Object.values(leaderboard.members).flatMap(member =>
        Object.entries(member.completion_day_level)
            // Take days with both parts completed
            .filter(([day, parts]) => (parts['1'] && parts['2']) || (day === '25' && parts['1']))
            // Choose only days that match the selection
            .filter(([day]) => selection.day === undefined || selection.day === Number(day))
            // Make a [name, day] pair for each
            .map(([day]) => ({ aocUser: member.name, day: Number(day) }))
    );
};

const getChats = async (year, days) => {
    console.log(`getChats: start, year ${year} days ${JSON.stringify(days)}`);

    // Add telegram information into the list of [AoC user, day] pairs
    const uniqueAocUsers = [...new Set(days.map(({ aocUser }) => aocUser))];
    const userMap = await mapUsers(uniqueAocUsers);

    const uniqueDays = [...new Set(days.map(({ day }) => day))];
    const dayMap = await mapDaysToChats(year, uniqueDays);

    const chats = days
        .map(({ aocUser, day }) => ({ aocUser, year, day, telegramUser: userMap[aocUser], chat: dayMap[day] }))
        .filter(({ telegramUser, chat }) => telegramUser !== undefined && chat !== undefined);

    console.log(`getChats: done, chats ${chats.length}`);

    return chats;
};

const mapUsers = async (aocUsers) => {
    console.log('mapUsers: start');

    const map = {};

    const WINDOW = 100;
    for (let i = 0; i < aocUsers.length; i += WINDOW) {
        const keys = aocUsers
            .slice(i, i + WINDOW)
            .map(aocUser => ({
                id: { S: 'aoc_user' },
                sk: { S: aocUser }
            }));

        const params = {
            RequestItems: {
                [DB_TABLE]: {
                    Keys: keys,
                    ProjectionExpression: 'aoc_user, telegram_user'
                }
            }
        };
        const data = await db.batchGetItem(params);

        for (const item of data.Responses[DB_TABLE]) {
            map[item.aoc_user.S] = Number(item.telegram_user.N);
        }
    }

    console.log('mapUsers: done');

    return map;
};

const mapDaysToChats = async (year, days) => {
    console.log(`mapDaysToChats: start ${year} ${days}`);

    const map = {};

    const WINDOW = 100;
    for (let i = 0; i < days.length; i += WINDOW) {
        const keys = days
            .slice(i, i + WINDOW)
            .map(day => ({
                id: { S: 'chat' },
                sk: { S: `${year}:${day}` }
            }));

        const params = {
            RequestItems: {
                [DB_TABLE]: {
                    Keys: keys,
                    ProjectionExpression: 'd, chat'
                }
            }
        };
        const data = await db.batchGetItem(params);

        for (const item of data.Responses[DB_TABLE]) {
            map[Number(item.d.N)] = Number(item.chat.N);
        }
    }

    console.log(`mapDaysToChats: done ${year} ${Object.keys(map)}`);

    return map;
};

const filterSentInvites = async (chats) => {
    console.log(`filterSentInvites: start, chats ${chats.length}`);

    // Filter out users who already got an invite
    const sentInvites = new Set();

    const WINDOW = 100;
    for (let i = 0; i < chats.length; i += WINDOW) {
        const keys = chats
            .slice(i, i + WINDOW)
            .map(({ telegramUser, chat, year, day }) => ({
                id: { S: 'invite' },
                sk: { S: `${telegramUser}:${year}:${day}:${chat}` }
            }));

        const params = {
            RequestItems: {
                [DB_TABLE]: {
                    Keys: keys,
                    ProjectionExpression: 'sk'
                }
            }
        };
        const data = await db.batchGetItem(params);

        for (const item of data.Responses[DB_TABLE]) {
            sentInvites.add(item.sk.S);
        }
    }

    const output = chats.filter(({ telegramUser, chat, year, day }) =>
        !sentInvites.has(`${telegramUser}:${year}:${day}:${chat}`));

    const outputForLog = output.map(({ aocUser, year, day }) => `${aocUser} ${year}/${day}`).join(', ');
    console.log(`filterSentInvites: done, chats ${output.length} ${outputForLog}`);

    return output;
};

const filterUsersInChat = async (chats) => {
    console.log(`filterUsersInChat: start, chats ${chats.length}`);

    // Filter out users who are already in the chat
    const needsAdding = await Promise.all(chats.map(async ({ aocUser, telegramUser, chat }) => {
        try {
            const member = await sendTelegram('getChatMember', { chat_id: chat, user_id: telegramUser });
            console.debug(`filterUsersInChat: ${aocUser} member ${JSON.stringify(member)}`);
            return member.ok && member.result.status === 'left';
        } catch (error) {
            if (error.isTelegramError && error.telegram_error_code >= 400 && error.telegram_error_code < 500) {
                console.warn(`filterUsersInChat: user not found ${aocUser} (${telegramUser})`);
                return false;
            }
            throw error;
        }
    }));

    const output = chats.filter((_, index) => needsAdding[index]);

    const outputForLog = output.map(({ aocUser, year, day }) => `${aocUser} ${year}/${day}`).join(', ');
    console.log(`filterUsersInChat: done, chats ${output.length} ${outputForLog}`);

    return output;
};

const markAsSent = async (telegramUser, year, day, chat) => {
    const params = {
        Item: {
            id: { S: 'invite' },
            sk: { S: `${telegramUser}:${year}:${day}:${chat}` },
            y: { N: String(year) },
            d: { N: String(day) },
            chat: { N: String(chat) }
        },
        TableName: DB_TABLE,
        ConditionExpression: 'attribute_not_exists(id)'
    };

    try {
        await db.putItem(params);
    } catch (e) {
        if (e.name === 'ConditionalCheckFailedException') {
            console.log(`markAsSent: already marked as sent ${telegramUser} ${chat} ${year} ${day}`);
            return false;
        }
        throw e;
    }

    console.log(`markAsSent: marked as sent ${telegramUser} ${chat} ${year} ${day}`);
    return true;
};

const sendInvites = async (changes) => {
    const sent = [];
    const failed = [];

    for (const change of changes) {
        const { telegramUser, aocUser, chat, year, day } = change;

        const marked = await markAsSent(telegramUser, year, day, chat);
        if (!marked) {
            // Someone already sent this invite, probably a race condition
            continue;
        }

        const invite = await sendTelegram('createChatInviteLink', {
            chat_id: chat,
            name: `AoC ${year} Day ${day}`,
            member_limit: 1,
            creates_join_request: false
        });

        let success = false;

        if (invite.ok) {
            try {
                await sendTelegram('sendMessage', {
                    chat_id: telegramUser,
                    parse_mode: 'MarkdownV2',
                    text: `You are invited to the [${invite.result.name}](${invite.result.invite_link}) chat room`
                });

                success = true;
                console.log(`sendInvites: sent to aocUser ${aocUser} telegramUser ${telegramUser} year ${year} day ${day}`);
            } catch (error) {
                if (error.isTelegramError && error.telegram_error_code >= 400 && error.telegram_error_code < 500) {
                    // This often means we are not allowed to contact the user
                    console.log(`sendInvites: send FAILED aocUser ${aocUser} telegramUser ${telegramUser} year ${year} day ${day} code ${error.telegram_error_code}`);
                    continue;
                }

                throw error;
            }
        }

        (success ? sent : failed).push(change);
        // If this failed, it will never be sent again, since it's already marked in the database
    }

    return { sent, failed };
};

const processInvites = async (leaderboard, selection = {}) => {
    // Parse the leaderboard, select which dates we process
    const year = Number(leaderboard.event);
    if (selection.year !== undefined && selection.year !== year) {
        return { sent: [], failed: [] };
    }

    let days = getCompletedDays(selection, leaderboard);
    if (days.length === 0) {
        return { sent: [], failed: [] };
    }

    // Get list of chats each user should be in
    const chats = await getChats(year, days);
    const changes = await filterSentInvites(chats);
    const invites = await filterUsersInChat(changes);

    // Create invites for all missing cases
    const { sent, failed } = await sendInvites(invites);

    console.debug(`processInvites: sent invites: ${JSON.stringify(sent)}`);
    console.debug(`processInvites: failed invites: ${JSON.stringify(failed)}`);

    return { sent, failed };
};

exports.mapDaysToChats = mapDaysToChats;
exports.processInvites = processInvites;
