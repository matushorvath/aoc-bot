const fs = require('fs');
const fsp = require('fs/promises');
const axios = require('axios');
const yaml = require('js-yaml');
const { DynamoDB } = require("@aws-sdk/client-dynamodb");

// TODO process leaderboards from multiple years
const YEAR = 2021;
const LEADERBOARD_ID = 380635;

const SECRETS = yaml.load(fs.readFileSync('/home/horvathm/aoc/secrets.yaml', 'utf8'));

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const telegram = async (api, params = {}) => {
    const url = `https://api.telegram.org/bot${SECRETS.telegram}/${api}`;
    const response = await axios.post(url, params);
    return response.data;
};

const onMyChatMember = async (my_chat_member) => {
    // Only do something if we were made an admin in a group
    if (my_chat_member.new_chat_member?.status !== 'administrator'
        || my_chat_member.chat.type !== 'group' || my_chat_member.chat.title) {
        return;
    }

    // Guess AoC day based on group title
    const m = my_chat_member.chat.title.match(/AoC ([0-9]{4}) Day ([0-9]{1,2})/);
    if (!m) {
        return;
    }

    const year = Number(m[1]);
    const day = Number(m[2]);

    console.log(`Admin in '${my_chat_member.chat.title}' id ${my_chat_member.chat.id} (${year}/${day})`);

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

    console.log('Admin data stored in db');

    // Initialize the telegram group
    telegram('sendMessage', {
        chat_id: my_chat_member.chat.id,
        text: `Aoc Bot is online, ${year}/${day.toString().padStart(2, '0')}`,
        disable_notification: true
    });

    console.log('Admin processing done');
};

const getLeaderboard = async () => {
    const url = `https://adventofcode.com/${YEAR}/leaderboard/private/view/${LEADERBOARD_ID}.json`;
    const options = { headers: { Cookie: `session=${SECRETS.adventofcode}` } };
    const response = await axios.get(url, options);
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

const mapDaysToChats = async (year, days) => {
    const map = {};

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

    return map;
};

const getChats = async (days) => {
    // Transform a list of of of [AoC user, day] pairs into a list of [Telegram user, channel] pairs
    const userMap = yaml.load(await fsp.readFile('users.yaml', 'utf8'));

    const uniqueDays = [...new Set(days.map(({ day }) => day))];
    const dayMap = await mapDaysToChats(YEAR, uniqueDays);

    return days
        .map(({ aocUser, day }) => ({ aocUser, day, telegramUser: userMap[aocUser], chat: dayMap[day] }))
        .filter(({ telegramUser, chat }) => telegramUser !== undefined && chat !== undefined);
};

const findChanges = async (chats) => {
    // Filter out users who are already in the chat
    const isInChat = await Promise.all(chats.map(async ({ telegramUser, chat }) => {
        const member = await telegram('getChatMember', { chat_id: chat, user_id: telegramUser });
        return member.ok && member.result.status !== 'left';
    }));

    return chats.filter((_, index) => !isInChat[index]);
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
                console.log(`Sent invite: ${aocUser} (${telegramUser}, day ${day}`);
            } catch (error) {
                if (error.isAxiosError && error.response?.data?.error_code === 400) {
                    console.log(`Not allowed to message: ${aocUser} (${telegramUser}, day ${day})`);
                    continue;
                }
                throw error;
            }
        }
    }
};

const main = async () => {
    // Process telegram updates received since last time
    const data = await telegram('getUpdates');
    if (!data.ok) {
        throw new Error(`Telegram data is not OK: ${JSON.stringify(data)}`);
    }

    for (const update of data.result) {
        if (update.my_chat_member) {
            await onMyChatMember(update.my_chat_member);
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
};

main().catch(e => console.error(e));
