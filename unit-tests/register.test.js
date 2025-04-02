'use strict';

const register = require('../src/register');

const axios = require('axios');
jest.mock('axios');

beforeEach(() => {
    axios.post.mockReset();
});

describe('webhook registration', () => {
    const secrets = {
        telegramSecret: 'tElEgRaMsEcReT',
        webhookSecret: 'wEbHoOkSeCrEt'
    };

    const data = {
        url: 'nEwUrL',
        allowedUpdates: ['nEwUpDaTe2', 'nEwUpDaTe1', 'nEwUpDaTe3']
    };

    const setWebhookPayload = {
        allowed_updates: data.allowedUpdates,
        drop_pending_updates: true,
        secret_token: secrets.webhookSecret,
        url: data.url
    };

    test('fails when axios throws from first getWebhookInfo', async () => {
        axios.post.mockRejectedValueOnce(Error('aXiOsErRoR')); // getWebhookInfo

        await expect(() => register.register(secrets, data)).rejects.toMatchObject(Error('aXiOsErRoR'));

        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
    });

    test('fails with a non-ok response from first getWebhookInfo', async () => {
        axios.post.mockResolvedValueOnce({ data: { ok: false } }); // getWebhookInfo

        await expect(() => register.register(secrets, data)).rejects.toMatchObject(Error('Telegram request failed'));

        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
    });

    test('fails when axios throws from setWebhook', async () => {
        axios.post.mockResolvedValueOnce({ data: { ok: true, result: {} } }); // getWebhookInfo
        axios.post.mockRejectedValueOnce(Error('aXiOsErRoR')); // setWebhook

        await expect(() => register.register(secrets, data)).rejects.toMatchObject(Error('aXiOsErRoR'));

        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/setWebhook', setWebhookPayload, undefined);
    });

    test('fails with a non-ok response from setWebhook', async () => {
        axios.post.mockResolvedValueOnce({ data: { ok: true, result: {} } }); // getWebhookInfo
        axios.post.mockResolvedValueOnce({ data: { ok: false } }); // setWebhook

        await expect(() => register.register(secrets, data)).rejects.toMatchObject(Error('Telegram request failed'));

        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/setWebhook', setWebhookPayload, undefined);
    });

    test('fails when axios throws from second getWebhookInfo', async () => {
        axios.post.mockResolvedValueOnce({ data: { ok: true, result: {} } }); // getWebhookInfo
        axios.post.mockResolvedValueOnce({ data: { ok: true } }); // setWebhook
        axios.post.mockRejectedValueOnce(Error('aXiOsErRoR')); // getWebhookInfo

        await expect(() => register.register(secrets, data)).rejects.toMatchObject(Error('aXiOsErRoR'));

        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/setWebhook', setWebhookPayload, undefined);
        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
    });

    test('fails with a non-ok response from second getWebhookInfo', async () => {
        axios.post.mockResolvedValueOnce({ data: { ok: true, result: {} } }); // getWebhookInfo
        axios.post.mockResolvedValueOnce({ data: { ok: true } }); // setWebhook
        axios.post.mockResolvedValueOnce({ data: { ok: false } }); // getWebhookInfo

        await expect(() => register.register(secrets, data)).rejects.toMatchObject(Error('Telegram request failed'));

        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/setWebhook', setWebhookPayload, undefined);
        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
    });

    test.each([
        ['an empty response', {}],
        ['a missing url', { allowed_updates: ['nEwUpDaTe2', 'nEwUpDaTe1', 'nEwUpDaTe3'] }],
        ['an empty url', { url: '', allowed_updates: ['nEwUpDaTe2', 'nEwUpDaTe1', 'nEwUpDaTe3'] }],
        ['a different url', { url: 'oLdUrL', allowed_updates: ['nEwUpDaTe2', 'nEwUpDaTe1', 'nEwUpDaTe3'] }],
        ['missing allowed_updates', { url: 'nEwUrL' }],
        ['empty allowed_updates', { url: 'nEwUrL', allowed_updates: [] }],
        ['one different value in allowed_updates', { url: 'nEwUrL', allowed_updates: ['nEwUpDaTe2', 'oLdUpDaTe1', 'nEwUpDaTe3'] }],
        ['one missing value in allowed_updates', { url: 'nEwUrL', allowed_updates: ['nEwUpDaTe2', 'nEwUpDaTe3'] }],
        ['one extra value in allowed_updates', { url: 'nEwUrL', allowed_updates: ['nEwUpDaTe2', 'oLdUpDaTe4', 'nEwUpDaTe1', 'nEwUpDaTe3'] }]
    ])('registers with %s from telegram', async (_desc, result) => {
        axios.post.mockResolvedValueOnce({ data: { ok: true, result } }); // getWebhookInfo
        axios.post.mockResolvedValueOnce({ data: { ok: true } }); // setWebhook
        axios.post.mockResolvedValueOnce({ data: { ok: true } }); // getWebhookInfo

        await expect(register.register(secrets, data)).resolves.toBeUndefined();

        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/setWebhook', setWebhookPayload, undefined);
        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
    });

    test.each([
        ['matching data', { url: 'nEwUrL', allowed_updates: ['nEwUpDaTe2', 'nEwUpDaTe1', 'nEwUpDaTe3'] }],
        ['allowed_updates in different order', { url: 'nEwUrL', allowed_updates: ['nEwUpDaTe1', 'nEwUpDaTe2', 'nEwUpDaTe3'] }]
    ])('skips registration with %s from telegram', async (_desc, result) => {
        axios.post.mockResolvedValueOnce({ data: { ok: true, result } }); // getWebhookInfo

        await expect(register.register(secrets, data)).resolves.toBeUndefined();

        expect(axios.post).toHaveBeenCalledTimes(1);
        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
    });
});

describe('main function', () => {
    let savedTS, savedWS, savedARGV;

    beforeEach(() => {
        savedTS = process.env.TELEGRAM_SECRET;
        delete process.env.TELEGRAM_SECRET;
        savedWS = process.env.WEBHOOK_SECRET;
        delete process.env.WEBHOOK_SECRET;
        savedARGV = process.argv;
        delete process.argv;
    });

    afterEach(() => {
        process.env.TELEGRAM_SECRET = savedTS;
        process.env.WEBHOOK_SECRET = savedWS;
        process.argv = savedARGV;
    });

    test('fails without a TELEGRAM_SECRET', async () => {
        process.env.WEBHOOK_SECRET = 'mAiNwEbHoOkSeCrEt';
        process.argv = ['node', 'register.js', 'mAiNuRl'];
        await expect(() => register.main()).rejects.toMatchObject(Error('You need to set the TELEGRAM_SECRET environment variable'));
    });

    test('fails without a WEBHOOK_SECRET', async () => {
        process.env.TELEGRAM_SECRET = 'mAiNtElEgRaMsEcReT';
        process.argv = ['node', 'register.js', 'mAiNuRl'];
        await expect(() => register.main()).rejects.toMatchObject(Error('You need to set the WEBHOOK_SECRET environment variable'));
    });

    test('fails without arguments', async () => {
        process.env.TELEGRAM_SECRET = 'mAiNtElEgRaMsEcReT';
        process.env.WEBHOOK_SECRET = 'mAiNwEbHoOkSeCrEt';
        process.argv = ['node', 'register.js'];
        await expect(() => register.main()).rejects.toMatchObject(Error('Usage: node register.js <url>'));
    });

    test('registers with correct arguments', async () => {
        process.env.TELEGRAM_SECRET = 'mAiNtElEgRaMsEcReT';
        process.env.WEBHOOK_SECRET = 'mAiNwEbHoOkSeCrEt';
        process.argv = ['node', 'register.js', 'mAiNuRl'];

        // The simplest mocks to allow us to inspect the setWebhook payload
        axios.post.mockResolvedValueOnce({ data: { ok: true, result: {} } }); // getWebhookInfo
        axios.post.mockResolvedValueOnce({ data: { ok: true } }); // setWebhook
        axios.post.mockResolvedValueOnce({ data: { ok: true } }); // getWebhookInfo

        await expect(register.main()).resolves.toBeUndefined();

        const payload = {
            allowed_updates: ['chat_member', 'message', 'my_chat_member'],
            drop_pending_updates: true,
            secret_token: 'mAiNwEbHoOkSeCrEt',
            url: 'mAiNuRl'
        };

        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/botmAiNtElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/botmAiNtElEgRaMsEcReT/setWebhook', payload, undefined);
        expect(axios.post).toHaveBeenCalledWith('https://api.telegram.org/botmAiNtElEgRaMsEcReT/getWebhookInfo', undefined, undefined);
    });
});
