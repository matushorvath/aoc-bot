'use strict';

const { TelegramClient } = require('./client');
const { getTdLibSecrets } = require('./secrets');

let cachedClient;
const getTelegramClient = async () => {
    if (cachedClient) {
        return cachedClient;
    }

    // Create and initialize the tdlib-based Telegram client
    const secrets = await getTdLibSecrets();
    cachedClient = new TelegramClient(secrets);

    try {
        await cachedClient.init();
    } catch (error) {
        await cachedClient.close();
        cachedClient = undefined;

        throw error;
    }

    return cachedClient;
};

const createNewChat = async () => {
    const client = await getTelegramClient();

    const chat = await client.createSupergroup('MH TEST AoC 2001 Day 25', 'MH Test Description');
    console.log(chat);
};

exports.createNewChat = createNewChat;
