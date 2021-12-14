'use strict';

const { processInvites } = require('./invites');
const { getLeaderboard } = require('./network');

const updateLeaderboards = async () => {
    // TODO find which chats are we subscribed to, and get those years only
    const years = [2021, 2020];

    const sent = [];
    const failed = [];

    await Promise.all(years.map(async (year) => {
        const leaderboard = await getLeaderboard(year);

        const result = await processInvites(leaderboard);
        sent.push(...result.sent);
        failed.push(...result.failed);
    }));

    return { sent, failed };
};

const handler = async () => {
    console.log("handler: start");

    await updateLeaderboards();
};

exports.handler = handler;
exports.updateLeaderboards = updateLeaderboards;
