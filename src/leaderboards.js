'use strict';

const { processInvites } = require('./invites');
const { getLeaderboard } = require('./network');
const { publishBoards } = require('./publish');
const { getYears } = require('./years');
const { logActivity } = require('./logs');

const handler = async () => {
    console.log('handler: start');

    await updateLeaderboards();
};

const onStop = async (year, day, part, name) => {
    console.log(`onStop: start ${year} ${day} ${part} ${name}`);

    // Use the year and day parameter to update a single leaderboard
    const result = await updateLeaderboards({ year, day });

    console.debug(result);

    // Return true if the user was invited to the channel for requested day
    return result.sent.some(r => r.aocUser === name && r.year === year && r.day === day);
};

const updateLeaderboards = async (selection = {}) => {
    console.log(`updateLeaderboards: start, selection ${selection}`);

    const result = { unretrieved: [], sent: [], failed: [], created: [], updated: [] };

    let years = await selectYears(selection);
    if (years.length === 0) {
        return result;
    }

    // Download leaderboards in parallel
    let leaderboards = await Promise.all(
        years.map(async (year) => ({ year, data: await getLeaderboard(year) }))
    );

    // Filter out empty leaderboards
    result.unretrieved = leaderboards.filter(leaderboard => leaderboard.data === undefined);
    leaderboards = leaderboards.filter(leaderboard => leaderboard.data !== undefined);

    // Process invites and publish boards in parallel
    await Promise.all([
        ...leaderboards.map(async ({ data }) => {
            const invites = await processInvites(data, selection);
            result.sent.push(...invites.sent);
            result.failed.push(...invites.failed);
        }),
        ...leaderboards.map(async ({ data }) => {
            const boards = await publishBoards(data, selection);
            result.created.push(...boards.created);
            result.updated.push(...boards.updated);
        })
    ]);

    // Send activity logs to subscribers
    await Promise.all([
        ...result.sent.map(async ({ aocUser, year, day }) => {
            await logActivity(`Invited ${aocUser} to ${year} day ${day}`);
        }),
        ...result.created.map(async ({ year, day }) => {
            await logActivity(`Created board for ${year} day ${day}`);
        })
    ]);

    console.log('updateLeaderboards: done');
    return result;
};

const selectYears = async (selection) => {
    let years = [...await getYears()];

    if (selection.year) {
        // Select just one year, and only if it exists in the database
        years = years.filter(y => y === selection.year);
    }

    return years;
};

exports.handler = handler;
exports.onStop = onStop;
exports.updateLeaderboards = updateLeaderboards;
