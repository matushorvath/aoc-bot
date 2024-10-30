'use strict';

const { TelegramClient } = require('./telegram-client');
const { loadTelegramCredentials } = require('./telegram-credentials');
const { createTelegramDatabase, saveTelegramDatabase } = require('./telegram-database');

const main = async () => {
    const { apiId, apiHash, aesKey } = await loadTelegramCredentials();
    const { databaseDirectory, filesDirectory } = await createTelegramDatabase();

    const client = new TelegramClient(apiId, apiHash, databaseDirectory, filesDirectory);

    await client.interactiveLogin();
    await client.close();

    await saveTelegramDatabase(databaseDirectory, aesKey);
};

main().catch(console.error);
