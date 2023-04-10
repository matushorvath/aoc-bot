'use strict';

const { TelegramClient } = require('./client');
const { getTdLibSecrets } = require('./secrets');

const botUserId = 5071613978;

let cachedClient;
const getTelegramClient = async () => {
    if (cachedClient) {
        return cachedClient;
    }

    // Create and initialize the tdlib-based Telegram client
    const { apiId, apiHash, aesKey } = await getTdLibSecrets();
    cachedClient = new TelegramClient(apiId, apiHash, aesKey);

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

    const { chatId, supergroupId } = await client.createSupergroup('MH TEST AoC 2001 Day 25', 'MH Test Description');
    console.debug(`createNewChat: Created chat ${chatId} supergroup ${supergroupId}`);

    // TODO mark the chat as created somehow, so we don't repeatedly try to create the same chat over and over

    await client.addChatAdmin(botUserId, chatId);
    console.debug(`createNewChat: Added bot ${botUserId} as admin to chat ${chatId}`);
};

const transferChatOwnership = async (_newOwnerUserId) => {
    const client = await getTelegramClient();

    const result = await client.canTransferChatOwnership();
    console.debug(result);
};

exports.createNewChat = createNewChat;
exports.transferChatOwnership = transferChatOwnership;
