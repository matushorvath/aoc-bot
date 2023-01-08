'use strict';

const { handler } = require('../src/api');

const secrets = require('../src/secrets');
jest.mock('../src/secrets');

const telegram = require('../src/telegram');
jest.mock('../src/telegram');

beforeEach(() => {
    secrets.getTelegramSecret.mockReset();
    telegram.onTelegramUpdate.mockReset();
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

    test('rejects unknown method', async () => {
        const event = { resource: '/telegram', httpMethod: 'GET' };
        await expect(handler(event)).resolves.toMatchObject({ statusCode: 405, body: '{"error":"Method Not Allowed"}' });

        expect(secrets.getTelegramSecret).not.toHaveBeenCalled();
        expect(telegram.onTelegramUpdate).not.toHaveBeenCalled();
    });

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
