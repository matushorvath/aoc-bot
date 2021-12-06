const fs = require('fs/promises');
const axios = require('axios');
const yaml = require('js-yaml');
const { DynamoDB } = require("@aws-sdk/client-dynamodb");

const dbTable = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

// TODO get leaderboards from multiple years
const YEAR = 2021;
const LEADERBOARD_ID = 380635;

const getLeaderboard = async (session) => {
    const url = `https://adventofcode.com/${YEAR}/leaderboard/private/view/${LEADERBOARD_ID}.json`;
    const options = { headers: { Cookie: `session=${session}` } };
    const response = await axios.get(url, options);
    return response.data;
};

const getCompletedDays = (leaderboard) => {
    // Transform get list of completed problems from the leaderboard
    const data = Object.values(leaderboard.members).flatMap(member =>
        Object.entries(member.completion_day_level)
            // take days with both parts completed
            .filter(([, parts]) => parts["1"] && parts["2"])
            // make a [name, day] pair for each
            .map(([day, ]) => [member.name, Number(day)])
    );

    // Build a multimap: day -> array of people who have completed it
    const days = {};

    for (const [name, day] of data) {
        if (!days[day]) {
            days[day] = [name];
        } else {
            days[day].push(name);
        }
    }

    return days;
};

// const findChanges = async (secrets, days) => {
//     for (const [day, people] of days.entries()) {
//         // TODO find chat id for that day
//         const member = await telegram(secrets.telegram, { chat_id: 
//     }
// };

const telegram = async (token, api, params = {}) => {
    const url = `https://api.telegram.org/bot${token}/${api}`;
    const response = await axios.post(url, params);
    return response.data;
};

const onMyChatMember = async (secrets, my_chat_member) => {
    if (my_chat_member.new_chat_member?.status === 'administrator'
        && my_chat_member.chat.type === 'group' && my_chat_member.chat.title) {
        const m = my_chat_member.chat.title.match(/AoC ([0-9]{4}) Day ([0-9]{1,2})/);
        const year = Number(m[1]);
        const day = Number(m[2]);

        const params = {
            Item: {
                id: { S: `chat:${year}:${day}` },
                year: { N: String(year) },
                day: { N: String(day) },
                chat: { N: String(my_chat_member.chat.id) }
            },
            TableName: dbTable
        };
        await db.putItem(params);

        console.log(`Admin in '${my_chat_member.chat.title}' id ${my_chat_member.chat.id} (${year}/${day})`);

        telegram(secrets.telegram, 'sendMessage', {
            chat_id: my_chat_member.chat.id,
            text: `Aoc Bot is online, ${year}/${day.toString().padStart(2, '0')}`,
            disable_notification: true
        });
    }
};

const main = async () => {
    const secrets = yaml.load(await fs.readFile('/home/horvathm/aoc/secrets.yaml', 'utf8'));
    //const userMap = yaml.load(await fs.readFile('users.yaml', 'utf8'));
    console.log(secrets);
    // // Get current AoC leaderboard
    // const leaderboard = await getLeaderboard(secrets.adventofcode);
    // const days = getCompletedDays(leaderboard);
    // console.log(days);

    // Process telegram updates received since last time
    const data = await telegram(secrets.telegram, 'getUpdates');
    if (!data.ok) {
        throw new Error(`Telegram data is not OK: ${JSON.stringify(data)}`);
    }

    for (const update of data.result) {
        if (update.my_chat_member) {
            await onMyChatMember(secrets, update.my_chat_member);
        }
    }
};

main().catch(e => console.error(e));
