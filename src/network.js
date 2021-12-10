'use strict';

const { getTelegramSecret, getAdventOfCodeSecret } = require('./secrets');
const axios = require('axios');

const LEADERBOARD_ID = 380635;

const getLeaderboard = async (year) => {
    console.log(`getLeaderboard: start`);

    const secret = await getAdventOfCodeSecret();

    const url = `https://adventofcode.com/${year}/leaderboard/private/view/${LEADERBOARD_ID}.json`;
    const options = { headers: { Cookie: `session=${secret}` } };
    const response = await axios.get(url, options);

    console.log(`getLeaderboard: done`);

    return response.data;
};

const sendTelegram = async (api, params = {}) => {
    console.debug(`sendTelegram: api ${api} params ${JSON.stringify(params)}`);

    const secret = await getTelegramSecret();
    const url = `https://api.telegram.org/bot${secret}/${api}`;
    const response = await axios.post(url, params);

    return response.data;
};

exports.getLeaderboard = getLeaderboard;
exports.sendTelegram = sendTelegram;
