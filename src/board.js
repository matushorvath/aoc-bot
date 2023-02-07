'use strict';

const LOCALE = 'sk';
const pluginUrl = 'https://github.com/TrePe0/aoc-plugin';

const formatBoard = (year, day, leaderboard, startTimes) => {
    // Make an array of results for this day: [[name, ts1, ts2], ...]
    const results = getResults(year, day, leaderboard, startTimes);

    const startTs = Math.floor(Date.UTC(year, 11, day, 5) / 1000);
    const elapsed = formatDuration(Math.floor(Date.now() / 1000) - startTs);

    const header = pre(escape(`Deň ${day.toString().padStart(2)} @${elapsed} ` +
        'ofic. part 1 a 2 (čas na p2) neoficiálne (čistý čas na p2)*'));
    const footer = pre('\\* čistý čas zistený pluginom ') + `[${escape(pluginUrl)}](${pluginUrl})`;

    const body = results.map(result => pre(escape(formatOneLine(
        result, startTs, startTimes[result.name]))));

    const board = [header, ...body, '``', footer].join('\n');
    return board;
};

const getResults = (year, day, leaderboard, startTimes) => {
    // Results from AoC leaderboard
    const leaderboardResults = Object.values(leaderboard.members)
        .filter(member => member.completion_day_level[day]?.[1])
        .map(member => ({
            name: member.name,
            ts1: member.completion_day_level[day][1]?.get_star_ts ?? Infinity,
            ts2: member.completion_day_level[day][2]?.get_star_ts ?? Infinity
        }));

    // Add an entries from startTimes for everyone who has started part 1, but not yet finished it.
    // This means everyone from startTimes, who is present in the AoC leaderboard, but not in the
    // filtered AoC leaderboard results above.
    const leaderboardNames = new Set(Object.values(leaderboard.members).map(({ name }) => name));
    const leaderboardResultNames = new Set(leaderboardResults.map(({ name }) => name));

    const startedResults = Object.keys(startTimes)
        .filter(name => leaderboardNames.has(name) && !leaderboardResultNames.has(name))
        .map(name => ({ name, ts1: Infinity, ts2: Infinity }));

    // Merge and sort
    return [...leaderboardResults, ...startedResults]
        .sort((a, b) => {
            if (a.ts2 === b.ts2) {
                if (a.ts1 === b.ts1) {
                    return a.name.localeCompare(b.name, LOCALE);
                }
                return a.ts1 - b.ts1;
            }
            return a.ts2 - b.ts2;
        });
};

const formatOneLine = (result, startTs, dayStartTimes) => {
    const ots1d = formatDuration(result.ts1 - startTs);
    const ots2d = formatDuration(result.ts2 - startTs);
    const odiffd = formatDuration(result.ts2 - result.ts1);

    let line = `${result.name.padStart(16)} ${ots1d} ${ots2d} (${odiffd})`;

    if (dayStartTimes?.[1]) {
        const start1 = Math.min(...dayStartTimes[1]);
        const ots1 = result.ts1 - start1;
        const ots2 = result.ts2 - start1;

        if (ots1 >= 0 && ots2 >= 0) {
            const nts1d = formatDuration(ots1);
            const nts2d = formatDuration(ots2);
            line += ` [${nts1d} ${nts2d}`;

            if (dayStartTimes?.[2]) {
                const start2 = Math.min(...dayStartTimes[2]);
                const ndiff = result.ts2 - start2;

                if (ndiff > 0) {
                    const ndiffd = formatDuration(ndiff);
                    line += ` (${ndiffd})`;
                }
            }

            line += ']';
        }
    }
    return line;
};

const formatDuration = (duration) => {
    if (duration === Infinity || isNaN (duration) || duration < 0) {
        return '--:--:--';
    }

    const d = Math.floor(duration / 86400);
    const h = Math.floor(duration % 86400 / 3600);
    const dh = d * 24 + h;
    const m = Math.floor(duration % 3600 / 60);
    const s = Math.floor(duration % 60);

    if (d > 9999999) {
        return '       ∞';
    } else if (d > 999) {
        return `${d.toString().padStart(7)}d`;
    } else if (dh > 99) {
        return `${d.toString().padStart(3)}d ${h.toString().padStart(2)}h`;
    } else {
        return `${dh.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
};

const escape = (text) => {
    return text.replace(/[-_*[\]\\()~`>#+=|{}.!]/g, '\\$&');
};

const pre = (text) => `\`${text}\``;

exports.formatBoard = formatBoard;