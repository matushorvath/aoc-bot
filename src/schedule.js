'use strict';

const { processInvites } = require('./invites');
const { getLeaderboard, getStartTimes } = require('./network');
const { publishBoards } = require('./board-publish');

const updateLeaderboards = async () => {
    console.log('updateLeaderboards: start');

    // TODO find which chats are we subscribed to, and get those years only
    const years = [2021, 2020];

    const startTimes = await getStartTimes();

    const sent = [];
    const failed = [];
    const created = [];
    const updated = [];

    await Promise.all(years.map(async (year) => {
        const leaderboard = await getLeaderboard(year);

        const invites = await processInvites(leaderboard);
        sent.push(...invites.sent);
        failed.push(...invites.failed);

        const boards = await publishBoards(leaderboard, startTimes);
        created.push(...boards.created);
        updated.push(...boards.updated);
    }));

    console.log('updateLeaderboards: done');
    return { sent, failed, created, updated };
};

const handler = async () => {
    console.log('handler: start');

    await updateLeaderboards();
};

exports.handler = handler;
exports.updateLeaderboards = updateLeaderboards;
