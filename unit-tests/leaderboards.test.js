import { handler, onStop, updateLeaderboards } from '../src/leaderboards.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { processInvites } from '../src/invites.js';
vi.mock(import('../src/invites.js'));

import { getLeaderboard } from '../src/network.js';
vi.mock(import('../src/network.js'));

import { publishBoards } from '../src/publish.js';
vi.mock(import('../src/publish.js'));

import { getYears } from '../src/years.js';
vi.mock(import('../src/years.js'));

import { logActivity } from '../src/logs.js';
vi.mock(import('../src/logs.js'));

import { getAdventOfCodeSecret, getTelegramSecret } from '../src/secrets.js';
vi.mock(import('../src/secrets.js'));

beforeEach(() => {
    getLeaderboard.mockReset();
    processInvites.mockReset();
    publishBoards.mockReset();
    getYears.mockReset();
    logActivity.mockReset();
    getAdventOfCodeSecret.mockReset();
    getTelegramSecret.mockReset();
});

describe('onStop', () => {
    test('triggers leaderboard update', async () => {
        getYears.mockResolvedValueOnce(new Set());

        await expect(onStop(1945, 11, 2, 'sOmE oNe')).resolves.toBe(false);
    });

    test('reports invitation sent to this user', async () => {
        getYears.mockResolvedValueOnce(new Set([1945]));

        getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });
        processInvites.mockResolvedValueOnce({ sent: [{ aocUser: 'sOmE oNe', year: 1945, day: 11 }], failed: [] });
        publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(onStop(1945, 11, 2, 'sOmE oNe')).resolves.toBe(true);
    });

    test('reports invitation not sent to this user', async () => {
        getYears.mockResolvedValueOnce(new Set([1945]));

        getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });
        processInvites.mockResolvedValueOnce({ sent: [{ aocUser: 'aNoThEr OnE', year: 1945, day: 11 }], failed: [] });
        publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(onStop(1945, 11, 2, 'sOmE oNe')).resolves.toBe(false);
    });

    test('fails after an error while updating leaderboards', async () => {
        getYears.mockRejectedValueOnce(new Error('sOmEeRrOr'));
        await expect(() => onStop(1945, 11, 2, 'sOmE oNe')).rejects.toThrow('sOmEeRrOr');
    });
});

describe('leaderboards.handler', () => {
    test('succeeds updating the leaderboard', async () => {
        getYears.mockResolvedValueOnce(new Set([2021, 2020]));

        getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });
        getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        publishBoards.mockResolvedValueOnce({ created: [], updated: [] });
        publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(handler()).resolves.toBeUndefined();

        expect(getYears).toHaveBeenCalledTimes(1);

        expect(getLeaderboard).toHaveBeenCalledTimes(2);
        expect(getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(processInvites).toHaveBeenCalledTimes(2);
        expect(processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, {});
        expect(processInvites).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, {});

        expect(publishBoards).toHaveBeenCalledTimes(2);
        expect(publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, {});
        expect(publishBoards).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, {});

        expect(logActivity).not.toHaveBeenCalled();
    });

    test('fails loading years', async () => {
        getYears.mockRejectedValueOnce(new Error('gEtYeArSeRrOr'));

        await expect(() => handler()).rejects.toThrow('gEtYeArSeRrOr');

        expect(getYears).toHaveBeenCalledTimes(1);
        expect(getLeaderboard).not.toHaveBeenCalled();

        expect(processInvites).not.toHaveBeenCalled();
        expect(publishBoards).not.toHaveBeenCalled();
        expect(logActivity).not.toHaveBeenCalled();
    });

    test('loads no years', async () => {
        getYears.mockResolvedValueOnce(new Set());

        await expect(handler()).resolves.toBeUndefined();

        expect(getYears).toHaveBeenCalledTimes(1);

        expect(getLeaderboard).not.toHaveBeenCalled();
        expect(processInvites).not.toHaveBeenCalled();
        expect(publishBoards).not.toHaveBeenCalled();
        expect(logActivity).not.toHaveBeenCalled();
    });

    test('fails loading the leaderboard', async () => {
        getYears.mockResolvedValueOnce(new Set([2021, 2020]));
        getLeaderboard.mockRejectedValueOnce(new Error('nEtWoRkErRoR'));

        await expect(() => handler()).rejects.toThrow('nEtWoRkErRoR');

        expect(getYears).toHaveBeenCalledTimes(1);

        expect(getLeaderboard).toHaveBeenCalledTimes(2);
        expect(getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(processInvites).not.toHaveBeenCalled();
        expect(publishBoards).not.toHaveBeenCalled();
        expect(logActivity).not.toHaveBeenCalled();
    });

    test('skips an undefined leaderboard after an HTTP error', async () => {
        getYears.mockResolvedValueOnce(new Set([2021, 2020]));

        getLeaderboard.mockResolvedValueOnce(undefined);
        getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(handler()).resolves.toBeUndefined();

        expect(getYears).toHaveBeenCalledTimes(1);

        expect(getLeaderboard).toHaveBeenCalledTimes(2);
        expect(getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(processInvites).toHaveBeenCalledTimes(1);
        expect(processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2020: true }, {});

        expect(publishBoards).toHaveBeenCalledTimes(1);
        expect(publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2020: true }, {});

        expect(logActivity).not.toHaveBeenCalled();
    });

    test('fails processing invites', async () => {
        getYears.mockResolvedValueOnce(new Set([2021, 2020]));

        getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });
        getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        processInvites.mockRejectedValueOnce(new Error('pRoCeSsErRoR'));
        processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        publishBoards.mockResolvedValueOnce({ created: [], updated: [] });
        publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(() => handler()).rejects.toThrow('pRoCeSsErRoR');

        expect(getYears).toHaveBeenCalledTimes(1);

        expect(getLeaderboard).toHaveBeenCalledTimes(2);
        expect(getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(processInvites).toHaveBeenCalledTimes(2);
        expect(processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, {});
        expect(processInvites).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, {});

        expect(publishBoards).toHaveBeenCalledTimes(2);
        expect(publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, {});
        expect(publishBoards).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, {});

        expect(logActivity).not.toHaveBeenCalled();
    });

    test('fails publishing boards', async () => {
        getYears.mockResolvedValueOnce(new Set([2021, 2020]));

        getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });
        getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        publishBoards.mockResolvedValueOnce({ created: [], updated: [] });
        publishBoards.mockRejectedValueOnce(new Error('pUbLiShErRoR'));

        await expect(() => handler()).rejects.toThrow('pUbLiShErRoR');

        expect(getYears).toHaveBeenCalledTimes(1);

        expect(getLeaderboard).toHaveBeenCalledTimes(2);
        expect(getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(processInvites).toHaveBeenCalledTimes(2);
        expect(processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, {});
        expect(processInvites).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, {});

        expect(publishBoards).toHaveBeenCalledTimes(2);
        expect(publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, {});
        expect(publishBoards).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, {});
    });

    test('sends logs after certain changes', async () => {
        getYears.mockResolvedValueOnce(new Set([2021, 2020]));

        getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });
        getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        processInvites.mockResolvedValueOnce({
            sent: [{ aocUser: 'U1', year: 1, day: 11 }],
            failed: []
        });
        processInvites.mockResolvedValueOnce({
            sent: [{ aocUser: 'U2', year: 2, day: 12 }, { aocUser: 'U3', year: 3, day: 13 }],
            failed: []
        });

        publishBoards.mockResolvedValueOnce({
            created: [{ year: 5, day: 15 }, { year: 6, day: 16 }],
            updated: []
        });
        publishBoards.mockResolvedValueOnce({
            created: [{ year: 7, day: 17 }],
            updated: []
        });

        await expect(handler()).resolves.toBeUndefined();

        expect(logActivity).toHaveBeenCalledTimes(6);
        expect(logActivity).toHaveBeenCalledWith('Invited U1 to 1 day 11');
        expect(logActivity).toHaveBeenCalledWith('Invited U2 to 2 day 12');
        expect(logActivity).toHaveBeenCalledWith('Invited U3 to 3 day 13');
        expect(logActivity).toHaveBeenCalledWith('Created board for 5 day 15');
        expect(logActivity).toHaveBeenCalledWith('Created board for 6 day 16');
        expect(logActivity).toHaveBeenCalledWith('Created board for 7 day 17');
    });
});

describe('leaderboards.updateLeaderboards', () => {
    test('selected year not in database', async () => {
        getYears.mockResolvedValueOnce(new Set([2021, 2020]));

        await expect(updateLeaderboards({ year: 1953 })).resolves.toStrictEqual({
            unretrieved: [], sent: [], failed: [], created: [], updated: []
        });

        expect(getYears).toHaveBeenCalledTimes(1);

        expect(getLeaderboard).not.toHaveBeenCalled();
        expect(processInvites).not.toHaveBeenCalled();
        expect(publishBoards).not.toHaveBeenCalled();
        expect(logActivity).not.toHaveBeenCalled();
    });

    test.each([
        ['year', { year: 2021 }],
        ['date', { year: 2021, day: 19 }]
    ])('selected %s is applied', async (_description, selection) => {
        getYears.mockResolvedValueOnce(new Set([2021, 2020]));
        getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });

        processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(updateLeaderboards(selection)).resolves.toStrictEqual({
            unretrieved: [], sent: [], failed: [], created: [], updated: []
        });

        expect(getYears).toHaveBeenCalledTimes(1);

        expect(getLeaderboard).toHaveBeenCalledTimes(1);
        expect(getLeaderboard).toHaveBeenNthCalledWith(1, 2021);

        expect(processInvites).toHaveBeenCalledTimes(1);
        expect(processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, selection);

        expect(publishBoards).toHaveBeenCalledTimes(1);
        expect(publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, selection);
    });
});
