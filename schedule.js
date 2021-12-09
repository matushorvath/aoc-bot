'use strict';

const { processLeaderboard } = require('./leaderboard');

const handler = async () => {
    console.log("handler: schedule running");

    await processLeaderboard();
};

exports.handler = handler;
