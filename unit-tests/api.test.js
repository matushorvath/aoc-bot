'use strict';

const { handler, ResultError } = require('../src/api');

const secrets = require('../src/secrets');
jest.mock('../src/secrets');

const member = require('../src/member');
jest.mock('../src/member');

const message = require('../src/message');
jest.mock('../src/message');

const times = require('../src/times');
jest.mock('../src/times');

beforeEach(() => {
    secrets.getTelegramSecret.mockReset();
    member.onMyChatMember.mockReset();
    message.onMessage.mockReset();
    times.onStartTime.mockReset();
});

describe('API handler', () => {
    test('returns correct headers with errors', async () => {
        const event = { resource: '/uNkNoWn', httpMethod: 'iNvAlId' };
        await expect(handler(event)).resolves.toMatchObject({
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                Expires: 0,
                Pragma: 'no-cache',
                'Surrogate-Control': 'no-store',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST',
                'Content-Type': 'application/json'
            }
        });

        expect(secrets.getTelegramSecret).not.toHaveBeenCalled();
        expect(member.onMyChatMember).not.toHaveBeenCalled();
        expect(message.onMessage).not.toHaveBeenCalled();
    });

    test('rejects unknown resource path', async () => {
        const event = { resource: '/uNkNoWn', httpMethod: 'POST' };
        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 403,
            body: JSON.stringify({
                error: 'Forbidden',
                usage: ['POST https://<hostname>/start']
            })
        });

        expect(secrets.getTelegramSecret).not.toHaveBeenCalled();
        expect(member.onMyChatMember).not.toHaveBeenCalled();
        expect(message.onMessage).not.toHaveBeenCalled();
    });

    test('rejects unknown method for /telegram', async () => {
        const event = { resource: '/telegram', httpMethod: 'GET' };
        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 405,
            body: '{"error":"Method Not Allowed"}'
        });

        expect(member.onMyChatMember).not.toHaveBeenCalled();
        expect(message.onMessage).not.toHaveBeenCalled();
        expect(times.onStartTime).not.toHaveBeenCalled();
    });

    test('rejects unknown method for /start', async () => {
        const event = { resource: '/start', httpMethod: 'GET' };
        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 405,
            body: expect.stringMatching(/{"error":"Method Not Allowed","usage":\[.*\]}/)
        });

        expect(member.onMyChatMember).not.toHaveBeenCalled();
        expect(message.onMessage).not.toHaveBeenCalled();
        expect(times.onStartTime).not.toHaveBeenCalled();
    });
});

describe('POST /telegram API', () => {
    test('handles getTelegramSecret throwing', async () => {
        secrets.getTelegramSecret.mockRejectedValueOnce(new Error('sEcReTeRrOr'));

        const event = { resource: '/telegram', httpMethod: 'POST' };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 500, body: '{"error":"Internal Server Error"}' });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(member.onMyChatMember).not.toHaveBeenCalled();
        expect(message.onMessage).not.toHaveBeenCalled();
    });

    test('handles request with missing queryStringParameters', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = { resource: '/telegram', httpMethod: 'POST' };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 401, body: '{"error":"Unauthorized"}' });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(member.onMyChatMember).not.toHaveBeenCalled();
        expect(message.onMessage).not.toHaveBeenCalled();
    });

    test('handles request with missing secret', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = { resource: '/telegram', httpMethod: 'POST', queryStringParameters: {} };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 401, body: '{"error":"Unauthorized"}' });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(member.onMyChatMember).not.toHaveBeenCalled();
        expect(message.onMessage).not.toHaveBeenCalled();
    });

    test('handles request with invalid secret', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = { resource: '/telegram', httpMethod: 'POST', queryStringParameters: { bAdSeCrEt: '' } };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 401, body: '{"error":"Unauthorized"}' });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(member.onMyChatMember).not.toHaveBeenCalled();
        expect(message.onMessage).not.toHaveBeenCalled();
    });

    test('handles onMyChatMember throwing', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');
        member.onMyChatMember.mockRejectedValueOnce(new Error('uPdAtEeRrOr'));

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            queryStringParameters: { gOoDsEcReT: '' },
            body: '{"my_chat_member":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 500, body: '{"error":"Internal Server Error"}' });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(member.onMyChatMember).toHaveBeenCalledWith(true);
    });

    test('handles onMessage throwing', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');
        message.onMessage.mockRejectedValueOnce(new Error('uPdAtEeRrOr'));

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            queryStringParameters: { gOoDsEcReT: '' },
            body: '{"message":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 500, body: '{"error":"Internal Server Error"}' });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(message.onMessage).toHaveBeenCalledWith(true);
    });

    test('handles invalid payload', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            queryStringParameters: { gOoDsEcReT: '' },
            body: '$%^&'
        };
        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 400,
            body: '{"error":"Bad Request","details":"Invalid JSON syntax"}'
        });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(member.onMyChatMember).not.toHaveBeenCalled();
        expect(message.onMessage).not.toHaveBeenCalled();
    });

    test('processes an ignored update', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            queryStringParameters: { gOoDsEcReT: '' },
            body: '{"bOdY":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 201 });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(member.onMyChatMember).not.toHaveBeenCalled();
        expect(message.onMessage).not.toHaveBeenCalled();
    });

    test('processes plain payload', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            queryStringParameters: { gOoDsEcReT: '' },
            body: '{"message":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 201 });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(message.onMessage).toHaveBeenCalledWith(true);
    });

    test('processes base64 payload', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            queryStringParameters: { gOoDsEcReT: '' },
            isBase64Encoded: true,
            body: 'eyJtZXNzYWdlIjp0cnVlfQ=='        // {"message":true} encoded with base64
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 201 });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(message.onMessage).toHaveBeenCalledWith(true);
    });

    test('returns correct headers with successful request', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            queryStringParameters: { gOoDsEcReT: '' },
            isBase64Encoded: false,
            body: '{"message":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                Expires: 0,
                Pragma: 'no-cache',
                'Surrogate-Control': 'no-store',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            }
        });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(message.onMessage).toHaveBeenCalledWith(true);
    });
});

describe('OPTIONS /start API', () => {
    test('works', async () => {
        const event = {
            resource: '/start',
            httpMethod: 'OPTIONS'
        };

        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 204,
            headers: {
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            }
        });
    });
});

describe('POST /start API', () => {
    test.each([
        ['missing body', {}, 'Invalid JSON syntax'],
        ['empty body', { body: '' }, 'Invalid JSON syntax'],
        ['wrong JSON', { body: ']' }, 'Invalid JSON syntax'],
        ['non-object JSON', { body: '0' }, 'Missing or invalid request body']
    ])('fails with %s', async (description, eventPart, errorMatch) => {
        const event = {
            resource: '/start',
            httpMethod: 'POST',
            ...eventPart
        };
        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 400,
            body: expect.stringMatching(errorMatch)
        });

        expect(times.onStartTime).not.toHaveBeenCalled();
    });

    test.each([
        ['missing version', { body: { year: 2022, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'version'],
        ['non-numeric version', { body: { version: '1', year: 2022, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'version'],
        ['unexpected version', { body: { version: 9999, year: 2022, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'version'],

        ['missing year', { body: { version: 1, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'year'],
        ['non-numeric year', { body: { version: 1, year: '2022', day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'year'],
        ['unexpected low year', { body: { version: 1, year: 1999, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'year'],
        ['unexpected high year', { body: { version: 1, year: 2100, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'year'],
        ['unexpected negative year', { body: { version: 1, year: -2022, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'year'],

        ['missing day', { body: { version: 1, year: 2022, part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'day'],
        ['non-numeric day', { body: { version: 1, year: 2022, day: '13', part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'day'],
        ['unexpected low day', { body: { version: 1, year: 2022, day: 0, part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'day'],
        ['unexpected high day', { body: { version: 1, year: 2022, day: 26, part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'day'],
        ['unexpected negative day', { body: { version: 1, year: 2022, day: -13, part: 2, name: 'FiRsT SeCoNdNaMe' } }, 'day'],

        ['missing part', { body: { version: 1, year: 2022, day: 13, name: 'FiRsT SeCoNdNaMe' } }, 'part'],
        ['non-numeric part', { body: { version: 1, year: 2022, day: 13, part: '2', name: 'FiRsT SeCoNdNaMe' } }, 'part'],
        ['unexpected low part', { body: { version: 1, year: 2022, day: 13, part: 0, name: 'FiRsT SeCoNdNaMe' } }, 'part'],
        ['unexpected high part', { body: { version: 1, year: 2022, day: 13, part: 3, name: 'FiRsT SeCoNdNaMe' } }, 'part'],
        ['unexpected negative part', { body: { version: 1, year: 2022, day: 13, part: -2, name: 'FiRsT SeCoNdNaMe' } }, 'part'],

        ['missing name', { body: { version: 1, year: 2022, day: 13, part: 2 } }, 'name'],
        ['non-string name', { body: { version: 1, year: 2022, day: 13, part: 2, name: 123 } }, 'name']
    ])('fails with %s', async (description, eventPart, errorMatch) => {
        eventPart.body = JSON.stringify(eventPart.body);
        const event = {
            resource: '/start',
            httpMethod: 'POST',
            ...eventPart
        };
        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 400,
            body: expect.stringMatching(errorMatch)
        });

        expect(times.onStartTime).not.toHaveBeenCalled();
    });

    test('returns correct error message for HTTP 400', async () => {
        const event = {
            resource: '/start',
            httpMethod: 'POST',
            requestContext: {
                domainName: 'dOmAiN.nAmE'
            },
            body: JSON.stringify({
                version: 9999,
                year: 2022,
                day: 13,
                part: 1,
                name: 'FiRsT SeCoNdNaMe'
            })
        };

        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 400,
            body: JSON.stringify({
                error: 'Bad Request',
                details: "Expecting 'version' parameter to be 1",
                usage: [
                    'POST https://dOmAiN.nAmE/start',
                    'body: {',
                    '    "version": 1,',
                    '    "year": 2022,',
                    '    "day": 13,',
                    '    "part": 1,',
                    '    "name": "John Smith"',
                    '}'
                ]
            })
        });
    });

    test('returns correct error message for HTTP 500', async () => {
        const event = {
            resource: '/start',
            httpMethod: 'POST',
            requestContext: {
                domainName: 'dOmAiN.nAmE'
            },
            body: JSON.stringify({
                version: 1,
                year: 2022,
                day: 13,
                part: 1,
                name: 'FiRsT SeCoNdNaMe'
            })
        };

        times.onStartTime.mockRejectedValueOnce(new ResultError(500, 'rEsUlT eRrOr 500'));

        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 500,
            body: JSON.stringify({
                error: 'rEsUlT eRrOr 500'
            })
        });
    });

    test.each([
        [1, 'a new', true, 201],
        [2, 'a new', true, 201],
        [1, 'an existing', false, 200],
        [2, 'an existing', false, 200]
    ])('works with name, part %s and %s record', async (part, _desciption, created, statusCode) => {
        times.onStartTime.mockResolvedValueOnce(created);

        const event = {
            resource: '/start',
            httpMethod: 'POST',
            body: JSON.stringify({
                version: 1,
                year: 2022,
                day: 13,
                part,
                name: 'FiRsT SeCoNdNaMe'
            })
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode });

        expect(times.onStartTime).toHaveBeenCalledWith(2022, 13, part, 'FiRsT SeCoNdNaMe', expect.any(Number));
    });
});
