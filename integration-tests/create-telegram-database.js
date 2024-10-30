'use strict';

const { TelegramClient } = require('./telegram-client');
const { loadTelegramCredentials } = require('./telegram-credentials');
const { createTelegramDatabase } = require('./telegram-database');

const main = async () => {
    const { apiId, apiHash/*, aesKey*/ } = await loadTelegramCredentials();
    const { databaseDirectory, filesDirectory } = await createTelegramDatabase();

    const client = new TelegramClient(apiId, apiHash, databaseDirectory, filesDirectory);

    //await client.init();
    await client.interactiveLogin();

    await client.close();
};

main().catch(console.error);
