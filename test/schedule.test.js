'use strict';

const { handler } = require('../src/schedule');

const invites = require('../src/invites');
jest.mock('../src/invites');

const network = require('../src/network');
jest.mock('../src/network');

const boardPublish = require('../src/board-publish');
jest.mock('../src/board-publish');

beforeEach(() => {
    network.getLeaderboard.mockReset();
    network.getStartTimes.mockReset();
    invites.processInvites.mockReset();
    boardPublish.publishBoards.mockReset();
});

describe('schedule.handler', () => {
    test('succeeds updating the leaderboard', async () => {
        network.getStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: true })
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true })
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true })

        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        await expect(handler()).resolves.toBeUndefined();

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

    test('fails loading start times', async () => {
        network.getStartTimes.mockRejectedValueOnce(new Error('sTaRtTiMeErRoR'));

        await expect(handler()).rejects.toThrow('sTaRtTiMeErRoR');

        expect(network.getStartTimes).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).not.toHaveBeenCalled();
        expect(invites.processInvites).not.toHaveBeenCalled();
        expect(boardPublish.publishBoards).not.toHaveBeenCalled();
    });

    test('fails loading the leaderboard', async () => {
        network.getStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: true })
        network.getLeaderboard.mockRejectedValueOnce(new Error('nEtWoRkErRoR'));
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true })

        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        await expect(handler()).rejects.toThrow('nEtWoRkErRoR');

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
        network.getStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: true })
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true })
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true })

        invites.processInvites.mockRejectedValueOnce(new Error('pRoCeSsErRoR'));
        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        await expect(handler()).rejects.toThrow('pRoCeSsErRoR');

        expect(network.getStartTimes).toHaveBeenCalledTimes(1);

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).toHaveBeenCalledTimes(2);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true });
        expect(invites.processInvites).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true });

        expect(boardPublish.publishBoards).toHaveBeenCalledTimes(1);
        expect(boardPublish.publishBoards).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2020: true }, { sTaRtTiMeS: true });
    });

    test('fails publishing boards', async () => {
        network.getStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: true })
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true })
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true })

        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        boardPublish.publishBoards.mockRejectedValueOnce(new Error('pUbLiShErRoR'));

        await expect(handler()).rejects.toThrow('pUbLiShErRoR');

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
