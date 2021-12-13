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

        test('day 2: person one part2, person two part1', async () => {
            expect(formatStats(2021, 2, leaderboard)).toEqual(`\
Day 2 @ 11d  7h  ofic. part 1 a 2 (cas na p2) neoficialne (cisty cas na p2)
      Person One  0:07:42  0:31:16 ( 0:23:34)
      Person Two  13d  7h --:--:-- (--:--:--)`);
        });

        test('day 3: both part2', async () => {
            expect(formatStats(2021, 3, leaderboard)).toEqual(`\
Day 3 @ 10d  7h  ofic. part 1 a 2 (cas na p2) neoficialne (cisty cas na p2)
      Person Two  3:12:34 12:54:32 ( 9:41:58)
      Person One 234d 12h 234d 12h ( 0:00:01)`);
        });

        test('day 4: only person one, part 2', async () => {
            expect(formatStats(2021, 4, leaderboard)).toEqual(`\
Day 4 @  9d  7h  ofic. part 1 a 2 (cas na p2) neoficialne (cisty cas na p2)
      Person One 25:00:13   4d  4h (75:36:34)`);
        });

        test('day 5: only person two, part 1', async () => {
            expect(formatStats(2021, 5, leaderboard)).toEqual(`\
Day 5 @  8d  7h  ofic. part 1 a 2 (cas na p2) neoficialne (cisty cas na p2)
      Person Two  1:08:09 --:--:-- (--:--:--)`);
        });

        test('day 6: equal times both parts', async () => {
            expect(formatStats(2021, 6, leaderboard)).toEqual(`\
Day 6 @  7d  7h  ofic. part 1 a 2 (cas na p2) neoficialne (cisty cas na p2)
      Person One  0:07:42  0:31:16 ( 0:23:34)
      Person Two  0:07:42  0:31:16 ( 0:23:34)`);
        });

        test('day 7: equal times part 1', async () => {
            expect(formatStats(2021, 7, leaderboard)).toEqual(`\
Day 7 @  6d  7h  ofic. part 1 a 2 (cas na p2) neoficialne (cisty cas na p2)
      Person Two  0:07:42  0:31:16 ( 0:23:34)
      Person One  0:07:43  0:31:16 ( 0:23:33)`);
        });
    });
});
