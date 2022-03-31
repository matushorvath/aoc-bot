'use strict';

const { processInvites } = require('./invites');
const { getLeaderboard, getStartTimes } = require('./network');
const { publishBoards } = require('./board-publish');
const { getYears } = require('./years');

const updateLeaderboards = async () => {
    console.log('updateLeaderboards: start');

    const years = [...await getYears()];

    // Download start times and leaderboards in parallel
    let [startTimes, ...leaderboards] = await Promise.all([
        getStartTimes(),
        ...years.map(async (year) => ({ year, data: await getLeaderboard(year) }))
    ]);

    // Filter out empty leaderboards
    const unretrieved = leaderboards.filter(leaderboard => leaderboard.data === undefined);
    leaderboards = leaderboards.filter(leaderboard => leaderboard.data !== undefined);

    const sent = [];
    const failed = [];
    const created = [];
    const updated = [];

    // Process invites and publish boards in parallel
    await Promise.all([
        ...leaderboards.map(async ({ data }) => {
            const invites = await processInvites(data);
            sent.push(...invites.sent);
            failed.push(...invites.failed);
        }),
        ...leaderboards.map(async ({ data }) => {
            const boards = await publishBoards(data, startTimes);
            created.push(...boards.created);
            updated.push(...boards.updated);
        })
    ]);

    console.log('updateLeaderboards: done');
    return { unretrieved, sent, failed, created, updated };
};

const handler = async () => {
    console.log('handler: start');

    await updateLeaderboards();
};

exports.handler = handler;
exports.updateLeaderboards = updateLeaderboards;
