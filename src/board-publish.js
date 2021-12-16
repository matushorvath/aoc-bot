'use strict';

const { formatBoard } = require('./board-format');
const { sendTelegram } = require('./network');
const { mapDaysToChats } = require('./invites');

const publishOneBoard = async (day, chat, leaderboard, startTimes) => {
    console.log(`publishOneBoard: start ${day}`);

    const year = Number(leaderboard.event);

    // TODO remove limit
    if (year !== 2020 || day !== 20) return;

    const board = formatBoard(year, day, leaderboard, startTimes);

    await sendTelegram('sendMessage', {
        chat_id: chat,
        parse_mode: 'MarkdownV2',
        text: `\`\`\`\n${board}\n\`\`\``,
        disable_notification: true
    });

    console.log(`publishOneBoard: done ${day}`);
};

const publishBoards = async (leaderboard, startTimes) => {
    console.log('publishBoards: start');

    const year = Number(leaderboard.event);
    const days = Object.values(leaderboard.members).flatMap(member =>
        Object.keys(member.completion_day_level).map(Number));

    const uniqueDays = [...new Set(days)];
    const dayMap = await mapDaysToChats(year, uniqueDays);

    await Promise.all(uniqueDays
        .map(day => ({ day, chat: dayMap[day] }))
        .filter(({ chat }) => chat !== undefined)
        .map(async ({ day, chat }) => await publishOneBoard(day, chat, leaderboard, startTimes))
    );

    console.log('publishBoards: done');
};

exports.publishBoards = publishBoards;
