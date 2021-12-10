'use strict';

const { updateLeaderboard } = require('./leaderboard');

const handler = async () => {
    console.log("handler: start");

    await updateLeaderboard();
};

exports.handler = handler;
