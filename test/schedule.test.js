'use strict';

const { handler } = require('../src/schedule');

const leaderboard = require('../src/leaderboard');
jest.mock('../src/leaderboard');

describe('schedule.handler', () => {
    test('succeeds updating the leaderboard', async () => {
        await expect(handler()).resolves.toBeUndefined();
        expect(leaderboard.updateLeaderboards).toHaveBeenCalledWith();
    });

    test('fails updating the leaderboard', async () => {
        leaderboard.updateLeaderboards.mockRejectedValueOnce(new Error('uPdAtEeRrOr'));
        await expect(handler()).rejects.toThrow('uPdAtEeRrOr');
        expect(leaderboard.updateLeaderboards).toHaveBeenCalledWith();
    });
});
