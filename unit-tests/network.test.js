'use strict';

const { getLeaderboard, sendTelegram } = require('../src/network');

global.fetch = jest.fn();

const secrets = require('../src/secrets');
jest.mock('../src/secrets');

beforeEach(() => {
    fetch.mockReset();
});

describe('getLeaderboard', () => {
    test('downloads AoC data', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => ({ fAkEaOcDaTa: true })
        });
        secrets.getAdventOfCodeSecret.mockResolvedValueOnce('aOcSeCrEt');

        await expect(getLeaderboard(1492)).resolves.toEqual({ fAkEaOcDaTa: true });

        expect(secrets.getAdventOfCodeSecret).toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledWith(
            'https://adventofcode.com/1492/leaderboard/private/view/380635.json',
            { headers: { Cookie: 'session=aOcSeCrEt' } }
        );
    });

    test('fails on missing secret', async () => {
        secrets.getAdventOfCodeSecret.mockRejectedValueOnce(new Error('sEcReTeRrOr'));

        await expect(() => getLeaderboard(1492)).rejects.toThrow('sEcReTeRrOr');

        expect(secrets.getAdventOfCodeSecret).toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    test('loads an empty leaderboard when leaderboard returns HTML', async () => {
        // This happens when you have a valid but expired session cookie
        fetch.mockResolvedValueOnce({
            ok: true,
            headers: { get: () => 'text/html' },
            text: async () => '<!DOCTYPE html>\n<html lang="en-us">\n</html>'
        });
        secrets.getAdventOfCodeSecret.mockResolvedValueOnce('aOcSeCrEt');

        await expect(getLeaderboard(1492)).resolves.toBeUndefined();

        expect(secrets.getAdventOfCodeSecret).toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledWith(
            'https://adventofcode.com/1492/leaderboard/private/view/380635.json',
            { headers: { Cookie: 'session=aOcSeCrEt' } }
        );
    });

    test('loads an empty leaderboard on HTTP error', async () => {
        fetch.mockResolvedValueOnce({ ok: false });
        secrets.getAdventOfCodeSecret.mockResolvedValueOnce('aOcSeCrEt');

        await expect(getLeaderboard(1492)).resolves.toBeUndefined();

        expect(secrets.getAdventOfCodeSecret).toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledWith(
            'https://adventofcode.com/1492/leaderboard/private/view/380635.json',
            { headers: { Cookie: 'session=aOcSeCrEt' } }
        );
    });

    test('fails on non-HTTP error', async () => {
        fetch.mockRejectedValueOnce(new Error('nOnHtTpErRoR'));
        secrets.getAdventOfCodeSecret.mockResolvedValueOnce('aOcSeCrEt');

        await expect(() => getLeaderboard(1492)).rejects.toThrow('nOnHtTpErRoR');

        expect(secrets.getAdventOfCodeSecret).toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledWith(
            'https://adventofcode.com/1492/leaderboard/private/view/380635.json',
            { headers: { Cookie: 'session=aOcSeCrEt' } }
        );
    });
});

describe('sendTelegram', () => {
    test('sends a form data request', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ fAkEtElEgRaMdAtA: true })
        });
        secrets.getTelegramSecret.mockResolvedValueOnce('tElEgRaMsEcReT');

        await expect(sendTelegram('aPi', { dAtA: true }, 'multipart/form-data')).resolves.toEqual({ fAkEtElEgRaMdAtA: true });

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/aPi', {
                method: 'POST',
                body: expect.any(FormData)
            }
        );
    });

    test('sends a JSON request', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ fAkEtElEgRaMdAtA: true })
        });
        secrets.getTelegramSecret.mockResolvedValueOnce('tElEgRaMsEcReT');

        await expect(sendTelegram('aPi', { dAtA: true })).resolves.toEqual({ fAkEtElEgRaMdAtA: true });

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/aPi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dAtA: true })
            }
        );
    });

    test('sends a request without data', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ fAkEtElEgRaMdAtA: true })
        });
        secrets.getTelegramSecret.mockResolvedValueOnce('tElEgRaMsEcReT');

        await expect(sendTelegram('aPi', undefined)).resolves.toEqual({ fAkEtElEgRaMdAtA: true });

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/aPi', {
                method: 'POST'
            }
        );
    });

    test('fails on missing secret', async () => {
        secrets.getTelegramSecret.mockRejectedValueOnce(new Error('sEcReTeRrOr'));

        await expect(() => sendTelegram('aPi', { dAtA: true })).rejects.toThrow('sEcReTeRrOr');

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    test('fails on unsupported content type', async () => {
        secrets.getTelegramSecret.mockResolvedValueOnce('tElEgRaMsEcReT');

        await expect(() => sendTelegram('aPi', { dAtA: true }, 'bAdCoNtEnTtYpE')).rejects.toThrow(
            new Error('Unsupported content type: bAdCoNtEnTtYpE'));

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
    });

    test('fails on HTTP error', async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 987,
            json: async () => ({ error_code: 34567, description: 'tElEgRaMdEsCrIpTiOn' })
        });
        secrets.getTelegramSecret.mockResolvedValueOnce('tElEgRaMsEcReT');

        await expect(() => sendTelegram('aPi', { dAtA: true })).rejects.toEqual(expect.objectContaining({
            message: 'Telegram request failed with status 987',
            isTelegramError: true,
            telegram_error_code: 34567,
            telegram_description: 'tElEgRaMdEsCrIpTiOn'
        }));

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(fetch).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/aPi',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dAtA: true })
            }
        );
    });
});
