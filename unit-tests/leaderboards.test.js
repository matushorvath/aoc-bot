'use strict';

const { handler, onStop, updateLeaderboards } = require('../src/leaderboards');

const invites = require('../src/invites');
jest.mock('../src/invites');

const network = require('../src/network');
jest.mock('../src/network');

const boardPublish = require('../src/publish');
jest.mock('../src/publish');

const years = require('../src/years');
jest.mock('../src/years');

const logs = require('../src/logs');
jest.mock('../src/logs');

const secrets = require('../src/secrets');
jest.mock('../src/secrets');

beforeEach(() => {
    network.getLeaderboard.mockReset();
    invites.processInvites.mockReset();
    boardPublish.publishBoards.mockReset();
    years.getYears.mockReset();
    logs.logActivity.mockReset();
    secrets.getAdventOfCodeSecret.mockReset();
    secrets.getTelegramSecret.mockReset();
});

describe('onStop', () => {
    test('triggers leaderboard update', async () => {
        years.getYears.mockResolvedValueOnce(new Set());

        await expect(onStop(1945, 11, 2, 'sOmE oNe')).resolves.toBe(false);
    });

    test('reports invitation sent to this user', async () => {
        years.getYears.mockResolvedValueOnce(new Set([1945]));

        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });
        invites.processInvites.mockResolvedValueOnce({ sent: [{ aocUser: 'sOmE oNe', year: 1945, day: 11 }], failed: [] });
        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(onStop(1945, 11, 2, 'sOmE oNe')).resolves.toBe(true);
    });

    test('reports invitation not sent to this user', async () => {
        years.getYears.mockResolvedValueOnce(new Set([1945]));

        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });
        invites.processInvites.mockResolvedValueOnce({ sent: [{ aocUser: 'aNoThEr OnE', year: 1945, day: 11 }], failed: [] });
        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(onStop(1945, 11, 2, 'sOmE oNe')).resolves.toBe(false);
    });

    test('fails after an error while updating leaderboards', async () => {
        years.getYears.mockRejectedValueOnce(new Error('sOmEeRrOr'));
        await expect(() => onStop(1945, 11, 2, 'sOmE oNe')).rejects.toThrow('sOmEeRrOr');
    });
});

describe('leaderboards.handler', () => {
    test('succeeds updating the leaderboard', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));

        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });
        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(handler()).resolves.toBeUndefined();

        expect(years.getYears).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).toHaveBeenCalledTimes(2);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, {});
        expect(invites.processInvites).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, {});

        expect(boardPublish.publishBoards).toHaveBeenCalledTimes(2);
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, {});
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, {});

        expect(logs.logActivity).not.toHaveBeenCalled();
    });

    test('fails loading years', async () => {
        years.getYears.mockRejectedValueOnce(new Error('gEtYeArSeRrOr'));

        await expect(() => handler()).rejects.toThrow('gEtYeArSeRrOr');

        expect(years.getYears).toHaveBeenCalledTimes(1);
        expect(network.getLeaderboard).not.toHaveBeenCalled();

        expect(invites.processInvites).not.toHaveBeenCalled();
        expect(boardPublish.publishBoards).not.toHaveBeenCalled();
        expect(logs.logActivity).not.toHaveBeenCalled();
    });

    test('loads no years', async () => {
        years.getYears.mockResolvedValueOnce(new Set());

        await expect(handler()).resolves.toBeUndefined();

        expect(years.getYears).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).not.toHaveBeenCalled();
        expect(invites.processInvites).not.toHaveBeenCalled();
        expect(boardPublish.publishBoards).not.toHaveBeenCalled();
        expect(logs.logActivity).not.toHaveBeenCalled();
    });

    test('fails loading the leaderboard', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));
        network.getLeaderboard.mockRejectedValueOnce(new Error('nEtWoRkErRoR'));

        await expect(() => handler()).rejects.toThrow('nEtWoRkErRoR');

        expect(years.getYears).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).not.toHaveBeenCalled();
        expect(boardPublish.publishBoards).not.toHaveBeenCalled();
        expect(logs.logActivity).not.toHaveBeenCalled();
    });

    test('skips an undefined leaderboard after an HTTP error', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));

        network.getLeaderboard.mockResolvedValueOnce(undefined);
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(handler()).resolves.toBeUndefined();

        expect(years.getYears).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).toHaveBeenCalledTimes(1);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2020: true }, {});

        expect(boardPublish.publishBoards).toHaveBeenCalledTimes(1);
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2020: true }, {});

        expect(logs.logActivity).not.toHaveBeenCalled();
    });

    test('fails processing invites', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));

        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        invites.processInvites.mockRejectedValueOnce(new Error('pRoCeSsErRoR'));
        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });
        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(() => handler()).rejects.toThrow('pRoCeSsErRoR');

        expect(years.getYears).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).toHaveBeenCalledTimes(2);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, {});
        expect(invites.processInvites).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, {});

        expect(boardPublish.publishBoards).toHaveBeenCalledTimes(2);
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, {});
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, {});

        expect(logs.logActivity).not.toHaveBeenCalled();
    });

    test('fails publishing boards', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));

        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });
        boardPublish.publishBoards.mockRejectedValueOnce(new Error('pUbLiShErRoR'));

        await expect(() => handler()).rejects.toThrow('pUbLiShErRoR');

        expect(years.getYears).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).toHaveBeenCalledTimes(2);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, {});
        expect(invites.processInvites).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, {});

        expect(boardPublish.publishBoards).toHaveBeenCalledTimes(2);
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, {});
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, {});
    });

    test('sends logs after certain changes', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));

        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        invites.processInvites.mockResolvedValueOnce({
            sent: [{ aocUser: 'U1', year: 1, day: 11 }],
            failed: []
        });
        invites.processInvites.mockResolvedValueOnce({
            sent: [{ aocUser: 'U2', year: 2, day: 12 }, { aocUser: 'U3', year: 3, day: 13 }],
            failed: []
        });

        boardPublish.publishBoards.mockResolvedValueOnce({
            created: [{ year: 5, day: 15 }, { year: 6, day: 16 }],
            updated: []
        });
        boardPublish.publishBoards.mockResolvedValueOnce({
            created: [{ year: 7, day: 17 }],
            updated: []
        });

        await expect(handler()).resolves.toBeUndefined();

        expect(logs.logActivity).toHaveBeenCalledTimes(6);
        expect(logs.logActivity).toHaveBeenCalledWith('Invited U1 to 1 day 11');
        expect(logs.logActivity).toHaveBeenCalledWith('Invited U2 to 2 day 12');
        expect(logs.logActivity).toHaveBeenCalledWith('Invited U3 to 3 day 13');
        expect(logs.logActivity).toHaveBeenCalledWith('Created board for 5 day 15');
        expect(logs.logActivity).toHaveBeenCalledWith('Created board for 6 day 16');
        expect(logs.logActivity).toHaveBeenCalledWith('Created board for 7 day 17');
    });
});

describe('leaderboards.updateLeaderboards', () => {
    test('selected year not in database', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));

        await expect(updateLeaderboards({ year: 1953 })).resolves.toStrictEqual({
            unretrieved: [], sent: [], failed: [], created: [], updated: []
        });

        expect(years.getYears).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).not.toHaveBeenCalled();
        expect(invites.processInvites).not.toHaveBeenCalled();
        expect(boardPublish.publishBoards).not.toHaveBeenCalled();
        expect(logs.logActivity).not.toHaveBeenCalled();
    });

    test.each([
        ['year', { year: 2021 }],
        ['date', { year: 2021, day: 19 }]
    ])('selected %s is applied', async (_description, selection) => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });

        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(updateLeaderboards(selection)).resolves.toStrictEqual({
            unretrieved: [], sent: [], failed: [], created: [], updated: []
        });

        expect(years.getYears).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(1);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);

        expect(invites.processInvites).toHaveBeenCalledTimes(1);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, selection);

        expect(boardPublish.publishBoards).toHaveBeenCalledTimes(1);
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, selection);
    });
});
