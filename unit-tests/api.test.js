'use strict';

const { handler } = require('../src/api');

const secrets = require('../src/secrets');
jest.mock('../src/secrets');

const telegram = require('../src/telegram');
jest.mock('../src/telegram');

const times = require('../src/times');
jest.mock('../src/times');

beforeEach(() => {
    secrets.getTelegramSecret.mockReset();
    telegram.onTelegramUpdate.mockReset();
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
                'Content-Type': 'application/json'
            }
        });

        expect(secrets.getTelegramSecret).not.toHaveBeenCalled();
        expect(telegram.onTelegramUpdate).not.toHaveBeenCalled();
    });

    test('rejects unknown resource path', async () => {
        const event = { resource: '/uNkNoWn', httpMethod: 'POST' };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 403, body: '{"error":"Forbidden"}' });

        expect(secrets.getTelegramSecret).not.toHaveBeenCalled();
        expect(telegram.onTelegramUpdate).not.toHaveBeenCalled();
    });

    test.each(['/telegram', '/start'])('rejects unknown method for %s', async (resource) => {
        const event = { resource, httpMethod: 'GET' };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 405, body: '{"error":"Method Not Allowed"}' });

        expect(telegram.onTelegramUpdate).not.toHaveBeenCalled();
        expect(times.onStartTime).not.toHaveBeenCalled();
    });
});

describe('POST /telegram API', () => {
    test('handles getTelegramSecret throwing', async () => {
        secrets.getTelegramSecret.mockRejectedValueOnce(new Error('sEcReTeRrOr'));

        const event = { resource: '/telegram', httpMethod: 'POST' };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 500, body: '{"error":"Internal Server Error"}' });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(telegram.onTelegramUpdate).not.toHaveBeenCalled();
    });

    test('handles request with missing secret', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = { resource: '/telegram', httpMethod: 'POST', queryStringParameters: {} };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 401, body: '{"error":"Unauthorized"}' });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(telegram.onTelegramUpdate).not.toHaveBeenCalled();
    });

    test('handles request with invalid secret', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = { resource: '/telegram', httpMethod: 'POST', queryStringParameters: { bAdSeCrEt: '' } };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 401, body: '{"error":"Unauthorized"}' });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(telegram.onTelegramUpdate).not.toHaveBeenCalled();
    });

    test('handles onTelegramUpdate throwing', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');
        telegram.onTelegramUpdate.mockRejectedValueOnce(new Error('uPdAtEeRrOr'));

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            queryStringParameters: { gOoDsEcReT: '' },
            body: '{"bOdY":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 500, body: '{"error":"Internal Server Error"}' });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(telegram.onTelegramUpdate).toHaveBeenCalledWith({ bOdY: true });
    });

    test('processes plain payload', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            queryStringParameters: { gOoDsEcReT: '' },
            body: '{"bOdY":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 201 });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(telegram.onTelegramUpdate).toHaveBeenCalledWith({ bOdY: true });
    });

    test('processes base64 payload', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            queryStringParameters: { gOoDsEcReT: '' },
            isBase64Encoded: true,
            body: 'eyJiT2RZIjp0cnVlfQ=='
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 201 });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(telegram.onTelegramUpdate).toHaveBeenCalledWith({ bOdY: true });
    });

    test('returns correct headers with successful request', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('gOoDsEcReT');

        const event = {
            resource: '/telegram', httpMethod: 'POST',
            queryStringParameters: { gOoDsEcReT: '' },
            isBase64Encoded: false,
            body: '{"bOdY":true}'
        };
        await expect(handler(event)).resolves.toMatchObject({
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                Expires: 0,
                Pragma: 'no-cache',
                'Surrogate-Control': 'no-store'
            }
        });

        expect(secrets.getTelegramSecret).toHaveBeenCalledWith();
        expect(telegram.onTelegramUpdate).toHaveBeenCalledWith({ bOdY: true });
    });
});

describe('POST /start API', () => {
    test.each([
        ['missing body', {}],
        ['empty body', { body: {} }],

        ['missing version', { body: { year: 2022, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }],
        ['non-numeric version', { body: { version: '1', year: 2022, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }],
        ['unexpected version', { body: { version: 3, year: 2022, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }],

        ['missing year', { body: { version: 1, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }],
        ['non-numeric year', { body: { version: 1, year: '2022', day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }],
        ['unexpected low year', { body: { version: 1, year: 1999, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }],
        ['unexpected high year', { body: { version: 1, year: 2100, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }],
        ['unexpected negative year', { body: { version: 1, year: -2022, day: 13, part: 2, name: 'FiRsT SeCoNdNaMe' } }],

        ['missing day', { body: { version: 1, year: 2022, part: 2, name: 'FiRsT SeCoNdNaMe' } }],
        ['non-numeric day', { body: { version: 1, year: 2022, day: '13', part: 2, name: 'FiRsT SeCoNdNaMe' } }],
        ['unexpected low day', { body: { version: 1, year: 2022, day: 0, part: 2, name: 'FiRsT SeCoNdNaMe' } }],
        ['unexpected high day', { body: { version: 1, year: 2022, day: 26, part: 2, name: 'FiRsT SeCoNdNaMe' } }],
        ['unexpected negative day', { body: { version: 1, year: 2022, day: -13, part: 2, name: 'FiRsT SeCoNdNaMe' } }],

        ['missing part', { body: { version: 1, year: 2022, day: 13, name: 'FiRsT SeCoNdNaMe' } }],
        ['non-numeric part', { body: { version: 1, year: 2022, day: 13, part: '2', name: 'FiRsT SeCoNdNaMe' } }],
        ['unexpected low part', { body: { version: 1, year: 2022, day: 13, part: 0, name: 'FiRsT SeCoNdNaMe' } }],
        ['unexpected high part', { body: { version: 1, year: 2022, day: 13, part: 3, name: 'FiRsT SeCoNdNaMe' } }],
        ['unexpected negative part', { body: { version: 1, year: 2022, day: 13, part: -2, name: 'FiRsT SeCoNdNaMe' } }],

        ['missing name', { body: { version: 1, year: 2022, day: 13, part: 2 } }],
        ['non-string name', { body: { version: 1, year: 2022, day: 13, part: 2, name: 123 } }]
    ])('fails with %s', async (description, eventPart) => {
        const event = {
            resource: '/start',
            httpMethod: 'POST',
            ...eventPart
        };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 400 });

        expect(times.onStartTime).not.toHaveBeenCalled();
    });

    test.each([1, 2])('works with name and part %s', async (part) => {
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
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 201 });

        expect(times.onStartTime).toHaveBeenCalledWith(2022, 13, part, 'FiRsT SeCoNdNaMe', expect.any(Number));
    });
});
