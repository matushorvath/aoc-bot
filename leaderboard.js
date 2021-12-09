'use strict';

const { getAdventOfCodeSecret } = require('./secrets');
const { telegramSend } = require('./telegram-send');

const axios = require('axios');
const { DynamoDB } = require("@aws-sdk/client-dynamodb");

// TODO process leaderboards from multiple years
const YEAR = 2021;
const LEADERBOARD_ID = 380635;

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const getLeaderboard = async () => {
    console.log(`getLeaderboard: Going to download leaderboard`);

    const secret = await getAdventOfCodeSecret();

    const url = `https://adventofcode.com/${YEAR}/leaderboard/private/view/${LEADERBOARD_ID}.json`;
    const options = { headers: { Cookie: `session=${secret}` } };
    const response = await axios.get(url, options);

    console.log(`getLeaderboard: Finished downloading`);

    return response.data;
};

const getCompletedDays = (leaderboard) => {
    // Get list of completed problems from the leaderboard
    return Object.values(leaderboard.members).flatMap(member =>
        Object.entries(member.completion_day_level)
            // Take days with both parts completed
            .filter(([, parts]) => parts["1"] && parts["2"])
            // Make a [name, day] pair for each
            .map(([day, ]) => ({ aocUser: member.name, day: Number(day) }))
    );
};

const getChats = async (days) => {
    // Transform a list of of of [AoC user, day] pairs into a list of [Telegram user, channel] pairs
    const uniqueAocUsers = [...new Set(days.map(({ aocUser }) => aocUser))];
    const userMap = await mapUsers(uniqueAocUsers);

    const uniqueDays = [...new Set(days.map(({ day }) => day))];
    const dayMap = await mapDaysToChats(YEAR, uniqueDays);

    return days
        .map(({ aocUser, day }) => ({ aocUser, day, telegramUser: userMap[aocUser], chat: dayMap[day] }))
        .filter(({ telegramUser, chat }) => telegramUser !== undefined && chat !== undefined);
};

const mapUsers = async (aocUsers) => {
    const map = {};

    console.log(`mapUsers: Going to query users from db`);

    const WINDOW = 100;
    for (let i = 0; i < aocUsers.length; i += WINDOW) {
        const keys = aocUsers
            .slice(i * WINDOW, (i + 1) * WINDOW)
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

    console.log(`mapUsers: Finished querying`);

    return map;
};

const mapDaysToChats = async (year, days) => {
    const map = {};

    console.log(`mapDaysToChats: Going to query chats from db`);

    const WINDOW = 100;
    for (let i = 0; i < days.length; i += WINDOW) {
        const keys = days
            .slice(i * WINDOW, (i + 1) * WINDOW)
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

    console.log(`mapDaysToChats: Finished querying`);

    return map;
};

const findChanges = async (chats) => {
    // Filter out users who are already in the chat
    const needsAdding = await Promise.all(chats.map(async ({ telegramUser, chat }) => {
        try {
            const member = await telegramSend('getChatMember', { chat_id: chat, user_id: telegramUser });
            return !member.ok || member.result.status === 'left';
        } catch (error) {
            if (error.isAxiosError && error.response?.data?.error_code === 400) {
                console.log(`findChanges: User not found ${telegramUser}`);
                return false;
            }
            throw error;
        }
    }));

    return chats.filter((_, index) => needsAdding[index]);
};

const sendInvites = async (changes) => {
    for (const { telegramUser, aocUser, chat, day } of changes) {
        const invite = await telegramSend('createChatInviteLink', {
            chat_id: chat,
            name: `AoC ${YEAR} Day ${day}`,
            member_limit: 1,
            creates_join_request: false
        });

        if (invite.ok) {
            try {
                await telegramSend('sendMessage', {
                    chat_id: telegramUser,
                    parse_mode: 'MarkdownV2',
                    text: `You are invited to the [${invite.result.name}](${invite.result.invite_link}) chat room.`
                });
                console.log(`sendInvites: Sent to AoC '${aocUser}' Telegram '${telegramUser}' Day ${day}`);
            } catch (error) {
                if (error.isAxiosError && error.response?.data?.error_code === 400) {
                    console.log(`sendInvites: Not allowed AoC '${aocUser}' Telegram '${telegramUser}' Day ${day}`);
                    continue;
                }
                throw error;
            }
        }
    }
};

const updateLeaderboard = async () => {
    // Load the leaderboard
    const leaderboard = await getLeaderboard();
    const days = getCompletedDays(leaderboard);

    // Get list of chats each user should be in
    const chats = await getChats(days);
    const changes = await findChanges(chats);

    console.log(`Changes: ${JSON.stringify(changes)}`);

    // Create invites for all missing cases
    await sendInvites(changes);

    return changes;
};

exports.updateLeaderboard = updateLeaderboard;
