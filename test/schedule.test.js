'use strict';

const { handler } = require('../src/schedule');

const invites = require('../src/invites');
jest.mock('../src/invites');

const network = require('../src/network');
jest.mock('../src/network');

beforeEach(() => {
    network.getLeaderboard.mockReset();
    invites.processInvites.mockReset();
});

describe('schedule.handler', () => {
    test('succeeds updating the leaderboard', async () => {
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true })
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true })

        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });
        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        await expect(handler()).resolves.toBeUndefined();

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).toHaveBeenCalledTimes(2);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true });
        expect(invites.processInvites).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true });
    });

    test('fails loading the leaderboard', async () => {
        network.getLeaderboard.mockRejectedValueOnce(new Error('nEtWoRkErRoR'));
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true })

        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        await expect(handler()).rejects.toThrow('nEtWoRkErRoR');

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).toHaveBeenCalledTimes(1);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2020: true });
    });

    test('fails processing invites', async () => {
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2021: true })
        network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd2020: true })

        invites.processInvites.mockRejectedValueOnce(new Error('pRoCeSsErRoR'));
        invites.processInvites.mockResolvedValueOnce({ sent: [], failed: [] });

        await expect(handler()).rejects.toThrow('pRoCeSsErRoR');

        expect(network.getLeaderboard).toHaveBeenCalledTimes(2);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(1, 2021);
        expect(network.getLeaderboard).toHaveBeenNthCalledWith(2, 2020);

        expect(invites.processInvites).toHaveBeenCalledTimes(2);
        expect(invites.processInvites).toHaveBeenNthCalledWith(1, { lEaDeRbOaRd2021: true });
        expect(invites.processInvites).toHaveBeenNthCalledWith(2, { lEaDeRbOaRd2020: true });
    });
});
