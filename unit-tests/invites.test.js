'use strict';

const { processInvites } = require('../src/invites');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

const network = require('../src/network');
jest.mock('../src/network');

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
    dynamodb.DynamoDB.prototype.batchGetItem.mockReset();
    network.sendTelegram.mockReset();
});

describe('processInvites', () => {
    test('sends invites', async () => {
        const leaderboard = {
            event: '2021',
            members: {
                '31': {
                    name: 'nAmE31',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} },
                        '7': { '1': {} },
                        '11': { '1': {}, '2': {} }
                    }
                },
                '32': {
                    name: 'nAmE32',
                    completion_day_level: {
                        '7': { '1': {}, '2': {} },
                        '13': { '1': {}, '2': {} },     // user is already a member of this chat
                        '17': { '1': {} }
                    }
                },
                '33': {
                    name: 'nAmE33',
                    completion_day_level: {}
                },
                '51': {         // user with no telegram account
                    name: 'nAmE51',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    }
                },
                '52': {         // user with a telegram account that no longer exists
                    name: 'nAmE52',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    }
                },
                '53': {         // user where telegrams fails when retrieving the membership
                    name: 'nAmE53',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    }
                },
                '54': {         // user who is not in the chat room, but already has an invite
                    name: 'nAmE54',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    }
                },
                '55': {         // user where we could not create an invite
                    name: 'nAmE55',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    }
                },
                '56': {         // user where we could not send an invite
                    name: 'nAmE56',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    }
                },
                '57': {         // user with just part 1 for day 25
                    name: 'nAmE57',
                    completion_day_level: {
                        '25': { '1': {} }
                    }
                },
                '58': {         // user both parts, simulating a race condition while sending 
                    name: 'nAmE58',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    }
                }
            }
        };

        // TODO invalid leaderboard json

        // mapUsers
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: {
                'aoc-bot': [
                    { aoc_user: { S: 'nAmE31' }, telegram_user: { N: 3131 } },
                    { aoc_user: { S: 'nAmE32' }, telegram_user: { N: 3232 } },
                    { aoc_user: { S: 'nAmE33' }, telegram_user: { N: 3333 } },
                    // aoc_user nAmE11 has no telegram account in db
                    { aoc_user: { S: 'nAmE52' }, telegram_user: { N: 5252 } },
                    { aoc_user: { S: 'nAmE53' }, telegram_user: { N: 5353 } },
                    { aoc_user: { S: 'nAmE54' }, telegram_user: { N: 5454 } },
                    { aoc_user: { S: 'nAmE55' }, telegram_user: { N: 5555 } },
                    { aoc_user: { S: 'nAmE56' }, telegram_user: { N: 5656 } },
                    { aoc_user: { S: 'nAmE57' }, telegram_user: { N: 5757 } },
                    { aoc_user: { S: 'nAmE58' }, telegram_user: { N: 5858 } }
                ]
            }
        });

        // mapDaysToChats
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: {
                'aoc-bot': [
                    { d: { N: '5' }, chat: { N: 50505 } },
                    { d: { N: '7' }, chat: { N: 70707 } },
                    { d: { N: '11' }, chat: { N: 111111 } },
                    { d: { N: '13' }, chat: { N: 131313 } },
                    { d: { N: '25' }, chat: { N: 252525 } }
                ]
            }
        });

        // TODO missing chat for a day

        // filterSentInvites
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: {
                'aoc-bot': [{
                    id: { S: 'invite' },
                    sk: { S: '5454:2021:5:50505' }
                }]
                // invite 5858:2021:5:50505 is not here, because we simulate that
                // the database record appeared while we were processing invites
            }
        });

        // filterUsersInChat
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE31
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE32
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE33
        // nAmE32 is already member of the chat for day 13
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'member' } });
        // nAmE52 has a telegram account in db, but it no longer exists
        network.sendTelegram.mockRejectedValueOnce({ isTelegramError: true, telegram_error_code: 400 });
        network.sendTelegram.mockResolvedValueOnce({ ok: false }); // nAmE53, telegram error state
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE55
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE56
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE57
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE58

        // markAsSent
        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined); // nAmE31
        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined); // nAmE31
        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined); // nAmE32
        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined); // nAmE55
        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined); // nAmE56
        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined); // nAmE57
        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' }); // nAmE58, simulates a detected race condition

        // sendInvites
        network.sendTelegram.mockResolvedValueOnce(
            { ok: true, result: { name: 'iNvItE31_5', invite_link: 'InViTeLiNk31_5' } });
        network.sendTelegram.mockResolvedValueOnce(undefined);

        network.sendTelegram.mockResolvedValueOnce(
            { ok: true, result: { name: 'iNvItE31_11', invite_link: 'InViTeLiNk31_11' } });
        network.sendTelegram.mockResolvedValueOnce(undefined);

        network.sendTelegram.mockResolvedValueOnce(
            { ok: true, result: { name: 'iNvItE32_7', invite_link: 'InViTeLiNk32_7' } });
        network.sendTelegram.mockResolvedValueOnce(undefined);

        // aoc_user nAmE55, could not create an invite
        network.sendTelegram.mockResolvedValueOnce({ ok: false });

        // aoc_user nAmE56, could not send an invite
        network.sendTelegram.mockResolvedValueOnce(
            { ok: true, result: { name: 'iNvItE56_5', invite_link: 'InViTeLiNk56_5' } });
        network.sendTelegram.mockRejectedValueOnce(
            { isTelegramError: true, telegram_error_code: 403 });

        // aoc_user nAmE57, successful sending
        const invite = { ok: true, result: { name: 'iNvItE57_25', invite_link: 'InViTeLiNk57_25' } };
        network.sendTelegram.mockResolvedValueOnce(invite);
        network.sendTelegram.mockResolvedValueOnce(undefined);

        // aoc_user nAmE58, will detect a race condition and not attempt to send an invite
        // aoc_user nAmE59, could not mark in dynamo

        await expect(processInvites(leaderboard)).resolves.toEqual({
            sent: [{
                aocUser: 'nAmE31', chat: 50505, day: 5, telegramUser: 3131, year: 2021
            }, {
                aocUser: 'nAmE31', chat: 111111, day: 11, telegramUser: 3131, year: 2021
            }, {
                aocUser: 'nAmE32', chat: 70707, day: 7, telegramUser: 3232, year: 2021
            }, {
                aocUser: 'nAmE57', chat: 252525, day: 25, telegramUser: 5757, year: 2021
            }],
            failed: [{
                aocUser: 'nAmE55', chat: 50505, day: 5, telegramUser: 5555, year: 2021
            }]
        });

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(3);

        // mapUsers
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(1, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [
                        { id: { S: 'aoc_user' }, sk: { S: 'nAmE31' } },
                        { id: { S: 'aoc_user' }, sk: { S: 'nAmE32' } },
                        { id: { S: 'aoc_user' }, sk: { S: 'nAmE51' } },
                        { id: { S: 'aoc_user' }, sk: { S: 'nAmE52' } },
                        { id: { S: 'aoc_user' }, sk: { S: 'nAmE53' } },
                        { id: { S: 'aoc_user' }, sk: { S: 'nAmE54' } },
                        { id: { S: 'aoc_user' }, sk: { S: 'nAmE55' } },
                        { id: { S: 'aoc_user' }, sk: { S: 'nAmE56' } },
                        { id: { S: 'aoc_user' }, sk: { S: 'nAmE57' } },
                        { id: { S: 'aoc_user' }, sk: { S: 'nAmE58' } }
                    ],
                    ProjectionExpression: 'aoc_user, telegram_user'
                }
            }
        });

        // mapDaysToChats
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(2, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [
                        { id: { S: 'chat' }, sk: { S: '2021:5' } },
                        { id: { S: 'chat' }, sk: { S: '2021:11' } },
                        { id: { S: 'chat' }, sk: { S: '2021:7' } },
                        { id: { S: 'chat' }, sk: { S: '2021:13' } },
                        // chat 2021:17 is missing, nobody got 17 part 2
                        { id: { S: 'chat' }, sk: { S: '2021:25' } }
                    ],
                    ProjectionExpression: 'd, chat'
                }
            }
        });

        // filterSentInvites
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(3, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [
                        { id: { S: 'invite' }, sk: { S: '3131:2021:5:50505' } },
                        { id: { S: 'invite' }, sk: { S: '3131:2021:11:111111' } },
                        { id: { S: 'invite' }, sk: { S: '3232:2021:7:70707' } },
                        { id: { S: 'invite' }, sk: { S: '3232:2021:13:131313' } },
                        // invite 5151:2021:5:50505 is missing, user nAmE51 has no telegram account in db
                        { id: { S: 'invite' }, sk: { S: '5252:2021:5:50505' } },
                        { id: { S: 'invite' }, sk: { S: '5353:2021:5:50505' } },
                        { id: { S: 'invite' }, sk: { S: '5454:2021:5:50505' } },
                        { id: { S: 'invite' }, sk: { S: '5555:2021:5:50505' } },
                        { id: { S: 'invite' }, sk: { S: '5656:2021:5:50505' } },
                        { id: { S: 'invite' }, sk: { S: '5757:2021:25:252525' } },
                        { id: { S: 'invite' }, sk: { S: '5858:2021:5:50505' } }
                    ],
                    ProjectionExpression: 'sk'
                }
            }
        });

        // filterUsersInChat
        let st = 1;
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 3131 });
        // { chat_id: 70707, user_id: 3131 } is missing, part 2 was not solved
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 111111, user_id: 3131 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 70707, user_id: 3232 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 131313, user_id: 3232 });
        // { chat_id: 171717, user_id: 3232 } is missing, part 2 was not solved
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 5252 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 5353 });
        // { chat_id: 50505, user_id: 5454 } is missing, user already has an invite
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 5555 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 5656 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 252525, user_id: 5757 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 5858 });

        // markAsSent
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(7);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(1, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite' },
                sk: { S: '3131:2021:5:50505' },
                y: { N: '2021' },
                d: { N: '5' },
                chat: { N: '50505' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(2, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite' },
                sk: { S: '3131:2021:11:111111' },
                y: { N: '2021' },
                d: { N: '11' },
                chat: { N: '111111' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(3, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite' },
                sk: { S: '3232:2021:7:70707' },
                y: { N: '2021' },
                d: { N: '7' },
                chat: { N: '70707' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(4, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite' },
                sk: { S: '5555:2021:5:50505' },
                y: { N: '2021' },
                d: { N: '5' },
                chat: { N: '50505' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(5, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite' },
                sk: { S: '5656:2021:5:50505' },
                y: { N: '2021' },
                d: { N: '5' },
                chat: { N: '50505' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(6, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite' },
                sk: { S: '5757:2021:25:252525' },
                y: { N: '2021' },
                d: { N: '25' },
                chat: { N: '252525' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(7, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite' },
                sk: { S: '5858:2021:5:50505' },
                y: { N: '2021' },
                d: { N: '5' },
                chat: { N: '50505' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });

        // sendInvites
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 50505, name: 'AoC 2021 Day 5', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'sendMessage',
            { chat_id: 3131, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk31_5/) });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 111111, name: 'AoC 2021 Day 11', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'sendMessage',
            { chat_id: 3131, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk31_11/) });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 70707, name: 'AoC 2021 Day 7', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'sendMessage',
            { chat_id: 3232, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk32_7/) });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 50505, name: 'AoC 2021 Day 5', member_limit: 1, creates_join_request: false });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 50505, name: 'AoC 2021 Day 5', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'sendMessage',
            { chat_id: 5656, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk56_5/) });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 252525, name: 'AoC 2021 Day 25', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'sendMessage',
            { chat_id: 5757, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk57_25/) });

        expect(network.sendTelegram).toHaveBeenCalledTimes(st - 1);
    });

    test('handles error in getChatMembers', async () => {
        const leaderboard = {
            event: '2020',
            members: {
                '99': { name: 'nAmE99', completion_day_level: { '1': { '1': {}, '2': {} } } }
            }
        };

        // mapUsers
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [{ aoc_user: { S: 'nAmE99' }, telegram_user: { N: 9999 } }] }
        });

        // mapDaysToChats
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [{ d: { N: '1' }, chat: { N: 10101 } }] }
        });

        // filterSentInvites
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [] }
        });

        // filterUsersInChat
        network.sendTelegram.mockRejectedValueOnce(new Error('eRrOr'));

        await expect(() => processInvites(leaderboard)).rejects.toThrow('eRrOr');

        // filterUsersInChat
        expect(network.sendTelegram).toHaveBeenCalledTimes(1);
        expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'getChatMember', { chat_id: 10101, user_id: 9999 });
    });

    test('handles error in sendMessage', async () => {
        const leaderboard = {
            event: '2020',
            members: {
                '99': { name: 'nAmE99', completion_day_level: { '1': { '1': {}, '2': {} } } }
            }
        };

        // mapUsers
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [{ aoc_user: { S: 'nAmE99' }, telegram_user: { N: 9999 } }] }
        });

        // mapDaysToChats
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [{ d: { N: '1' }, chat: { N: 10101 } }] }
        });

        // filterSentInvites
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [] }
        });

        // filterUsersInChat
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } });

        // sendInvites
        network.sendTelegram.mockResolvedValueOnce(
            { ok: true, result: { name: 'iNvItE99_1', invite_link: 'InViTeLiNk99_1' } });
        network.sendTelegram.mockRejectedValueOnce(new Error('eRrOr'));

        await expect(() => processInvites(leaderboard)).rejects.toThrow('eRrOr');

        // filterUsersInChat
        expect(network.sendTelegram).toHaveBeenCalledTimes(3);
        expect(network.sendTelegram).toHaveBeenNthCalledWith(3, 'sendMessage',
            { chat_id: 9999, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk99_1/) });
    });

    test('handles error in markAsSent', async () => {
        const leaderboard = {
            event: '2020',
            members: {
                '99': { name: 'nAmE99', completion_day_level: { '1': { '1': {}, '2': {} } } }
            }
        };

        // mapUsers
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [{ aoc_user: { S: 'nAmE99' }, telegram_user: { N: 9999 } }] }
        });

        // mapDaysToChats
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [{ d: { N: '1' }, chat: { N: 10101 } }] }
        });

        // filterSentInvites
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [] }
        });

        // filterUsersInChat
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } });

        // markAsSent
        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce(new Error('dYnAmOfAiLeD'));

        await expect(() => processInvites(leaderboard)).rejects.toThrow('dYnAmOfAiLeD');

        // sendInvites
        expect(network.sendTelegram).toHaveBeenCalledTimes(1);
    });

    test('works with no chats', async () => {
        const leaderboard = {
            event: '2020',
            members: {
                '99': { name: 'nAmE99', completion_day_level: { '1': { '1': {}, '2': {} } } }
            }
        };

        // mapUsers
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [{ aoc_user: { S: 'nAmE99' }, telegram_user: { N: 9999 } }] }
        });

        // mapDaysToChats
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [] }
        });

        await expect(processInvites(leaderboard)).resolves.toEqual({ sent: [], failed: [] });

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(2);
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(2, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [{
                        id: { S: 'chat' },
                        sk: { S: '2020:1' }
                    }],
                    ProjectionExpression: 'd, chat'
                }
            }
        });
    });

    test('selected day is applied', async () => {
        const leaderboard = {
            event: '1945',
            members: {
                '99': { name: 'nAmE99', completion_day_level: { '1': { '1': {}, '2': {} }, '9': { '1': {}, '2': {} } } }
            }
        };

        // mapUsers
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [{ aoc_user: { S: 'nAmE99' }, telegram_user: { N: 9999 } }] }
        });

        // mapDaysToChats
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [{ d: { N: '9' }, chat: { N: 10101 } }] }
        });

        // filterSentInvites
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [] }
        });

        // filterUsersInChat
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } });

        // sendInvites
        network.sendTelegram.mockResolvedValueOnce(
            { ok: true, result: { name: 'iNvItE99_1', invite_link: 'InViTeLiNk99_1' } });

        await expect(processInvites(leaderboard, { year: 1945, day: 9 })).resolves.toEqual({
            sent: [{
                aocUser: 'nAmE99', chat: 10101, day: 9, telegramUser: 9999, year: 1945
            }],
            failed: []
        });

        expect(network.sendTelegram).toHaveBeenCalledTimes(3);
        expect(network.sendTelegram).toHaveBeenNthCalledWith(3, 'sendMessage',
            { chat_id: 9999, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk99_1/) });
    });

    test.each([
        ['year', { year: 1492 }],
        ['day', { year: 2020, day: 15 }]
    ])('selected %s not in leaderboard', async (_description, selection) => {
        const leaderboard = {
            event: '2020',
            members: {
                '99': { name: 'nAmE99', completion_day_level: { '1': { '1': {}, '2': {} } } }
            }
        };

        // mapUsers
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [{ aoc_user: { S: 'nAmE99' }, telegram_user: { N: 9999 } }] }
        });

        // mapDaysToChats
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: { 'aoc-bot': [{ d: { N: '1' }, chat: { N: 10101 } }] }
        });

        await expect(processInvites(leaderboard, selection)).resolves.toEqual({ sent: [], failed: [] });

        expect(network.sendTelegram).not.toHaveBeenCalled();
    });

    // TODO get more than 100 invites (test windowing in dynamodb)
});
