'use strict';

const { sendTelegram, getLeaderboard, getStartTimes } = require('./network');
const { updateLeaderboards } = require('./schedule');
const { formatBoard } = require('./board-format');
const { addYear } = require('./years');
const { enableLogs, disableLogs, logActivity } = require('./logs');

const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const fsp = require('fs/promises');
const path = require('path');

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const onMyChatMember = async (my_chat_member) => {
    // Only do something if we were made an admin in a group
    if (my_chat_member.new_chat_member?.status !== 'administrator'
        || (my_chat_member.chat.type !== 'group' && my_chat_member.chat.type !== 'supergroup')
        || !my_chat_member.chat.title) {
        return;
    }

    // Guess AoC day based on group title
    const m = my_chat_member.chat.title.match(/AoC ([0-9]{4}) Day ([0-9]{1,2})/);
    if (!m) {
        console.warn(`onMyChatMember: chat title '${my_chat_member.chat.title}' did not match`);
        return;
    }

    const year = Number(m[1]);
    const day = Number(m[2]);

    console.log(`onMyChatMember: admin in '${my_chat_member.chat.title}' id ${my_chat_member.chat.id} (${year}/${day})`);

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

    console.log('onMyChatMember: chat stored in db');

    await addYear(year);

    // Initialize the group
    await sendTelegram('sendMessage', {
        chat_id: my_chat_member.chat.id,
        text: `@AocElfBot is online, AoC ${year} Day ${day}`,
        disable_notification: true
    });

    await logActivity(`Added to chat '${my_chat_member.chat.title}' (${year}/${day})`);

    console.log('onMyChatMember: done');
};

const onMessage = async (message) => {
    // Only handle private messages
    if (message.chat.type !== 'private' || !message.text || !message.from) {
        return;
    }

    let m = message.text.match(/^\s*\/(reg|unreg|logs|status|update|board|start|help)(?:\s+(.+))?\s*$/);
    if (!m) {
        console.log(`onMessage: text '${message.text}' did not match`);
        await onCommandUnknown(message.chat.id, message.text);
        return;
    }

    const command = m[1];
    const params = m[2];

    if (command === 'reg' && params) {
        await onCommandReg(message.chat.id, params?.trim(), message.from.id);
    } else if (command === 'unreg') {
        await onCommandUnreg(message.chat.id, message.from.id);
    } else if (command === 'logs' && params) {
        await onCommandLogs(message.chat.id, params?.trim(), message.from.id);
    } else if (command === 'status') {
        await onCommandStatus(message.chat.id, message.from.id);
    } else if (command === 'update') {
        await onCommandUpdate(message.chat.id, message.from);
    } else if (command === 'board' && params) {
        await onCommandBoard(message.chat.id, params?.trim());
    } else if (command === 'start' || command === 'help') {
        await onCommandHelp(message.chat.id);
    } else {
        console.log(`onMessage: unknown command '${message.text}'`);
        await onCommandUnknown(message.chat.id, message.text);
    }
};

const onCommandReg = async (chat, aocUser, telegramUser) => {
    console.log(`onCommandReg: start, aocUser ${aocUser} telegramUser ${telegramUser}`);

    // Delete existing registration, if any
    await deleteUserData(telegramUser);

    // Store user mapping in db
    const aocParams = {
        Item: {
            id: { S: `aoc_user:${aocUser}` },
            aoc_user: { S: aocUser },
            telegram_user: { N: String(telegramUser) }
        },
        TableName: DB_TABLE
    };
    await db.putItem(aocParams);

    const telegramParams = {
        Item: {
            id: { S: `telegram_user:${telegramUser}` },
            aoc_user: { S: aocUser },
            telegram_user: { N: String(telegramUser) }
        },
        TableName: DB_TABLE
    };
    await db.putItem(telegramParams);

    console.log('onCommandReg: user stored in db');

    // Confirm the registration
    await sendTelegram('sendMessage', {
        chat_id: chat,
        text: `You are now registered as AoC user '${aocUser}'`,
        disable_notification: true
    });

    await logActivity(`Registered user '${aocUser}'`);

    console.log('onCommandReg: done');
};

const onCommandUnreg = async (chat, telegramUser) => {
    console.log(`onCommandUnreg: start, telegramUser '${telegramUser}'`);

    const aocUser = await deleteUserData(telegramUser);
    if (aocUser) {
        await sendTelegram('sendMessage', {
            chat_id: chat,
            text: `You are no longer registered (your AoC name was '${aocUser}')`,
            disable_notification: true
        });

        await logActivity(`Unregistered user '${aocUser}'`);
    } else {
        await sendTelegram('sendMessage', {
            chat_id: chat,
            text: 'You are not registered',
            disable_notification: true
        });
    }

    console.log('onCommandUnreg: done');
};

const deleteUserData = async (telegramUser) => {
    // Find AoC record in database
    const getParams = {
        TableName: DB_TABLE,
        Key: { id: { S: `telegram_user:${telegramUser}` } },
        ProjectionExpression: 'aoc_user'
    };

    const getData = await db.getItem(getParams);
    if (!getData.Item) {
        console.log('deleteUserData: no records to delete');
        return undefined;
    }

    const aocUser = getData.Item.aoc_user.S;
    console.log(`deleteUserData: found aocUser ${aocUser}`);

    // Delete all user records
    const writeParams = {
        RequestItems: {
            [DB_TABLE]: [{
                DeleteRequest: {
                    Key: { id: { S: `aoc_user:${aocUser}` } }
                }
            }, {
                DeleteRequest: {
                    Key: { id: { S: `telegram_user:${telegramUser}` } }
                }
            }]
        }
    };
    const writeData = await db.batchWriteItem(writeParams);

    if (Object.keys(writeData.UnprocessedItems).length > 0) {
        console.warn(`deleteUserData: some records not deleted: ${JSON.stringify(writeData.UnprocessedItems)}`);
    }

    console.log(`deleteUserData: user telegramUser ${telegramUser} aocUser ${aocUser} deleted from db`);
    return aocUser;
};

const onCommandLogs = async (chat, value) => {
    console.log(`onCommandLogs: start, value '${value}'`);

    if (value === 'on') {
        enableLogs(chat);
        console.log('onCommandLogs: logs enabled');

        await sendTelegram('sendMessage', {
            chat_id: chat,
            text: 'Activity logs will now be sent to this chat',
            disable_notification: true
        });
    } else if (value === 'off') {
        disableLogs(chat);
        console.log('onCommandLogs: logs disabled');

        await sendTelegram('sendMessage', {
            chat_id: chat,
            text: 'Activity logs will now be no longer sent to this chat',
            disable_notification: true
        });
    } else {
        console.log(`onCommandLogs: value is invalid: ${value}`);
        await sendTelegram('sendMessage', {
            chat_id: chat,
            text: "Use '/logs on' to start sending activity logs to you, use '/logs off' to stop",
            disable_notification: true
        });
    }

    console.log('onCommandLogs: done');
};

const onCommandBoard = async (chat, params) => {
    console.log(`onCommandBoard: start, day ${params}`);

    const m = params.match(/([0-9]{4})\s+([0-9]{1,2})/);
    if (!m) {
        console.log(`onCommandBoard: params are invalid: ${params}`);
        await sendTelegram('sendMessage', {
            chat_id: chat,
            text: "I need two parameters, '/board <year> <day>'",
            disable_notification: true
        });
        return;
    }

    const [year, day] = params.split(' ').map(Number);

    const leaderboard = await getLeaderboard(year);
    if (!leaderboard) {
        console.log('onCommandBoard: no leaderboard data');
        await sendTelegram('sendMessage', {
            chat_id: chat,
            parse_mode: 'MarkdownV2',
            text: 'Could not retrieve leaderboard data',
            disable_notification: true
        });
        return;
    }

    const startTimes = await getStartTimes();
    const board = formatBoard(year, day, leaderboard, startTimes);

    await sendTelegram('sendMessage', {
        chat_id: chat,
        parse_mode: 'MarkdownV2',
        text: board,
        disable_notification: true,
        disable_web_page_preview: true
    });

    console.log('onCommandBoard: done');
};

const onCommandStatus = async (chat, telegramUser) => {
    console.log(`onCommandStatus: start telegramUser ${telegramUser}`);

    // Find AoC record in database
    const getParams = {
        TableName: DB_TABLE,
        Key: { id: { S: `telegram_user:${telegramUser}` } },
        ProjectionExpression: 'aoc_user'
    };

    const getData = await db.getItem(getParams);
    const aocUser = getData.Item?.aoc_user.S;

    if (aocUser) {
        await sendTelegram('sendMessage', {
            chat_id: chat,
            text: `You are registered as AoC user '${aocUser}'`,
            disable_notification: true
        });
    } else {
        await sendTelegram('sendMessage', {
            chat_id: chat,
            text: 'You are not registered',
            disable_notification: true
        });
    }

    console.log('onCommandStatus: done');
};

const onCommandUpdate = async (chat, from) => {
    console.log('onCommandUpdate: start');

    await sendTelegram('sendMessage', {
        chat_id: chat,
        text: 'Updating leaderboards, this might take a few seconds',
        disable_notification: true
    });

    const { unretrieved, sent, created, updated } = await updateLeaderboards();

    let info = '';
    for (const { year } of unretrieved) {
        info += `• could not retrieve data for year ${year}\n`;
    }
    for (const { aocUser, year, day } of sent) {
        info += `• invited ${aocUser} to ${year} day ${day}\n`;
    }
    for (const { year, day } of created) {
        info += `• created board for ${year} day ${day}\n`;
    }
    for (const { year, day } of updated) {
        info += `• updated board for ${year} day ${day}\n`;
    }
    if (info === '') {
        info = '(no changes)\n';
    }

    await sendTelegram('sendMessage', {
        chat_id: chat,
        text: `Leaderboards updated\n${info}`,
        disable_notification: true
    });

    const senderName = formatSenderName(from);
    await logActivity(`Update triggered by user '${senderName}'`);

    console.log('onCommandUpdate: done');
};

const formatSenderName = (from) => {
    if (from.first_name && from.last_name) {
        return `${from.first_name} ${from.last_name}`;
    } else if (from.first_name) {
        return from.first_name;
    } else {
        return `(id ${from.id})`;
    }
};

let helpText;

const onCommandHelp = async (chat) => {
    console.log('onCommandHelp: start');

    if (!helpText) {
        helpText = await fsp.readFile(path.join(__dirname, 'help.txt'), 'utf-8');
    }

    await sendTelegram('sendMessage', {
        chat_id: chat,
        parse_mode: 'MarkdownV2',
        disable_notification: true,
        text: helpText
    });
};

const onCommandUnknown = async (chat) => {
    await sendTelegram('sendMessage', {
        chat_id: chat,
        text: "Sorry, I don't understand that command",
        disable_notification: true
    });
};

const onTelegramUpdate = async (update) => {
    console.debug(`onTelegramUpdate: start, update ${JSON.stringify(update)}`);

    if (update.my_chat_member) {
        await onMyChatMember(update.my_chat_member);
    } else if (update.message) {
        await onMessage(update.message);
    }
};

exports.onTelegramUpdate = onTelegramUpdate;
