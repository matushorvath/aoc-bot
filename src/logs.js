'use strict';

const { sendTelegram } = require('./network');
const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

// TODO refactor to use individual records with different sort keys, not one record with an array

const enableLogs = async (chat) => {
    console.log(`enableLogs: start, chat ${chat}`);

    // Add chat to the set
    const params = {
        TableName: DB_TABLE,
        Key: {
            id: { S: 'logs' },
            sk: { S: '0' }
        },
        UpdateExpression: 'ADD chats :c',
        ExpressionAttributeValues: {
            ':c': { NS: [String(chat)] }
        },
        ReturnValues: 'ALL_NEW'
    };
    const data = await db.updateItem(params);

    console.log(`enableLogs: done, chats [${data.Attributes?.chats?.NS}]`);
};

const disableLogs = async (chat) => {
    console.log(`disableLogs: start, chat ${chat}`);

    // Add chat to the set
    const params = {
        TableName: DB_TABLE,
        Key: {
            id: { S: 'logs' },
            sk: { S: '0' }
        },
        UpdateExpression: 'DELETE chats :c',
        ExpressionAttributeValues: {
            ':c': { NS: [String(chat)] }
        },
        ReturnValues: 'ALL_NEW'
    };
    const data = await db.updateItem(params);

    console.log(`disableLogs: done, chats [${data.Attributes?.chats?.NS}]`);
};

const logActivity = async (message) => {
    const chats = await getChats();

    await Promise.all([...chats].map(async (chat) => {
        try {
            await sendTelegram('sendMessage', {
                chat_id: chat,
                text: `log: ${message}`,
                disable_notification: true
            });
        } catch (error) {
            const code = error.response?.data?.error_code;
            if (error.isAxiosError && code >= 400 && code < 500) {
                console.warn(`logActivity: could not send logs to chat ${chat}`);
            } else {
                console.error(`logActivity: unexpected error ${error}`);
            }
        }
    }));
};

const getChats = async () => {
    console.log('getChats: start');

    // Load list of years from db
    const params = {
        TableName: DB_TABLE,
        Key: {
            id: { S: 'logs' },
            sk: { S: '0' }
        },
        ProjectionExpression: 'chats'
    };

    const x = await db.getItem(params);
    const chats = new Set(x?.Item?.chats?.NS?.map(Number));

    console.log(`getChats: done, found [${[...chats]}]`);
    return chats;
};

exports.enableLogs = enableLogs;
exports.disableLogs = disableLogs;
exports.logActivity = logActivity;
