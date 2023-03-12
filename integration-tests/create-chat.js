'use strict';

const { TelegramClient } = require('./telegram-client');

const yaml = require('yaml');
const fs = require('fs/promises');
const path = require('path');

const botUserId = 5071613978;

const loadCredentials = async () => {
    try {
        return yaml.parse(await fs.readFile(path.join(__dirname, 'credentials.yaml'), 'utf-8'));
    } catch (e) {
        console.error('You need to create credentials.yaml using credentials.yaml.template');
        throw e;
    }
};

const createAccount = async (client) => {
    console.log(await client.createSupergroup('MH TEST AoC 2001 Day 25', 'MH Test Description'));

    const joinMessage = await client.addChatAdmin(botUserId, testChatId);
};

const main = async () => {
    const credentials = await loadCredentials();
    const client = new TelegramClient(credentials);

    try {
        await client.init();
        await createAccount(client);
    } finally {
        await client.close();
    }
};

main().catch(console.error);
