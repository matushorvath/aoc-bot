'use strict';

const { getTelegramSecret, getAdventOfCodeSecret } = require('./secrets');

const LEADERBOARD_ID = 380635;

const getLeaderboard = async (year) => {
    console.log(`getLeaderboard: start, year ${year}`);

    const secret = await getAdventOfCodeSecret();

    const url = `https://adventofcode.com/${year}/leaderboard/private/view/${LEADERBOARD_ID}.json`;
    const options = { headers: { Cookie: `session=${secret}` } };

    let response;
    response = await fetch(url, options);
    if (!response.ok) {
        console.log('getLeaderboard: returning empty leaderboard, HTTP error', response.status);
        return undefined;
    }

    const contentType = response.headers.get('content-type');
    if (contentType !== 'application/json') {
        console.log('getLeaderboard: returning empty leaderboard, content type is not JSON', contentType);
        return undefined;
    }

    console.log('getLeaderboard: done');

    return response.json();
};

class SendTelegramError extends Error {
    constructor(message, error_code, description) {
        super(message);

        this.isTelegramError = true;
        this.telegram_error_code = error_code;
        this.telegram_description = description;
    }
};

const sendTelegram = async (api, data, headers = undefined) => {
    const secret = await getTelegramSecret();
    const url = `https://api.telegram.org/bot${secret}/${api}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: data == undefined ? undefined : JSON.stringify(data)
    });

    var json = await response.json();

    if (!response.ok) {
        throw new SendTelegramError(
            `Telegram request failed with status ${response.status}`,
            json?.error_code, json?.description);
    }

    return json;
};

exports.getLeaderboard = getLeaderboard;
exports.sendTelegram = sendTelegram;
