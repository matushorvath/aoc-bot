'use strict';

const axios = require('axios');
const { DynamoDB } = require("@aws-sdk/client-dynamodb");

// TODO process leaderboards from multiple years
const YEAR = 2021;
const LEADERBOARD_ID = 380635;

const SECRETS = {
    adventofcode: process.env.ADVENT_OF_CODE_SECRET,
    telegram: process.env.TELEGRAM_SECRET
};

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const telegram = async (api, params = {}) => {
    console.debug(`telegram: Called with api '${api}' params '${JSON.stringify(params)}'`);

    const url = `https://api.telegram.org/bot${SECRETS.telegram}/${api}`;
    const response = await axios.post(url, params);

    console.debug(`telegram: Done processing`);

    return response.data;
};

const onMyChatMember = async (my_chat_member) => {
    // Only do something if we were made an admin in a group
    if (my_chat_member.new_chat_member?.status !== 'administrator'
        || my_chat_member.chat.type !== 'group' || !my_chat_member.chat.title) {
        return;
    }

    // Guess AoC day based on group title
    const m = my_chat_member.chat.title.match(/AoC ([0-9]{4}) Day ([0-9]{1,2})/);
    if (!m) {
        console.warn(`onMyChatMember: Chat title '${my_chat_member.chat.title}' did not match`);
        return;
    }

    const year = Number(m[1]);
    const day = Number(m[2]);

    console.log(`onMyChatMember: Admin in '${my_chat_member.chat.title}' id ${my_chat_member.chat.id} (${year}/${day})`);

    // Store the group info in db
    const params = {
        Item: {
            id: { S: `chat:${year}:${day}` },
            y: { N: String(year) },
            d: { N: String(day) },
            chat: { N: String(my_chat_member.chat.id) }
        },
        TableName: DB_TABLE
    };
    await db.putItem(params);

    console.log('onMyChatMember: Admin data stored in db');

    // Initialize the telegram group
    // TODO bot name should be clickable and open chat with the bot
    await telegram('sendMessage', {
        chat_id: my_chat_member.chat.id,
        text: `Aoc Bot is online, AoC ${year} Day ${day.toString().padStart(2, '0')}`,
        disable_notification: true
    });

    console.log('onMyChatMember: Admin processing done');
};

const onMessage = async (message) => {
    // Only handle private messages
    if (message.chat.type !== 'private' || !message.text || !message.from) {
        return;
    }

    // TODO support unreg command
    let m = message.text.match(/^\s*\/(reg|start|help)(?:\s+(.+))?\s*$/)
    if (!m) {
        console.log(`onMessage: Text '${message.text}' did not match`);
        await onCommandUnknown(message.chat.id, message.text);
        return;
    }

    const command = m[1];
    const params = m[2];

    if (command === 'reg' && params) {
        await onCommandReg(message.chat.id, params.trim(), message.from.id);
    } else if (command === 'start' || command === 'help') {
        await onCommandHelp(message.chat.id);
    } else {
        console.log(`onMessage: Unknown command '${message.text}'`);
        await onCommandUnknown(message.chat.id, message.text);
    }
};

const onCommandReg = async (chat, aocUser, telegramUser) => {
    console.log(`onCommandReg: Map user, AoC '${aocUser}' Telegram '${telegramUser}'`);

    // Store user mapping in db
    const params = {
        Item: {
            id: { S: `aoc_user:${aocUser}` },
            aoc_user: { S: aocUser },
            telegram_user: { N: String(telegramUser) }
        },
        TableName: DB_TABLE
    };
    await db.putItem(params);

    console.log('onCommandReg: Map user stored in db');

    // Confirm the registration
    await telegram('sendMessage', {
        chat_id: chat,
        text: `You are now registered as AoC user '${aocUser}'`,
        disable_notification: true
    });

    console.log('onCommandReg: Map user processing done');
};

const onCommandHelp = async (chat) => {
    console.log(`onCommandHelp: Display help`);

    const help =
`I can register your Advent of Code name, and then automatically invite you into the daily chat rooms once you solve each daily problem\\.

Supported commands:

/reg \\<aocname\\> – Register your Advent of Code name\\.
Format your name exactly as it is visible in our [leaderboard](https://adventofcode\\.com/2021/leaderboard/private/view/380635) \\(without the \`(AoC\\+\\+)\` suffix\\)\\.

/help – Show this message\\.
`;

    await telegram('sendMessage', {
        chat_id: chat,
        parse_mode: 'MarkdownV2',
        disable_notification: true,
        text: help
    });
};

const onCommandUnknown = async (chat) => {
    await telegram('sendMessage', {
        chat_id: chat,
        text: `Sorry, I don't understand that command`,
        disable_notification: true
    });
};

const getLeaderboard = async () => {
    console.log(`getLeaderboard: Going to download leaderboard`);

    const url = `https://adventofcode.com/${YEAR}/leaderboard/private/view/${LEADERBOARD_ID}.json`;
    const options = { headers: { Cookie: `session=${SECRETS.adventofcode}` } };
    const response = await axios.get(url, options);

    console.log(`getLeaderboard: Finished downloading`);

    return response.data;
};

const getCompletedDays = (leaderboard) => {
    // Get list of completed problems from the leaderboard
    return Object.values(leaderboard.members).flatMap(member =>
        Object.entries(member.completion_day_level)
            // take days with both parts completed
            .filter(([, parts]) => parts["1"] && parts["2"])
            // make a [name, day] pair for each
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
            const member = await telegram('getChatMember', { chat_id: chat, user_id: telegramUser });
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
        const invite = await telegram('createChatInviteLink', {
            chat_id: chat,
            name: `AoC ${YEAR} Day ${day}`,
            member_limit: 1,
            creates_join_request: false
        });

        if (invite.ok) {
            try {
                await telegram('sendMessage', {
                    chat_id: telegramUser,
                    parse_mode: 'MarkdownV2',
                    text: `[${invite.result.name}](${invite.result.invite_link})`
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

const main = async () => { // eslint-disable-line no-unused-vars
    // Process telegram updates received since last time
    const updates = await telegram('getUpdates');
    if (!updates.ok) {
        throw new Error(`Telegram data is not OK: ${JSON.stringify(updates)}`);
    }

    for (const update of updates.result) {
        if (update.my_chat_member) {
            await onMyChatMember(update.my_chat_member);
        } else if (update.message) {
            await onMessage(update.message);
        }
    }

    // Load the leaderboard
    const leaderboard = await getLeaderboard();
    const days = getCompletedDays(leaderboard);

    // Get list of chats each user should be in
    const chats = await getChats(days);
    const changes = await findChanges(chats);

    console.log(`Changes: ${JSON.stringify(changes)}`);

    // Create invites for all missing cases
    await sendInvites(changes);

    // Mark processed updates as done
    if (updates.result.length > 0) {
        const lastOffset = updates.result[updates.result.length - 1].update_id;
        await telegram('getUpdates', { offset: lastOffset + 1, limit: 1 });
    }
};

//main().catch(e => console.error(e));

const webhook = async () => {
    const url = 'https://7b79gj2si4.execute-api.eu-central-1.amazonaws.com/Prod/telegram?<token>';
    await telegram('setWebhook', { url });
};

webhook().catch(e => console.error(e));
