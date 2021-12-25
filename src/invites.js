'use strict';

const { sendTelegram } = require('./network');
const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const getCompletedDays = (leaderboard) => {
    // Get list of completed problems from the leaderboard
    return Object.values(leaderboard.members).flatMap(member =>
        Object.entries(member.completion_day_level)
            // Take days with both parts completed
            .filter(([day, parts]) => (parts['1'] && parts['2']) || (day === '25' && parts['1']))
            // Make a [name, day] pair for each
            .map(([day, ]) => ({ aocUser: member.name, day: Number(day) }))
    );
};

const getChats = async (year, days) => {
    // Add telegram information into the list of [AoC user, day] pairs
    const uniqueAocUsers = [...new Set(days.map(({ aocUser }) => aocUser))];
    const userMap = await mapUsers(uniqueAocUsers);

    const uniqueDays = [...new Set(days.map(({ day }) => day))];
    const dayMap = await mapDaysToChats(year, uniqueDays);

    return days
        .map(({ aocUser, day }) => ({ aocUser, year, day, telegramUser: userMap[aocUser], chat: dayMap[day] }))
        .filter(({ telegramUser, chat }) => telegramUser !== undefined && chat !== undefined);
};

const mapUsers = async (aocUsers) => {
    console.log('mapUsers: start');

    const map = {};

    const WINDOW = 100;
    for (let i = 0; i < aocUsers.length; i += WINDOW) {
        const keys = aocUsers
            .slice(i, i + WINDOW)
            .map(aocUser => ({ id: { S: `aoc_user:${aocUser}` } }));

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
            .map(day => ({ id: { S: `chat:${year}:${day}` } }));

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
    console.log('filterSentInvites: start');

    // Filter out users who already got an invite
    const sentInvites = new Set();

    const WINDOW = 100;
    for (let i = 0; i < chats.length; i += WINDOW) {
        const keys = chats
            .slice(i, i + WINDOW)
            .map(({ telegramUser, chat, year, day }) =>
                ({ id: { S: `invite:${telegramUser}:${year}:${day}:${chat}` } }));

        if (keys.length > 0) {
            const params = {
                RequestItems: {
                    [DB_TABLE]: {
                        Keys: keys,
                        ProjectionExpression: 'id'
                    }
                }
            };
            const data = await db.batchGetItem(params);

            for (const item of data.Responses[DB_TABLE]) {
                sentInvites.add(item.id.S);
            }
        }
    }

    const output = chats.filter(({ telegramUser, chat, year, day }) =>
        !sentInvites.has(`invite:${telegramUser}:${year}:${day}:${chat}`));

    console.log('filterSentInvites: done');
    return output;
};

const filterUsersInChat = async (chats) => {
    console.log('filterUsersInChat: start');

    // Filter out users who are already in the chat
    const needsAdding = await Promise.all(chats.map(async ({ telegramUser, chat }) => {
        try {
            const member = await sendTelegram('getChatMember', { chat_id: chat, user_id: telegramUser });
            return member.ok && member.result.status === 'left';
        } catch (error) {
            if (error.isAxiosError && error.response?.data?.error_code === 400) {
                console.warn(`filterUsersInChat: user not found ${telegramUser}`);
                return false;
            }
            throw error;
        }
    }));

    const output = chats.filter((_, index) => needsAdding[index]);

    console.log('filterUsersInChat: done');
    return output;
};

const markAsSent = async (telegramUser, year, day, chat) => {
    const params = {
        Item: {
            id: { S: `invite:${telegramUser}:${year}:${day}:${chat}` },
            y: { N: String(year) },
            d: { N: String(day) },
            chat: { N: String(chat) }
        },
        TableName: DB_TABLE
    };
    await db.putItem(params);

    console.log(`markAsSent: marked as sent ${telegramUser} ${chat} ${year} ${day}`);
};

const sendInvites = async (changes) => {
    const sent = [];
    const failed = [];

    for (const change of changes) {
        const { telegramUser, aocUser, chat, year, day } = change;

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
                if (error.isAxiosError && error.response?.data?.error_code === 400) {
                    // This often means we are not allowed to contact the user
                    console.log(`sendInvites: send FAILED aocUser ${aocUser} telegramUser ${telegramUser} year ${year} day ${day}`);
                    continue;
                }

                throw error;
            }

            await markAsSent(telegramUser, year, day, chat);
        }

        (success ? sent : failed).push(change);
    }

    return { sent, failed };
};

const processInvites = async (leaderboard) => {
    // Parse the leaderboard
    const year = Number(leaderboard.event);
    const days = getCompletedDays(leaderboard);

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
