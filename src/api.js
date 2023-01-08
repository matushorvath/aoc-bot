'use strict';

const { getTelegramSecret } = require('./secrets');
const { onTelegramUpdate } = require('./telegram');
const { onStartTime } = require('./times');

class ResultError extends Error {
    constructor(status, message, data = {}) {
        super(message);
        this.status = status;
        this.message = message;
        this.body = { error: message, ...data };
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

    const body = parseBody(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
    await onTelegramUpdate(body);

    console.log('postTelegram: done');

    return { status: 201 };
};

const explainError = (details) => {
    const example = {
        version: 1,
        year: 2022,
        day: 13,
        part: 1,
        name: 'John Smith'
    };

    // TODO fill in the hostname
    return {
        details,
        usage: `POST https://<hostname>/start\nbody: ${JSON.stringify(example, undefined, 4)}`
    };
};

const parseBody = (body) => {
    try {
        return JSON.parse(body);
    } catch (error) {
        // JSON.parse only throws SyntaxError, but we handle other errors as well for completeness
        // istanbul ignore else
        if (error instanceof SyntaxError) {
            throw new ResultError(400, 'Bad Request', { details: 'Invalid JSON syntax' });
        } else {
            throw error;
        }
    }
};

const postStart = async (event) => {
    console.log('postStart: start');

    const body = parseBody(event.body);

    const { version, year, day, part, name } = body;
    if (version === undefined || version !== 1) {
        throw new ResultError(400, 'Bad Request', explainError("Expecting 'version' parameter to be 1"));
    }

    if (typeof year !== 'number' || year < 2000 || year >= 2100) {
        throw new ResultError(400, 'Bad Request', explainError("Missing or invalid 'year' parameter"));
    }
    if (typeof day !== 'number' || day < 1 || day > 25) {
        throw new ResultError(400, 'Bad Request', explainError("Missing or invalid 'day' parameter"));
    }
    if (typeof part !== 'number' || (part !== 1 && part !== 2)) {
        throw new ResultError(400, 'Bad Request', explainError("Missing or invalid 'part' parameter"));
    }
    if (typeof name !== 'string' && !(name instanceof String)) {
        throw new ResultError(400, 'Bad Request', explainError("Missing or invalid 'name' parameter"));
    }

    const ts = Math.floor(Date.now() / 1000);
    await onStartTime(year, day, part, name, ts);

    console.log('postStart: done');

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
    } else if (event.resource === '/start') {
        if (event.httpMethod === 'POST') {
            return postStart(event);
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

        const response = makeResponse(result);
        console.log('handler: data response', response);

        return response;
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
