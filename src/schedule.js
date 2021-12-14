'use strict';

const { updateLeaderboards } = require('./leaderboard');

const handler = async () => {
    console.log("handler: start");

    await updateLeaderboards();
};

exports.handler = handler;
