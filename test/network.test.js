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
        axios.get.mockResolvedValueOnce({ data: { fAkEaOcDaTa: true } });
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

    test('fails on HTTP error', async () => {
        axios.get.mockRejectedValueOnce(new Error('aXiOsErRoR'));
        secrets.getAdventOfCodeSecret.mockResolvedValueOnce('aOcSeCrEt');

        await expect(getLeaderboard(1492)).rejects.toThrow('aXiOsErRoR');

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

        await expect(sendTelegram('aPi', { pAramS: true })).resolves.toEqual({ fAkEtElEgRaMdAtA: true });

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(axios.post).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/aPi', { pAramS: true }
        );
    });

    test('sends a request without params', async () => {
        axios.post.mockResolvedValueOnce({ data: { fAkEtElEgRaMdAtA: true } });
        secrets.getTelegramSecret.mockResolvedValueOnce('tElEgRaMsEcReT');

        await expect(sendTelegram('aPi')).resolves.toEqual({ fAkEtElEgRaMdAtA: true });

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(axios.post).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/aPi', {}
        );
    });

    test('fails on missing secret', async () => {
        secrets.getTelegramSecret.mockRejectedValueOnce(new Error('sEcReTeRrOr'));

        await expect(sendTelegram('aPi', { pAramS: true })).rejects.toThrow('sEcReTeRrOr');

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('fails on HTTP error', async () => {
        axios.post.mockRejectedValueOnce(new Error('aXiOsErRoR'));
        secrets.getTelegramSecret.mockResolvedValueOnce('tElEgRaMsEcReT');

        await expect(sendTelegram('aPi', { pAramS: true })).rejects.toThrow('aXiOsErRoR');

        expect(secrets.getTelegramSecret).toHaveBeenCalled();
        expect(axios.post).toHaveBeenCalledWith(
            'https://api.telegram.org/bottElEgRaMsEcReT/aPi', { pAramS: true }
        );
    });
});