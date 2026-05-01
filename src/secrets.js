import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({ apiVersion: '2014-11-06' });

let adventOfCodeSecret;
let telegramSecret;
let webhookSecret;

const getSecret = async (name) => {
    console.log(`getSecret: start, name ${name}`);

    const params = { Name: `/aoc-bot/${name}`, WithDecryption: true };
    const result = await ssm.send(new GetParameterCommand(params));

    console.log('getSecret: done');

    return result.Parameter.Value;
};

export const getAdventOfCodeSecret = async () => {
    if (adventOfCodeSecret === undefined) {
        adventOfCodeSecret = await getSecret('advent-of-code-secret');
    }
    return adventOfCodeSecret;
};

export const getTelegramSecret = async () => {
    if (telegramSecret === undefined) {
        telegramSecret = await getSecret('telegram-secret');
    }
    return telegramSecret;
};

export const getWebhookSecret = async () => {
    if (webhookSecret === undefined) {
        webhookSecret = await getSecret('webhook-secret');
    }
    return webhookSecret;
};

export const resetCache = () => {
    adventOfCodeSecret = telegramSecret = webhookSecret = undefined;
};
