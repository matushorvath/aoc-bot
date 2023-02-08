'use strict';

const { getLeaderboard } = require('../../src/network.js');
const { loadStartTimes } = require('../../src/times.js');
const { formatBoard } = require('../../src/board.js');

const print_board = async (year, day) => {
    const leaderboard = await getLeaderboard(year);
    const startTimes = await loadStartTimes(year, day);

    const board = formatBoard(year, day, leaderboard, startTimes);

    console.log(board);
};

const main = async () => {
    await print_board(2022, 24);
};

main().catch(console.error);
