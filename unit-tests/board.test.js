'use strict';

const { formatBoard } = require('../src/board');
const fsp = require('fs/promises');

jest.useFakeTimers();
jest.setSystemTime(Date.UTC(2021, 11, 13, 12));  // Dec 13, 12:00 UTC

describe('formatBoard', () => {
    let jsonLeaderboard;

    beforeAll(async () => {
        jsonLeaderboard = JSON.parse(await fsp.readFile('./unit-tests/board.json', 'utf8'));
    });

    test('day 1: person one part1, person two part2', async () => {
        expect(formatBoard(2021, 1, jsonLeaderboard, {})).toEqual(`\`\`\`
Deň  1 @ 12d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person Two 95:59:59    1234d \\(   1230d\\)
      Person One 00:00:03 \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('day 2: person one part2, person two part1', async () => {
        expect(formatBoard(2021, 2, jsonLeaderboard, {})).toEqual(`\`\`\`
Deň  2 @ 11d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person One 00:07:42 00:31:16 \\(00:23:34\\)
      Person Two  13d  7h \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('day 3: both part2', async () => {
        expect(formatBoard(2021, 3, jsonLeaderboard, {})).toEqual(`\`\`\`
Deň  3 @ 10d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person Two 03:12:34 12:54:32 \\(09:41:58\\)
      Person One 234d 12h 234d 12h \\(00:00:01\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('day 4: only person one, part 2', async () => {
        expect(formatBoard(2021, 4, jsonLeaderboard, {})).toEqual(`\`\`\`
Deň  4 @  9d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person One 25:00:13   4d  4h \\(75:36:34\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('day 5: only person two, part 1', async () => {
        expect(formatBoard(2021, 5, jsonLeaderboard, {})).toEqual(`\`\`\`
Deň  5 @  8d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person Two 01:08:09 \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('day 6: equal times both parts', async () => {
        expect(formatBoard(2021, 6, jsonLeaderboard, {})).toEqual(`\`\`\`
Deň  6 @  7d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person One 00:07:42 00:31:16 \\(00:23:34\\)
      Person Two 00:07:42 00:31:16 \\(00:23:34\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('day 7: equal times part 1', async () => {
        expect(formatBoard(2021, 11, jsonLeaderboard, {})).toEqual(`\`\`\`
Deň 11 @55:00:00 ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person Two 00:07:42 00:31:16 \\(00:23:34\\)
      Person One 00:07:43 00:31:16 \\(00:23:33\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('ordering of missing ts2', async () => {
        const leaderboard = {
            members: {
                '111': {
                    name: 'Person One',
                    completion_day_level: {
                        '1': {
                            '1': { get_star_ts: 1638354469 }
                        }
                    }
                },
                '222': {
                    name: 'Person Two',
                    completion_day_level: {
                        '1': {
                            '1': { get_star_ts: 1638354469 },
                            '2': { get_star_ts: 1638355040 }
                        }
                    }
                }
            }
        };

        expect(formatBoard(2021, 1, leaderboard, {})).toEqual(`\`\`\`
Deň  1 @ 12d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person Two 05:27:49 05:37:20 \\(00:09:31\\)
      Person One 05:27:49 \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('adds results from startTimes', async () => {
        const leaderboard = {
            members: {
                '111': {
                    name: 'Person One',
                    completion_day_level: {
                        '5': { '1': { get_star_ts: 1638684500 } }
                    }
                },
                '222': {
                    name: 'Still Working 1',
                    completion_day_level: {}
                },
                '333': {
                    name: 'Still Working 2',
                    completion_day_level: {}
                }
            }
        };

        const startTimes = {
            'Person One': { '1': [1638683500] },
            'Still Working 2': { '1': [1638685500], '2': [1638686500] },
            'Still Working 1': { '1': [1638687500] }
        };

        expect(formatBoard(2021, 5, leaderboard, startTimes)).toEqual(`\`\`\`
Deň  5 @  8d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person One 01:08:20 \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\) \\[00:16:40 \\-\\-:\\-\\-:\\-\\-\\]
 Still Working 1 \\-\\-:\\-\\-:\\-\\- \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\) \\[\\-\\-:\\-\\-:\\-\\- \\-\\-:\\-\\-:\\-\\-\\]
 Still Working 2 \\-\\-:\\-\\-:\\-\\- \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\) \\[\\-\\-:\\-\\-:\\-\\- \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\)\\]
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('skips startTimes for people not present in leaderboard', async () => {
        const leaderboard = {
            members: {
                '111': {
                    name: 'Person One',
                    completion_day_level: {
                        '5': { '1': { get_star_ts: 1638684500 } }
                    }
                }
            }
        };

        const startTimes = {
            'Person One': { '1': [1638683500] },
            'Still Working 2': { '1': [1638685500], '2': [1638686500] },
            'Still Working 1': { '1': [1638687500] }
        };

        expect(formatBoard(2021, 5, leaderboard, startTimes)).toEqual(`\`\`\`
Deň  5 @  8d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person One 01:08:20 \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\) \\[00:16:40 \\-\\-:\\-\\-:\\-\\-\\]
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('displays infinity for dates far back', async () => {
        const leaderboard = { members: { '111': {
            name: 'Connor MacLeod',
            completion_day_level: { '25': { '1': { get_star_ts: 868793814000 } } }
        } } };

        expect(formatBoard(2021, 25, leaderboard, {})).toEqual(`\`\`\`
Deň 25 @\\-\\-:\\-\\-:\\-\\- ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
  Connor MacLeod        ∞ \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('handles missing get_star_ts', async () => {
        // This should not happen on input, this test exists to complete coverage
        const leaderboard = { members: { '111': {
            name: 'Person One',
            completion_day_level: { '1': { '1': {} } }
        } } };

        // If the person is in the input but with no time, add them to leaderboard with no time
        expect(formatBoard(2021, 1, leaderboard, {})).toEqual(`\`\`\`
Deň  1 @ 12d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person One \\-\\-:\\-\\-:\\-\\- \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('ignores negative solution times', async () => {
        const leaderboard = { members: { '111': {
            name: 'Person One',
            completion_day_level: { '1': { '1': { get_star_ts: 1639440000 }, '2': { get_star_ts: 1639443600 } } }
        } } };

        const startTimes = { 'Person One': { '1': [1639526400], '2': [1639530000] } };

        expect(formatBoard(2021, 1, leaderboard, startTimes)).toEqual(`\`\`\`
Deň  1 @ 12d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person One  12d 19h  12d 20h \\(01:00:00\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('ignores negative difference between part 1 and part 2', async () => {
        // This is a wrong leaderboard, part 2 time is earlier than part 1
        const leaderboard = { members: { '111': {
            name: 'Person One',
            completion_day_level: { '1': { '1': { get_star_ts: 1639443600 }, '2': { get_star_ts: 1639440000 } } }
        } } };

        const startTimes = { 'Person One': { '1': [1639429200], '2': [1639441800] } };

        expect(formatBoard(2021, 1, leaderboard, startTimes)).toEqual(`\`\`\`
Deň  1 @ 12d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person One  12d 20h  12d 19h \\(\\-\\-:\\-\\-:\\-\\-\\) \\[04:00:00 03:00:00\\]
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('displays positive difference between part 1 and part 2', async () => {
        const leaderboard = { members: { '111': {
            name: 'Person One',
            completion_day_level: { '1': { '1': { get_star_ts: 1639443600 }, '2': { get_star_ts: 1639450000 } } }
        } } };

        const startTimes = { 'Person One': { '1': [1639429200], '2': [1639444800] } };

        expect(formatBoard(2021, 1, leaderboard, startTimes)).toEqual(`\`\`\`
Deň  1 @ 12d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person One  12d 20h  12d 21h \\(01:46:40\\) \\[04:00:00 05:46:40 \\(01:26:40\\)\\]
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('handles missing start time for part 2', async () => {
        const leaderboard = { members: { '111': {
            name: 'Person One',
            completion_day_level: { '1': { '1': { get_star_ts: 1639443600 }, '2': { get_star_ts: 1639450000 } } }
        } } };

        const startTimes = { 'Person One': { '1': [1639429200] } };

        expect(formatBoard(2021, 1, leaderboard, startTimes)).toEqual(`\`\`\`
Deň  1 @ 12d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
      Person One  12d 20h  12d 21h \\(01:46:40\\) \\[04:00:00 05:46:40\\]
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('escapes backslash correctly', async () => {
        const leaderboard = { members: { '111': {
            name: 'Per\\son One',
            completion_day_level: { '1': { '1': {} } }
        } } };

        expect(formatBoard(2021, 1, leaderboard, {})).toEqual(`\`\`\`
Deň  1 @ 12d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
     Per\\\\son One \\-\\-:\\-\\-:\\-\\- \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('handles long names', async () => {
        const leaderboard = { members: { '111': {
            name: 'Person With A Very Long Name',
            completion_day_level: { '1': { '1': {} } }
        } } };

        expect(formatBoard(2021, 1, leaderboard, {})).toEqual(`\`\`\`
Deň  1 @ 12d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
Person With A V… \\-\\-:\\-\\-:\\-\\- \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\)
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });

    test('sorts with startTimes', async () => {
        const leaderboard = {
            members: {
                '111': {
                    name: 'P1 No Plugin',
                    completion_day_level: {
                        '5': { '1': { get_star_ts: 1638684500 } }
                    }
                },
                '222': {
                    name: 'P1 With Plugin',
                    completion_day_level: {
                        '5': { '1': { get_star_ts: 1638684501 } }
                    }
                },
                '333': {
                    name: 'P2 No Plugin',
                    completion_day_level: {
                        '5': { '1': { get_star_ts: 1638684502 }, '2': { get_star_ts: 1638684512 } }
                    }
                },
                '444': {
                    name: 'P2 With Plugin',
                    completion_day_level: {
                        '5': { '1': { get_star_ts: 1638684503 }, '2': { get_star_ts: 1638684513 } }
                    }
                },
                '555': {
                    name: 'Only Plugin',
                    completion_day_level: {}
                }
            }
        };

        const startTimes = {
            'Only Plugin': { '1': [1638683500] },
            'P1 With Plugin': { '1': [1638683510] },
            'P2 With Plugin': { '1': [1638683520], '2': [1638684510] }
        };

        expect(formatBoard(2021, 5, leaderboard, startTimes)).toEqual(`\`\`\`
Deň  5 @  8d  7h ofic\\. part 1 a 2 \\(čas na p2\\) neoficiálne \\(čistý čas na p2\\)\\*
  P2 With Plugin 01:08:23 01:08:33 \\(00:00:10\\) \\[00:16:23 00:16:33 \\(00:00:03\\)\\]
    P2 No Plugin 01:08:22 01:08:32 \\(00:00:10\\)
  P1 With Plugin 01:08:21 \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\) \\[00:16:31 \\-\\-:\\-\\-:\\-\\-\\]
    P1 No Plugin 01:08:20 \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\)
     Only Plugin \\-\\-:\\-\\-:\\-\\- \\-\\-:\\-\\-:\\-\\- \\(\\-\\-:\\-\\-:\\-\\-\\) \\[\\-\\-:\\-\\-:\\-\\- \\-\\-:\\-\\-:\\-\\-\\]
\`\`\`
\`\\* čistý čas zistený pluginom \`[https://github\\.com/TrePe0/aoc\\-plugin](https://github.com/TrePe0/aoc-plugin)`);
    });
});
