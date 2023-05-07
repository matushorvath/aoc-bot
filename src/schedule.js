'use strict';

const { processInvites } = require('./invites');
const { getLeaderboard } = require('./network');
const { publishBoards } = require('./publish');
const { getYears } = require('./years');
const { logActivity } = require('./logs');

const selectYears = async (selection) => {
    let years = [...await getYears()];

    if (selection.year) {
        // Select just one year, and only if it exists in the database
        years = years.filter(y => y === selection.year);
    }

    return years;
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

const handler = async () => {
    console.log('handler: start');

    await updateLeaderboards();
};

exports.handler = handler;
exports.updateLeaderboards = updateLeaderboards;
