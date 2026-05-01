import { handler, ResultError } from '../src/api.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getWebhookSecret } from '../src/secrets.js';
vi.mock(import('../src/secrets.js'));

import { onMyChatMember } from '../src/chat.js';
vi.mock(import('../src/chat.js'));

import { onChatMember } from '../src/member.js';
vi.mock(import('../src/member.js'));

import { onMessage } from '../src/message.js';
vi.mock(import('../src/message.js'));

import { onStart } from '../src/times.js';
vi.mock(import('../src/times.js'));

import { onStop } from '../src/leaderboards.js';
vi.mock(import('../src/leaderboards.js'));

beforeEach(() => {
    getWebhookSecret.mockReset();
    onMyChatMember.mockReset();
    onChatMember.mockReset();
    onMessage.mockReset();
    onStart.mockReset();
    onStop.mockReset();
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

        expect(getWebhookSecret).not.toHaveBeenCalled();
        expect(onMyChatMember).not.toHaveBeenCalled();
        expect(onMessage).not.toHaveBeenCalled();
    });

    test('rejects unknown resource path', async () => {
        const event = { resource: '/uNkNoWn', httpMethod: 'POST' };
        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 403,
            body: JSON.stringify({
                error: 'Forbidden',
                usage: [
                    'POST https://<hostname>/start',
                    'POST https://<hostname>/stop'
                ]
            })
        });

        expect(getWebhookSecret).not.toHaveBeenCalled();
        expect(onMyChatMember).not.toHaveBeenCalled();
        expect(onMessage).not.toHaveBeenCalled();
    });

    test('rejects unknown method for /telegram', async () => {
        const event = { resource: '/telegram', httpMethod: 'GET' };
        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 405,
            body: '{"error":"Method Not Allowed"}'
        });

        expect(onMyChatMember).not.toHaveBeenCalled();
        expect(onMessage).not.toHaveBeenCalled();
        expect(onStart).not.toHaveBeenCalled();
        expect(onStop).not.toHaveBeenCalled();
    });

    test.each(['/start', '/stop'])('rejects unknown method for %s', async (resource) => {
        const event = { resource, httpMethod: 'GET' };
        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 405,
            body: expect.stringMatching(/{"error":"Method Not Allowed","usage":\[.*\]}/)
        });

        expect(onMyChatMember).not.toHaveBeenCalled();
        expect(onMessage).not.toHaveBeenCalled();
        expect(onStart).not.toHaveBeenCalled();
        expect(onStop).not.toHaveBeenCalled();
    });
});

describe('POST /telegram API', () => {
    test('handles getWebhookSecret throwing', async () => {
        getWebhookSecret.mockRejectedValueOnce(new Error('sEcReTeRrOr'));

        const event = { resource: '/telegram', httpMethod: 'POST' };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 500, body: '{"error":"Internal Server Error"}' });

        expect(getWebhookSecret).toHaveBeenCalledWith();
        expect(onMyChatMember).not.toHaveBeenCalled();
        expect(onMessage).not.toHaveBeenCalled();
    });

    test('handles request with missing headers', async () => {
        getWebhookSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = { resource: '/telegram', httpMethod: 'POST' };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 401, body: '{"error":"Unauthorized"}' });

        expect(getWebhookSecret).toHaveBeenCalledWith();
        expect(onMyChatMember).not.toHaveBeenCalled();
        expect(onMessage).not.toHaveBeenCalled();
    });

    test('handles request with missing secret', async () => {
        getWebhookSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = { resource: '/telegram', httpMethod: 'POST', headers: {} };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 401, body: '{"error":"Unauthorized"}' });

        expect(getWebhookSecret).toHaveBeenCalledWith();
        expect(onMyChatMember).not.toHaveBeenCalled();
        expect(onMessage).not.toHaveBeenCalled();
    });

    test('handles request with invalid secret', async () => {
        getWebhookSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            headers: { 'X-Telegram-Bot-Api-Secret-Token': 'bAdSeCrEt' }
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 401, body: '{"error":"Unauthorized"}' });

        expect(getWebhookSecret).toHaveBeenCalledWith();
        expect(onMyChatMember).not.toHaveBeenCalled();
        expect(onMessage).not.toHaveBeenCalled();
    });

    test('handles onMyChatMember throwing', async () => {
        getWebhookSecret.mockResolvedValueOnce('gOoDsEcReT');
        onMyChatMember.mockRejectedValueOnce(new Error('uPdAtEeRrOr'));

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            headers: { 'X-Telegram-Bot-Api-Secret-Token': 'gOoDsEcReT' },
            body: '{"my_chat_member":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 500, body: '{"error":"Internal Server Error"}' });

        expect(getWebhookSecret).toHaveBeenCalledWith();
        expect(onMyChatMember).toHaveBeenCalledWith(true);
    });

    test('handles onChatMember throwing', async () => {
        getWebhookSecret.mockResolvedValueOnce('gOoDsEcReT');
        onChatMember.mockRejectedValueOnce(new Error('uPdAtEeRrOr'));

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            headers: { 'X-Telegram-Bot-Api-Secret-Token': 'gOoDsEcReT' },
            body: '{"chat_member":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 500, body: '{"error":"Internal Server Error"}' });

        expect(getWebhookSecret).toHaveBeenCalledWith();
        expect(onChatMember).toHaveBeenCalledWith(true);
    });

    test('handles onMessage throwing', async () => {
        getWebhookSecret.mockResolvedValueOnce('gOoDsEcReT');
        onMessage.mockRejectedValueOnce(new Error('uPdAtEeRrOr'));

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            headers: { 'X-Telegram-Bot-Api-Secret-Token': 'gOoDsEcReT' },
            body: '{"message":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 500, body: '{"error":"Internal Server Error"}' });

        expect(getWebhookSecret).toHaveBeenCalledWith();
        expect(onMessage).toHaveBeenCalledWith(true);
    });

    test('handles invalid payload', async () => {
        getWebhookSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            headers: { 'X-Telegram-Bot-Api-Secret-Token': 'gOoDsEcReT' },
            body: '$%^&'
        };
        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 400,
            body: '{"error":"Bad Request","details":"Invalid JSON syntax"}'
        });

        expect(getWebhookSecret).toHaveBeenCalledWith();
        expect(onMyChatMember).not.toHaveBeenCalled();
        expect(onMessage).not.toHaveBeenCalled();
    });

    test('processes an ignored update', async () => {
        getWebhookSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            headers: { 'X-Telegram-Bot-Api-Secret-Token': 'gOoDsEcReT' },
            body: '{"bOdY":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 201 });

        expect(getWebhookSecret).toHaveBeenCalledWith();
        expect(onMyChatMember).not.toHaveBeenCalled();
        expect(onMessage).not.toHaveBeenCalled();
    });

    test('processes plain payload', async () => {
        getWebhookSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            headers: { 'X-Telegram-Bot-Api-Secret-Token': 'gOoDsEcReT' },
            body: '{"message":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 201 });

        expect(getWebhookSecret).toHaveBeenCalledWith();
        expect(onMessage).toHaveBeenCalledWith(true);
    });

    test('processes base64 payload', async () => {
        getWebhookSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            headers: { 'X-Telegram-Bot-Api-Secret-Token': 'gOoDsEcReT' },
            isBase64Encoded: true,
            body: 'eyJtZXNzYWdlIjp0cnVlfQ=='        // {"message":true} encoded with base64
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 201 });

        expect(getWebhookSecret).toHaveBeenCalledWith();
        expect(onMessage).toHaveBeenCalledWith(true);
    });

    test('returns correct headers with successful request', async () => {
        getWebhookSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            headers: { 'X-Telegram-Bot-Api-Secret-Token': 'gOoDsEcReT' },
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

        expect(getWebhookSecret).toHaveBeenCalledWith();
        expect(onMessage).toHaveBeenCalledWith(true);
    });
});

describe.each(['/start', '/stop'])('OPTIONS %s API', (resource) => {
    test('works', async () => {
        const event = {
            resource,
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

describe.each([
    ['/start', onStart, [expect.any(Number)]],
    ['/stop', onStop, []]
])('POST %s API', (resource, eventHandler, eventExtraParams) => {
    test.each([
        ['missing body', {}, 'Invalid JSON syntax'],
        ['empty body', { body: '' }, 'Invalid JSON syntax'],
        ['wrong JSON', { body: ']' }, 'Invalid JSON syntax'],
        ['non-object JSON', { body: '0' }, 'Missing or invalid request body']
    ])('fails with %s', async (description, eventPart, errorMatch) => {
        const event = {
            resource,
            httpMethod: 'POST',
            ...eventPart
        };
        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 400,
            body: expect.stringMatching(errorMatch)
        });

        expect(onStart).not.toHaveBeenCalled();
        expect(onStop).not.toHaveBeenCalled();
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
            resource,
            httpMethod: 'POST',
            ...eventPart
        };
        await expect(handler(event)).resolves.toMatchObject({
            statusCode: 400,
            body: expect.stringMatching(errorMatch)
        });

        expect(onStart).not.toHaveBeenCalled();
        expect(onStop).not.toHaveBeenCalled();
    });

    test('returns correct error message for HTTP 400', async () => {
        const event = {
            resource,
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
                    `POST https://dOmAiN.nAmE${resource}`,
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
            resource,
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

        eventHandler.mockRejectedValueOnce(new ResultError(500, 'rEsUlT eRrOr 500'));

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
    ])('works with name, part %s and %s record', async (part, _description, created, statusCode) => {
        eventHandler.mockResolvedValueOnce(created);

        const event = {
            resource,
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

        expect(eventHandler).toHaveBeenCalledWith(2022, 13, part, 'FiRsT SeCoNdNaMe', ...eventExtraParams);
    });
});
