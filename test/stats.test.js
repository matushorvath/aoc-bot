'use strict';

const { formatStats } = require('../src/stats');
const fsp = require('fs/promises');

jest.useFakeTimers();
jest.setSystemTime(Date.UTC(2021, 11, 13, 12));  // Dec 13, 12:00 UTC

describe('formatStats', () => {
    let leaderboard;

    beforeAll(async () => {
        leaderboard = JSON.parse(await fsp.readFile('./test/stats-leaderboard.json', 'utf8'));
    });

    describe('leaderboard, no start times', () => {
        test('day 1: person one part1, person two part2', async () => {
            expect(formatStats(2021, 1, leaderboard)).toEqual(`\
Day 1 @ 12d  7h  ofic. part 1 a 2 (cas na p2) neoficialne (cisty cas na p2)
      Person One  0:00:03 --:--:-- (--:--:--)
      Person Two 95:59:59    1234d (   1230d)`);
        });
    });
});
