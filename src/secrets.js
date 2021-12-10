'use strict';

const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');

const ssm = new SSMClient({ apiVersion: '2014-11-06' });

let adventOfCodeSecret;
let telegramSecret;

const getSecrets = async () => {
    console.log("getSecrets: start");

    const params = {
        Names: ['/aoc-bot/advent-of-code-secret', '/aoc-bot/telegram-secret'],
        WithDecryption: true
    };
    const command = new GetParametersCommand(params);

    const result = await ssm.send(command);
    if (result.InvalidParameters?.length) {
        throw new Error(`getSecrets: Invalid parameters: ${JSON.stringify(result.InvalidParameters)}`);
    }

    adventOfCodeSecret = result.Parameters.find(p => p.Name === '/aoc-bot/advent-of-code-secret').Value;
    telegramSecret = result.Parameters.find(p => p.Name === '/aoc-bot/telegram-secret').Value;

    console.log("getSecrets: done");
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

const resetCache = () => {
    adventOfCodeSecret = telegramSecret = undefined;
};

exports.getAdventOfCodeSecret = getAdventOfCodeSecret;
exports.getTelegramSecret = getTelegramSecret;
exports.resetCache = resetCache;
