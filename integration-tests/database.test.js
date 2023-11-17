'use strict';

require('./expect-each-match-object');
require('./expect-one-of');
require('./expect-each-pass-predicate');

const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const DB_TABLE = 'aoc-bot';

const db = new DynamoDB({
    apiVersion: '2012-08-10',
    region: 'eu-central-1'
});

jest.setTimeout(30 * 1000);

const isValidYear = year => Number(year) === 1980 || Number(year) === 2000
    || (Number(year) >= 2015 && Number(year) <= 2050);

describe('Database consistency', () => {
    const data = [];

    test('Retrieve database data', async () => {
        let result;
        while (!result || result.LastEvaluatedKey) {
            const params = { TableName: DB_TABLE };
            if (result?.LastEvaluatedKey) {
                params.ExclusiveStartKey = result.LastEvaluatedKey;
            }

            result = await db.scan(params);
            data.push(...result.Items);
        }

        expect(data.length).toBeGreaterThan(0);
    });

    test('Check unknown id values', () => {
        const knownIds = [
            'aoc_user', 'board', 'chat', 'invite', 'logs',
            'promotion', 'start_time', 'telegram_user', 'years'
        ];

        expect(data).toEachMatchObject({
            id: { S: expect.toBeOneOf(...knownIds) }
        });
    });

    describe('Check aoc_user records', () => {
        test('aoc_user:sk and aoc_user:aoc_user match', () => {
            const aoc_users = data.filter(i => i.id.S === 'aoc_user');
            expect(aoc_users).toEachPassPredicate(i => i.sk.S === i.aoc_user.S);
        });

        test('aoc_user:telegram_user can be found in telegram_user', () => {
            const aoc_users = data.filter(i => i.id.S === 'aoc_user');
            const telegramUsers = new Set(data.filter(i => i.id.S === 'telegram_user').map(i => i.telegram_user.N));
            expect(aoc_users).toEachPassPredicate(i => telegramUsers.has(i.telegram_user.N));
        });
    });

    describe('Check board records', () => {
        test('board:sk and board:chat match', () => {
            const boards = data.filter(i => i.id.S === 'board');
            expect(boards).toEachPassPredicate(i => i.sk.S === i.chat.N);
        });

        // TODO board:chat record exists in chat
        // TODO board:chat exists in telegram
        // TODO board:message exists in the telegram chat and is the leaderboard
    });

    describe('Check chat records', () => {
        test('chat:sk, chat:y and chat:d match', () => {
            const chats = data.filter(i => i.id.S === 'chat');
            expect(chats).toEachPassPredicate(i => i.sk.S === `${i.y.N}:${i.d.N}`);
        });

        test('chat:y is a valid year', () => {
            const chats = data.filter(i => i.id.S === 'chat');
            expect(chats).toEachPassPredicate(i => isValidYear(i.y.N));
        });

        test('chat:d is a valid day', () => {
            const chats = data.filter(i => i.id.S === 'chat');
            expect(chats).toEachPassPredicate(i => Number(i.d.N) >= 1 && Number(i.d.N) <= 25);
        });

        // TODO chat:chat exists in telegram
    });

    describe('Check invite records', () => {
        test('invite:sk, invite:y, invite:d and invite:chat match', () => {
            const invites = data.filter(i => i.id.S === 'invite');
            expect(invites).toEachPassPredicate(i => i.sk.S.endsWith(`${i.y.N}:${i.d.N}:${i.chat.N}`));
        });

        test('invite:y is a valid year', () => {
            const invites = data.filter(i => i.id.S === 'invite');
            expect(invites).toEachPassPredicate(i => isValidYear(i.y.N));
        });

        test('invite:d is a valid day', () => {
            const invites = data.filter(i => i.id.S === 'invite');
            expect(invites).toEachPassPredicate(i => Number(i.d.N) >= 1 && Number(i.d.N) <= 25);
        });

        // TODO invite:chat record exists in chat
        // TODO invite:chat exists in telegram
    });

    describe('Check logs records', () => {
        test('logs record is a singleton', () => {
            const logs = data.filter(i => i.id.S === 'logs');
            expect(logs).toHaveLength(1);
        });

        test('logs:sk is zero', () => {
            const logs = data.filter(i => i.id.S === 'logs');
            expect(logs[0]).toMatchObject({ sk: { S: '0' } });
        });

        test('logs:chats is an array of numbers', () => {
            const logs = data.filter(i => i.id.S === 'logs');
            expect(logs[0].chats.NS).toEachPassPredicate(i => !isNaN(Number(i)));
        });

        // TODO logs:chats all exist in telegram
    });

    describe('Check promotion records', () => {
        test('promotion:sk can be found in telegram_user', () => {
            const promotions = data.filter(i => i.id.S === 'promotion');
            const telegramUsers = new Set(data.filter(i => i.id.S === 'telegram_user').map(i => i.telegram_user.N));
            expect(promotions).toEachPassPredicate(i => telegramUsers.has(i.sk.S));
        });

        // TODO promotion:sk user exists in telegram
    });

    describe('Check start_times records', () => {
        test('start_times:sk, start_times:year, start_times:day, start_times:part and start_times:name match', () => {
            const start_times = data.filter(i => i.id.S === 'start_time');
            expect(start_times).toEachPassPredicate(i => i.sk.S === `${i.year.N}:${i.day.N}:${i.part.N}:${i.name.S}`);
        });

        test('start_times:year is a valid year', () => {
            const start_times = data.filter(i => i.id.S === 'start_time');
            expect(start_times).toEachPassPredicate(i => isValidYear(i.year.N));
        });

        test('start_times:day is a valid day', () => {
            const start_times = data.filter(i => i.id.S === 'start_time');
            expect(start_times).toEachPassPredicate(i => Number(i.day.N) >= 1 && Number(i.day.N) <= 25);
        });

        test('start_times:part is a valid part', () => {
            const start_times = data.filter(i => i.id.S === 'start_time');
            expect(start_times).toEachPassPredicate(i => i.part.N === '1' || i.part.N === '2');
        });

        // TODO start_time:ts is some sane value (valid year, newer than year/day)
        // TODO start_times:chat exists in telegram
    });

    describe('Check telegram_user records', () => {
        test('telegram_user:sk and telegram_user:telegram_user match', () => {
            const telegram_users = data.filter(i => i.id.S === 'telegram_user');
            expect(telegram_users).toEachPassPredicate(i => i.sk.S === i.telegram_user.N);
        });

        test('telegram_user:aoc_user can be found in aoc_user', () => {
            const telegram_users = data.filter(i => i.id.S === 'telegram_user');
            const all_aoc_users = new Set(data.filter(i => i.id.S === 'aoc_user').map(i => i.aoc_user.S));
            expect(telegram_users).toEachPassPredicate(i => all_aoc_users.has(i.aoc_user.S));
        });

        // TODO telegram_user:telegram_user exists in telegram
    });

    describe('Check years records', () => {
        test('years record is a singleton', () => {
            const years = data.filter(i => i.id.S === 'years');
            expect(years).toHaveLength(1);
        });

        test('years:sk is zero', () => {
            const years = data.filter(i => i.id.S === 'years');
            expect(years[0]).toMatchObject({ sk: { S: '0' } });
        });

        test('years:years is an array of valid years', () => {
            const years = data.filter(i => i.id.S === 'years');
            expect(years[0].years.NS).toEachPassPredicate(i => isValidYear(i));
        });
    });
});
