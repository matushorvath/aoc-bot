'use strict';

const { getTelegramSecret } = require('./secrets');
const { onTelegramUpdate } = require('./telegram');

class ResultError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.message = message;
        this.body = { error: message };
    }
}

const validateSecret = async (event) => {
    const secret = await getTelegramSecret();

    if (event.queryStringParameters[secret] !== '') {
        console.error('validateSecret: invalid secret');
        throw new ResultError(401, 'Unauthorized');
    }
};

const postTelegram = async (event) => {
    console.log('postTelegram: start');

    await validateSecret(event);

    const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    await onTelegramUpdate(JSON.parse(body));

    console.log('postTelegram: done');

    return { status: 201 };
};

const makeResponse = (result) => {
    const contentTypeHeaders = result.body === undefined ? undefined : { 'Content-Type': 'application/json' };

    return {
        statusCode: result.status,
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            Expires: 0,
            Pragma: 'no-cache',
            'Surrogate-Control': 'no-store',
            ...contentTypeHeaders,
            ...result.headers
        },
        body: result.body === undefined ? undefined : JSON.stringify(result.body)
    };
};

const processEvent = async (event) => {
    if (event.resource === '/telegram') {
        if (event.httpMethod === 'POST') {
            return postTelegram(event);
        }
        throw new ResultError(405, 'Method Not Allowed');
    }
    throw new ResultError(403, 'Forbidden');
};

const handler = async (event) => {
    try {
        console.log('handler: start');
        const result = await processEvent(event);
        console.log('handler: data response', result);

        return makeResponse(result);
    } catch (error) {
        if (error instanceof ResultError) {
            console.log('handler: error response', error);
            return makeResponse(error);
        }

        console.log('handler: internal server error', error);
        return makeResponse(new ResultError(500, 'Internal Server Error'));
    }
};

exports.handler = handler;
