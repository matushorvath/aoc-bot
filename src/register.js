'use strict';

const loadSecrets = () => {
    const telegramSecret = process.env.TELEGRAM_SECRET;
    if (!telegramSecret) {
        throw Error('You need to set the TELEGRAM_SECRET environment variable');
    }

    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
        throw Error('You need to set the WEBHOOK_SECRET environment variable');
    }

    return { telegramSecret, webhookSecret };
};

const parseCommandLine = () => {
    if (process.argv.length !== 3) {
        throw Error('Usage: node register.js <url>');
    }

    const url = process.argv[2];

    return { url };
};

const sendTelegram = async (secret, api, data) => {
    const url = `https://api.telegram.org/bot${secret}/${api}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data == undefined ? undefined : JSON.stringify(data)
    });

    const json = await response.json();

    if (!response.ok || !json.ok) {
        console.error('telegram response:', json);
        throw Error('Telegram request failed');
    }

    return json;
};

const isRegistrationCorrect = (result, data) => {
    if (result?.url !== data.url) {
        console.log('webhook info url does not match');
        return false;
    }

    if (!result?.allowed_updates || result?.allowed_updates.length !== data.allowedUpdates.length
        || !result?.allowed_updates.every((v) => data.allowedUpdates.includes(v))) {
        console.log('webhook info allowed updates do not match');
        return false;
    }

    return true;
};

const register = async (secrets, data) => {
    // Find out if the bot has a webhook registered
    const infoBefore = await sendTelegram(secrets.telegramSecret, 'getWebhookInfo', undefined);
    console.log('webhook info (before):', infoBefore);

    // Check if the registration is correct
    if (isRegistrationCorrect(infoBefore?.result, data)) {
        console.log('webhook is already registered');
        return;
    }

    // Register the webhook
    const result = await sendTelegram(secrets.telegramSecret, 'setWebhook', {
        allowed_updates: data.allowedUpdates,
        drop_pending_updates: true,
        secret_token: secrets.webhookSecret,
        url: data.url
    });
    console.log('setWebhook result:', result);

    // Log webhook status after the change
    const infoAfter = await sendTelegram(secrets.telegramSecret, 'getWebhookInfo', undefined);
    console.log('webhook info (after):', infoAfter);
};

const main = async () => {
    const args = parseCommandLine();
    const secrets = loadSecrets();

    const data = {
        url: args.url,
        allowedUpdates: ['chat_member', 'message', 'my_chat_member']
    };

    return await register(secrets, data);
};

/* istanbul ignore next */
if (process.env.JEST_WORKER_ID === undefined) {
    main().catch((error) => {
        console.log(error);
        process.exitCode = 1;
    });
}

module.exports.register = register;
module.exports.main = main;
