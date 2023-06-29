'use strict';

const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');

const ssm = new SSMClient({ apiVersion: '2014-11-06' });

let adventOfCodeSecret;
let telegramSecret;
let webhookSecret;

const getSecrets = async () => {
    console.log('getSecrets: start');

    const params = {
        Names: ['/aoc-bot/advent-of-code-secret', '/aoc-bot/telegram-secret', '/aoc-bot/webhook-secret'],
        WithDecryption: true
    };
    const command = new GetParametersCommand(params);

    const result = await ssm.send(command);
    if (result.InvalidParameters?.length) {
        throw new Error(`getSecrets: Invalid parameters: ${JSON.stringify(result.InvalidParameters)}`);
    }

    adventOfCodeSecret = result.Parameters.find(p => p.Name === '/aoc-bot/advent-of-code-secret').Value;
    telegramSecret = result.Parameters.find(p => p.Name === '/aoc-bot/telegram-secret').Value;
    webhookSecret = result.Parameters.find(p => p.Name === '/aoc-bot/webhook-secret').Value;

    console.log('getSecrets: done');
};

const getAdventOfCodeSecret = async () => {
    if (adventOfCodeSecret === undefined) {
        await getSecrets();
    }
    return adventOfCodeSecret;
};

const getTelegramSecret = async () => {
    if (telegramSecret === undefined) {
        await getSecrets();
    }
    return telegramSecret;
};

const getWebhookSecret = async () => {
    if (webhookSecret === undefined) {
        await getSecrets();
    }
    return webhookSecret;
};

const resetCache = () => {
    adventOfCodeSecret = telegramSecret = webhookSecret = undefined;
};

exports.getAdventOfCodeSecret = getAdventOfCodeSecret;
exports.getTelegramSecret = getTelegramSecret;
exports.getWebhookSecret = getWebhookSecret;
exports.resetCache = resetCache;
