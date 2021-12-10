'use strict';

const { getTelegramSecret } = require('./secrets');
const axios = require('axios');

const telegramSend = async (api, params = {}) => {
    console.debug(`telegramSend: api ${api} params ${JSON.stringify(params)}`);

    const secret = await getTelegramSecret();
    const url = `https://api.telegram.org/bot${secret}/${api}`;
    const response = await axios.post(url, params);

    return response.data;
};

exports.telegramSend = telegramSend;
