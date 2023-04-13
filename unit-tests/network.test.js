'use strict';

const { getLeaderboard, sendTelegram } = require('../src/network');

const axios = require('axios');
jest.mock('axios');

const secrets = require('../src/secrets');
jest.mock('../src/secrets');

beforeEach(() => {
    axios.get.mockReset();
    axios.post.mockReset();
});

describe('getLeaderboard', () => {
    test('downloads AoC data', async () => {
        axios.get.mockResolvedValueOnce({
            headers: { 'content-type': 'application/json' },
            data: { fAkEaOcDaTa: true }
        });
        secrets.getAdventOfCodeSecret.mockResolvedValueOnce('aOcSeCrEt');

        await expect(getLeaderboard(1492)).resolves.toEqual({ fAkEaOcDaTa: true });

        expect(secrets.getAdventOfCodeSecret).toHaveBeenCalled();
        expect(axios.get).toHaveBeenCalledWith(
            'https://adventofcode.com/1492/leaderboard/private/view/380635.json',
            { headers: { Cookie: 'session=aOcSeCrEt' } }
        );
    });

    test('fails on missing secret', async () => {
        secrets.getAdventOfCodeSecret.mockRejectedValueOnce(new Error('sEcReTeRrOr'));

        await expect(getLeaderboard(1492)).rejects.toThrow('sEcReTeRrOr');

        expect(secrets.getAdventOfCodeSecret).toHaveBeenCalled();
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('loads an empty leaderboard when leaderboard returns HTML', async () => {
        // This happens when you have a valid but expired session cookie
        axios.get.mockResolvedValueOnce({
            headers: { 'content-type': 'text/html' },
            data: '<!DOCTYPE html>\n<html lang="en-us">\n</html>'
        });
        secrets.getAdventOfCodeSecret.mockResolvedValueOnce('aOcSeCrEt');

        await expect(getLeaderboard(1492)).resolves.toBeUndefined();

        expect(secrets.getAdventOfCodeSecret).toHaveBeenCalled();
        expect(axios.get).toHaveBeenCalledWith(
            'https://adventofcode.com/1492/leaderboard/private/view/380635.json',
            { headers: { Cookie: 'session=aOcSeCrEt' } }
        );
    });

    test('loads an empty leaderboard on HTTP error', async () => {
        axios.get.mockRejectedValueOnce({ isAxiosError: true });
        secrets.getAdventOfCodeSecret.mockResolvedValueOnce('aOcSeCrEt');

        await expect(getLeaderboard(1492)).resolves.toBeUndefined();

        expect(secrets.getAdventOfCodeSecret).toHaveBeenCalled();
        expect(axios.get).toHaveBeenCalledWith(
            'https://adventofcode.com/1492/leaderboard/private/view/380635.json',
            { headers: { Cookie: 'session=aOcSeCrEt' } }
        );
    });

    test('fails on non-HTTP error', async () => {
        axios.get.mockRejectedValueOnce(new Error('nOnHtTpErRoR'));
        secrets.getAdventOfCodeSecret.mockResolvedValueOnce('aOcSeCrEt');

        await expect(getLeaderboard(1492)).rejects.toThrow('nOnHtTpErRoR');

        expect(secrets.getAdventOfCodeSecret).toHaveBeenCalled();
        expect(axios.get).toHaveBeenCalledWith(
            'https://adventofcode.com/1492/leaderboard/private/view/380635.json',
            { headers: { Cookie: 'session=aOcSeCrEt' } }
        );
    });
});

describe('sendTelegram', () => {
    test('sends a request', async () => {
        axios.post.mockResolvedValueOnce({ data: { fAkEtElEgRaMdAtA: true } });
        secrets.getTelegramSecret.mockResolvedValueOnce('tElEgRaMsEcReT');

        await expect(sendTelegram('aPi', { dAtA: true }, { cOnFiG: true })).resolves.toEqual({ fAkEtElEgRaMdAtA: true });

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(axios.post).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/aPi', { dAtA: true }, { cOnFiG: true }
        );
    });

    test('sends a request without config', async () => {
        axios.post.mockResolvedValueOnce({ data: { fAkEtElEgRaMdAtA: true } });
        secrets.getTelegramSecret.mockResolvedValueOnce('tElEgRaMsEcReT');

        await expect(sendTelegram('aPi', { dAtA: true })).resolves.toEqual({ fAkEtElEgRaMdAtA: true });

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(axios.post).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/aPi', { dAtA: true }, undefined
        );
    });

    test('fails on missing secret', async () => {
        secrets.getTelegramSecret.mockRejectedValueOnce(new Error('sEcReTeRrOr'));

        await expect(sendTelegram('aPi', { dAtA: true })).rejects.toThrow('sEcReTeRrOr');

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('fails on HTTP error', async () => {
        axios.post.mockRejectedValueOnce(new Error('aXiOsErRoR'));
        secrets.getTelegramSecret.mockResolvedValueOnce('tElEgRaMsEcReT');

        await expect(sendTelegram('aPi', { dAtA: true })).rejects.toThrow('aXiOsErRoR');

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(axios.post).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/aPi', { dAtA: true }, undefined
        );
    });
});
