'use strict';

const register = require('../src/register');

global.fetch = jest.fn();

beforeEach(() => {
    fetch.mockReset();
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

    test('fails when fetch throws from first getWebhookInfo', async () => {
        fetch.mockRejectedValueOnce(Error('fEtChErRoR')); // getWebhookInfo

        await expect(() => register.register(secrets, data)).rejects.toMatchObject(Error('fEtChErRoR'));

        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    });

    test('fails with a non-ok response from first getWebhookInfo', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false }) }); // getWebhookInfo

        await expect(() => register.register(secrets, data)).rejects.toMatchObject(Error('Telegram request failed'));

        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    });

    test('fails when fetch throws from setWebhook', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, result: {} }) }); // getWebhookInfo
        fetch.mockRejectedValueOnce(Error('fEtChErRoR')); // setWebhook

        await expect(() => register.register(secrets, data)).rejects.toMatchObject(Error('fEtChErRoR'));

        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/setWebhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(setWebhookPayload)
            }
        );
    });

    test('fails with a non-ok response from setWebhook', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, result: {} }) }); // getWebhookInfo
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false }) }); // setWebhook

        await expect(() => register.register(secrets, data)).rejects.toMatchObject(Error('Telegram request failed'));

        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/setWebhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(setWebhookPayload)
            }
        );
    });

    test('fails when fetch throws from second getWebhookInfo', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, result: {} }) }); // getWebhookInfo
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }); // setWebhook
        fetch.mockRejectedValueOnce(Error('fEtChErRoR')); // getWebhookInfo

        await expect(() => register.register(secrets, data)).rejects.toMatchObject(Error('fEtChErRoR'));

        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/setWebhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(setWebhookPayload)
            }
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    });

    test('fails with a non-ok response from second getWebhookInfo', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, result: {} }) }); // getWebhookInfo
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }); // setWebhook
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: false }) }); // getWebhookInfo

        await expect(() => register.register(secrets, data)).rejects.toMatchObject(Error('Telegram request failed'));

        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/setWebhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(setWebhookPayload)
            }
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
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
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, result }) }); // getWebhookInfo
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }); // setWebhook
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }); // getWebhookInfo

        await expect(register.register(secrets, data)).resolves.toBeUndefined();

        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/setWebhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(setWebhookPayload)
            }
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    });

    test.each([
        ['matching data', { url: 'nEwUrL', allowed_updates: ['nEwUpDaTe2', 'nEwUpDaTe1', 'nEwUpDaTe3'] }],
        ['allowed_updates in different order', { url: 'nEwUrL', allowed_updates: ['nEwUpDaTe1', 'nEwUpDaTe2', 'nEwUpDaTe3'] }]
    ])('skips registration with %s from telegram', async (_desc, result) => {
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, result }) }); // getWebhookInfo

        await expect(register.register(secrets, data)).resolves.toBeUndefined();

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
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
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, result: {} }) }); // getWebhookInfo
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }); // setWebhook
        fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }); // getWebhookInfo

        await expect(register.main()).resolves.toBeUndefined();

        const payload = {
            allowed_updates: ['chat_member', 'message', 'my_chat_member'],
            drop_pending_updates: true,
            secret_token: 'mAiNwEbHoOkSeCrEt',
            url: 'mAiNuRl'
        };

        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/botmAiNtElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/botmAiNtElEgRaMsEcReT/setWebhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/botmAiNtElEgRaMsEcReT/getWebhookInfo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    });
});
