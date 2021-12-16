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

    await Promise.all(years.map(async (year) => {
        const leaderboard = await getLeaderboard(year);

        const result = await processInvites(leaderboard);
        sent.push(...result.sent);
        failed.push(...result.failed);

        await publishBoards(leaderboard, startTimes);
    }));

    console.log('updateLeaderboards: done');
    return { sent, failed };
};

const handler = async () => {
    console.log("handler: start");

    await updateLeaderboards();
};

exports.handler = handler;
exports.updateLeaderboards = updateLeaderboards;
