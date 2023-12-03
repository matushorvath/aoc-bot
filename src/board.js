'use strict';

const LOCALE = 'sk';
const pluginUrl = 'https://github.com/TrePe0/aoc-plugin';

const formatBoard = (year, day, leaderboard, startTimes) => {
    // Make an array of results for this day
    const startTs = Math.floor(Date.UTC(year, 11, day, 5) / 1000);
    const results = sortResults(getResults(day, leaderboard, startTs, startTimes));

    const formattedDay = day.toString().padStart(2);
    const elapsed = formatDuration(Math.floor(Date.now() / 1000) - startTs);
    const header = `Deň ${formattedDay} @${elapsed} ofic. part 1 a 2 (čas na p2) neoficiálne (čistý čas na p2)*`;

    const table = results.map(result => formatOneLine(result));

    const body = code(escape([header, ...table].join('\n')));
    const plugin = pre('\\* čistý čas zistený pluginom ') + `[${escape(pluginUrl)}](${pluginUrl})`;

    const board = [body, plugin].join('\n');
    return board;
};

const getResults = (day, leaderboard, startTs, startTimes) => {
    // Results from AoC leaderboard
    const leaderboardResults = Object.values(leaderboard.members)
        .filter(member => member.completion_day_level[day]?.[1])
        .map(member => ({
            name: member.name,
            ts1: member.completion_day_level[day][1]?.get_star_ts ?? Infinity,
            ts2: member.completion_day_level[day][2]?.get_star_ts ?? Infinity,
            start1: startTimes[member.name]?.[1],
            start2: startTimes[member.name]?.[2]
        }));

    // Add an entries from startTimes for everyone who has started part 1, but not yet finished it.
    // This means everyone from startTimes, who is present in the AoC leaderboard, but not in the
    // filtered AoC leaderboard results above.
    const leaderboardNames = new Set(Object.values(leaderboard.members).map(({ name }) => name));
    const leaderboardResultNames = new Set(leaderboardResults.map(({ name }) => name));

    const startedResults = Object.entries(startTimes)
        .filter(([name]) => leaderboardNames.has(name) && !leaderboardResultNames.has(name))
        .map(([name, parts]) => ({
            name,
            ts1: Infinity,
            ts2: Infinity,
            start1: parts?.[1],
            start2: parts?.[2]
        }));

    // Calculate values for the leaderboard
    const results = [...leaderboardResults, ...startedResults]
        .map(result => ({
            name: result.name,
            ots1: result.ts1 - startTs,
            ots2: result.ts2 - startTs,
            odiff: result.ts2 - result.ts1,
            nts1: result.start1 ? result.ts1 - result.start1 : undefined,
            nts2: result.start1 ? result.ts2 - result.start1 : undefined,
            ndiff: result.start2 ? result.ts2 - result.start2 : undefined
        }));

    return results;
};

const sortResults = (results) => {
    return results.toSorted((a, b) => {
        const ap2 = a.nts2 ?? a.ots2;
        const bp2 = b.nts2 ?? b.ots2;

        if (ap2 !== bp2) {
            return ap2 - bp2;
        }

        const ap1 = a.nts1 ?? a.ots1;
        const bp1 = b.nts1 ?? b.ots1;

        if (ap1 !== bp1) {
            return ap1 - bp1;
        }

        return a.name.localeCompare(b.name, LOCALE);
    });
};

const formatOneLine = (result) => {
    const ots1d = formatDuration(result.ots1);
    const ots2d = formatDuration(result.ots2);
    const odiffd = formatDuration(result.odiff);

    let line = `${formatName(result.name, 16)} ${ots1d} ${ots2d} (${odiffd})`;

    if (result.nts1 >= 0 && result.nts2 >= 0) {
        const nts1d = formatDuration(result.nts1);
        const nts2d = formatDuration(result.nts2);
        line += ` [${nts1d} ${nts2d}`;

        if (result.ndiff > 0) {
            const ndiffd = formatDuration(result.ndiff);
            line += ` (${ndiffd})`;
        }

        line += ']';
    }

    return line;
};

const formatName = (name, length) => {
    if (name.length <= length) {
        return name.padStart(length);
    } else {
        return `${name.substring(0, 15)}…`;
    }
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

const code = (text) => `\`\`\`\n${text}\n\`\`\``;

exports.formatBoard = formatBoard;
