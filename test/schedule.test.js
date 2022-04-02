'use strict';

const { handler } = require('../src/schedule');

const invites = require('../src/invites');
jest.mock('../src/invites');

const network = require('../src/network');
jest.mock('../src/network');

const boardPublish = require('../src/board-publish');
jest.mock('../src/board-publish');

const years = require('../src/years');
jest.mock('../src/years');

beforeEach(() => {
    network.getLeaderboard.mockReset();
    network.getStartTimes.mockReset();
    invites.processInvites.mockReset();
    boardPublish.publishBoards.mockReset();
    years.getYears.mockReset();
});

describe('schedule.handler', () => {
    test('succeeds updating the leaderboard', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));
        network.getStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: true });

        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });
        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(handler()).resolves.toBeUndefined();

        expect(years.getYears).toHaveBeenCalledTimes(1);
        expect(network.getStartTimes).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).toHaveBeenCalledTimes(2);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true });
        expect(invites.processInvites).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true });

        expect(boardPublish.publishBoards).toHaveBeenCalledTimes(2);
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, { sTaRtTiMeS: true });
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, { sTaRtTiMeS: true });
    });

    test('fails loading years', async () => {
        years.getYears.mockRejectedValueOnce(new Error('gEtYeArSeRrOr'));

        await expect(handler()).rejects.toThrow('gEtYeArSeRrOr');

        expect(years.getYears).toHaveBeenCalledTimes(1);
        expect(network.getStartTimes).not.toHaveBeenCalled();
        expect(network.getLeaderboard).not.toHaveBeenCalled();

        expect(invites.processInvites).not.toHaveBeenCalled();
        expect(boardPublish.publishBoards).not.toHaveBeenCalled();
    });

    test('loads no years', async () => {
        years.getYears.mockResolvedValueOnce(new Set());

        await expect(handler()).resolves.toBeUndefined();

        expect(years.getYears).toHaveBeenCalledTimes(1);
        expect(network.getStartTimes).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).not.toHaveBeenCalled();
        expect(invites.processInvites).not.toHaveBeenCalled();
        expect(boardPublish.publishBoards).not.toHaveBeenCalled();
    });

    test('fails loading start times', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));
        network.getStartTimes.mockRejectedValueOnce(new Error('sTaRtTiMeErRoR'));

        await expect(handler()).rejects.toThrow('sTaRtTiMeErRoR');

        expect(years.getYears).toHaveBeenCalledTimes(1);
        expect(network.getStartTimes).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).not.toHaveBeenCalled();
        expect(boardPublish.publishBoards).not.toHaveBeenCalled();
    });

    test('fails loading the leaderboard', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));
        network.getLeaderboard.mockRejectedValueOnce(new Error('nEtWoRkErRoR'));

        await expect(handler()).rejects.toThrow('nEtWoRkErRoR');

        expect(years.getYears).toHaveBeenCalledTimes(1);
        expect(network.getStartTimes).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).not.toHaveBeenCalled();
        expect(boardPublish.publishBoards).not.toHaveBeenCalled();
    });

    test('skips an undefined leaderboard after an HTTP error', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));
        network.getStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: true });

        network.getLeaderboard.mockResolvedValueOnce(undefined);
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(handler()).resolves.toBeUndefined();

        expect(years.getYears).toHaveBeenCalledTimes(1);
        expect(network.getStartTimes).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).toHaveBeenCalledTimes(1);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2020: true });

        expect(boardPublish.publishBoards).toHaveBeenCalledTimes(1);
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2020: true }, { sTaRtTiMeS: true });
    });

    test('fails processing invites', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));
        network.getStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: true });

        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        invites.processInvites.mockRejectedValueOnce(new Error('pRoCeSsErRoR'));
        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });
        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });

        await expect(handler()).rejects.toThrow('pRoCeSsErRoR');

        expect(years.getYears).toHaveBeenCalledTimes(1);
        expect(network.getStartTimes).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).toHaveBeenCalledTimes(2);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true });
        expect(invites.processInvites).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true });

        expect(boardPublish.publishBoards).toHaveBeenCalledTimes(2);
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, { sTaRtTiMeS: true });
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, { sTaRtTiMeS: true });
    });

    test('fails publishing boards', async () => {
        years.getYears.mockResolvedValueOnce(new Set([2021, 2020]));
        network.getStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: true });

        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true });
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true });

        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        boardPublish.publishBoards.mockResolvedValueOnce({ created: [], updated: [] });
        boardPublish.publishBoards.mockRejectedValueOnce(new Error('pUbLiShErRoR'));

        await expect(handler()).rejects.toThrow('pUbLiShErRoR');

        expect(years.getYears).toHaveBeenCalledTimes(1);
        expect(network.getStartTimes).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).toHaveBeenCalledTimes(2);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true });
        expect(invites.processInvites).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true });

        expect(boardPublish.publishBoards).toHaveBeenCalledTimes(2);
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true }, { sTaRtTiMeS: true });
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true }, { sTaRtTiMeS: true });
    });
});
