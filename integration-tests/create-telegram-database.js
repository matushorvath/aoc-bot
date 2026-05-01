import { TelegramClient } from './telegram-client.js';
import { loadTelegramCredentials } from './telegram-credentials.js';
import { createTelegramDatabase, saveTelegramDatabase } from './telegram-database.js';

const main = async () => {
    const { apiId, apiHash, aesKey } = await loadTelegramCredentials();
    const { databaseDirectory, filesDirectory } = await createTelegramDatabase();

    const client = new TelegramClient(apiId, apiHash, databaseDirectory, filesDirectory);

    await client.interactiveLogin();
    await client.close();

    await saveTelegramDatabase(databaseDirectory, aesKey);
};

main().catch(console.error);
