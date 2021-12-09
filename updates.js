'use strict';

const { telegram } = require('./telegram');
const { updateLeaderboard } = require('./leaderboard');

const { DynamoDB } = require("@aws-sdk/client-dynamodb");

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

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
        text: `@AocElfBot is online, AoC ${year} Day ${day}`,
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
    let m = message.text.match(/^\s*\/(reg|update|start|help)(?:\s+(.+))?\s*$/)
    if (!m) {
        console.log(`onMessage: Text '${message.text}' did not match`);
        await onCommandUnknown(message.chat.id, message.text);
        return;
    }

    const command = m[1];
    const params = m[2];

    if (command === 'reg' && params) {
        await onCommandReg(message.chat.id, params.trim(), message.from.id);
    } else if (command === 'update') {
        await onCommandUpdate(message.chat.id, params.trim(), message.from.id);
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

const onCommandUpdate = async (chat) => {
    console.log(`onCommandUpdate: Start`);

    const changes = await updateLeaderboard();

    console.log('onCommandUpdate: Leaderboard updated');

    let info = '';
    for (const { aocUser, day } of changes) {
        info += `- ${aocUser} added to day ${day}\n`;
    }
    if (info === '') {
        info = '(no changes)\n';
    }

    await telegram('sendMessage', {
        chat_id: chat,
        text: `Leaderboard updated\n${info}`,
        disable_notification: true
    });

    console.log('onCommandUpdate: Done');
};

const HELP_TEXT =
`I can register your Advent of Code name, and then automatically invite you into the daily chat rooms once you solve each daily problem\\.

Supported commands:

/reg \\<aocname\\> – Register your Advent of Code name\\.
Format your name exactly as it is visible in our [leaderboard](https://adventofcode\\.com/2021/leaderboard/private/view/380635) \\(without the \`(AoC\\+\\+)\` suffix\\)\\.

/update – Update leaderboard\\.
Leaderboard is updated automatically every 15 minutes\\. This command is only needed if you want to trigger the update immediately\\.

/help – Show this message\\.
`;

const onCommandHelp = async (chat) => {
    console.log(`onCommandHelp: Display help`);

    await telegram('sendMessage', {
        chat_id: chat,
        parse_mode: 'MarkdownV2',
        disable_notification: true,
        text: HELP_TEXT
    });
};

const onCommandUnknown = async (chat) => {
    await telegram('sendMessage', {
        chat_id: chat,
        text: `Sorry, I don't understand that command`,
        disable_notification: true
    });
};

const onTelegramUpdate = async (update) => {
    if (update.my_chat_member) {
        await onMyChatMember(update.my_chat_member);
    } else if (update.message) {
        await onMessage(update.message);
    }
};

exports.onTelegramUpdate = onTelegramUpdate;
