'use strict';

const LOCALE = 'sk';

const formatBoard = (year, day, leaderboard, startTimes) => {
    // Make an array of results for this day: [[name, ts1, ts2], ...]
    const results = getResults(year, day, leaderboard, startTimes);

    const startTs = Math.floor(Date.UTC(year, 11, day, 5) / 1000);
    const elapsed = formatDuration(Math.floor(Date.now() / 1000) - startTs);

    const header = `Day ${day.toString().padStart(2)} @${elapsed} ` +
        `ofic. part 1 a 2 (cas na p2)  neoficialne (cisty cas na p2)`;

    const board = [header, ...results.map(result => formatOneLine(
        result, startTs, startTimes?.[year][day][result.name]))].join('\n');
    return escapeForTelegram(board);
};

const getResults = (year, day, leaderboard, startTimes) => {
    // Results from AoC leaderboard
    const leaderboardResults = Object.values(leaderboard.members)
        .filter(member => member.completion_day_level[day])
        .map(member => ({
            name: member.name,
            ts1: member.completion_day_level[day][1]?.get_star_ts ?? Infinity,
            ts2: member.completion_day_level[day][2]?.get_star_ts ?? Infinity
        }));

    // Add an entries from startTimes for all names not yet in AoC leaderboard
    const leaderboardNames = new Set(leaderboardResults.map(({ name }) => name));

    const startedResults = Object.keys(startTimes?.[year]?.[day] ?? {})
        .filter(name => !leaderboardNames.has(name))
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
        const nts1d = formatDuration(result.ts1 - start1);
        const nts2d = formatDuration(result.ts2 - start1);

        line += ` [${nts1d} ${nts2d}`;

        if (dayStartTimes?.[2]) {
            const start2 = Math.min(...dayStartTimes[2]);
            const ndiffd = formatDuration(result.ts2 - start2);

            line += ` (${ndiffd})`
        }

        line += ']';
    }
    return line;
};

const formatDuration = (duration) => {
    if (duration === Infinity || isNaN (duration) || duration < 0) {
        return "--:--:--";
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

const escapeForTelegram = (text) => {
    return text.replace(/[-_*[\]()~`>#+=|{}.!]/g, '\\$&');
};

exports.formatBoard = formatBoard;
