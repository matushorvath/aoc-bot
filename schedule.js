'use strict';

const { updateLeaderboard } = require('./leaderboard');

const handler = async () => {
    console.log("handler: schedule running");

    await updateLeaderboard();
};

exports.handler = handler;
