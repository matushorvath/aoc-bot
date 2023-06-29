'use strict';

const { getTelegramSecret } = require('./secrets');
const { onMyChatMember } = require('./member');
const { onMessage } = require('./message');
const { onStartTime } = require('./times');

class ResultError extends Error {
    constructor(status, message, details = undefined) {
        super(message);
        this.status = status;
        this.message = message;
        this.body = { error: message };

        if (details) {
            this.body.details = details;
        }
    }
}

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
            explainUsage(event, error);
            return makeResponse(error);
        }

        console.log('handler: internal server error', error);
        return makeResponse(new ResultError(500, 'Internal Server Error'));
    }
};

const processEvent = async (event) => {
    if (event.resource === '/telegram') {
        if (event.httpMethod === 'POST') {
            return postTelegram(event);
        }
        throw new ResultError(405, 'Method Not Allowed');
    } else if (event.resource === '/start') {
        if (event.httpMethod === 'OPTIONS') {
            return options(event);
        } else if (event.httpMethod === 'POST') {
            return postStart(event);
        }
        throw new ResultError(405, 'Method Not Allowed');
    }
    throw new ResultError(403, 'Forbidden');
};

const postTelegram = async (event) => {
    console.log('postTelegram: start');

    await validateTelegramSecret(event);

    const update = parseBody(event);
    console.debug(`postTelegram: update ${JSON.stringify(update)}`);

    if (update.my_chat_member) {
        await onMyChatMember(update.my_chat_member);
    } else if (update.message) {
        await onMessage(update.message);
    }

    console.log('postTelegram: done');

    return { status: 201 };
};

const validateTelegramSecret = async (event) => {
    const secret = await getWebhookSecret();

    if (event.queryStringParameters?.[secret] !== '') {
        console.error('validateTelegramSecret: invalid secret');
        throw new ResultError(401, 'Unauthorized');
    }
};

const postStart = async (event) => {
    console.log('postStart: start');

    const body = parseBody(event);
    if (!body || typeof(body) !== 'object') {
        throw new ResultError(400, 'Bad Request', 'Missing or invalid request body');
    }

    const { version, year, day, part, name } = body;

    if (version === undefined || version !== 1) {
        throw new ResultError(400, 'Bad Request', "Expecting 'version' parameter to be 1");
    }

    if (typeof year !== 'number' || year < 2000 || year >= 2100) {
        throw new ResultError(400, 'Bad Request', "Missing or invalid 'year' parameter");
    }
    if (typeof day !== 'number' || day < 1 || day > 25) {
        throw new ResultError(400, 'Bad Request', "Missing or invalid 'day' parameter");
    }
    if (typeof part !== 'number' || (part !== 1 && part !== 2)) {
        throw new ResultError(400, 'Bad Request', "Missing or invalid 'part' parameter");
    }
    if (typeof name !== 'string' && !(name instanceof String)) {
        throw new ResultError(400, 'Bad Request', "Missing or invalid 'name' parameter");
    }

    const ts = Math.floor(Date.now() / 1000);
    const created = await onStartTime(year, day, part, name, ts);

    console.log('postStart: done');

    return { status: created ? 201 : 200 };
};

// TODO This should be done in AWS API GateWay configuration, but I can't get that to work
const options = async (_event) => {
    console.log('options');

    return { status: 204 };
};

const parseBody = (event) => {
    const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;

    try {
        return JSON.parse(body);
    } catch (error) {
        // JSON.parse only throws SyntaxError, but we handle other errors as well for completeness
        // istanbul ignore else
        if (error instanceof SyntaxError) {
            console.warn('Error while parsing body', error);
            throw new ResultError(400, 'Bad Request', 'Invalid JSON syntax');
        } else {
            throw error;
        }
    }
};

const explainUsage = (event, error) => {
    // Only add usage information in case of client-side errors
    if (error.status < 400 || error.status >= 500) {
        return;
    }

    const hostname = event.requestContext?.domainName ?? '<hostname>';

    if (event.resource === '/telegram') {
        // This endpoint is not intended for direct use, so there is no documentation
    } else if (event.resource === '/start') {
        const example = {
            version: 1,
            year: 2022,
            day: 13,
            part: 1,
            name: 'John Smith'
        };

        error.body.usage = [
            `POST https://${hostname}/start`,
            ...`body: ${JSON.stringify(example, undefined, 4)}`.split('\n')
        ];
    } else {
        error.body.usage = ['start'].map(resource => `POST https://${hostname}/${resource}`);
    }
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
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'OPTIONS,POST',
            ...contentTypeHeaders,
            ...result.headers
        },
        body: result.body === undefined ? undefined : JSON.stringify(result.body)
    };
};

exports.handler = handler;
exports.ResultError = ResultError;
