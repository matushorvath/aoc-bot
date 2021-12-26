'use strict';

const { processInvites } = require('../src/invites');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

const network = require('../src/network');
jest.mock('../src/network');

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
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
                    },
                },
                '33': {
                    name: 'nAmE33',
                    completion_day_level: {},
                },
                '51': {         // user with no telegram account
                    name: 'nAmE51',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    },
                },
                '52': {         // user with a telegram account that no longer exists
                    name: 'nAmE52',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    },
                },
                '54': {         // user where telegrams fails when retrieving the membership
                    name: 'nAmE54',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    },
                },
                '55': {         // user who is not in the chat room, but already has an invite
                    name: 'nAmE55',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    },
                },
                '56': {         // user where we could not create an invite
                    name: 'nAmE56',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    },
                },
                '57': {         // user where we could not send an invite
                    name: 'nAmE57',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    },
                },
                '59': {         // user with just part 1 for day 25
                    name: 'nAmE59',
                    completion_day_level: {
                        '25': { '1': {} }
                    },
                }
            }
        };

        // TODO invalid leaderboard json

        // mapUsers
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: {
                'aoc-bot': [{
                    aoc_user: { S: 'nAmE31' },
                    telegram_user: { N: 3131 }
                }, {
                    aoc_user: { S: 'nAmE32' },
                    telegram_user: { N: 3232 }
                }, {
                    aoc_user: { S: 'nAmE33' },
                    telegram_user: { N: 3333 }
                },
                // aoc_user nAmE11 has no telegram account in db
                {
                    aoc_user: { S: 'nAmE52' },
                    telegram_user: { N: 5252 }
                }, {
                    aoc_user: { S: 'nAmE54' },
                    telegram_user: { N: 5454 }
                }, {
                    aoc_user: { S: 'nAmE55' },
                    telegram_user: { N: 5555 }
                }, {
                    aoc_user: { S: 'nAmE56' },
                    telegram_user: { N: 5656 }
                }, {
                    aoc_user: { S: 'nAmE57' },
                    telegram_user: { N: 5757 }
                }, {
                    aoc_user: { S: 'nAmE59' },
                    telegram_user: { N: 5959 }
                }]
            }
        });

        // mapDaysToChats
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: {
                'aoc-bot': [{
                    d: { N: '5' },
                    chat: { N: 50505 }
                }, {
                    d: { N: '7' },
                    chat: { N: 70707 }
                }, {
                    d: { N: '11' },
                    chat: { N: 111111 }
                }, {
                    d: { N: '13' },
                    chat: { N: 131313 }
                }, {
                    d: { N: '25' },
                    chat: { N: 252525 }
                }]
            }
        });

        // TODO missing chat for a day

        // filterSentInvites
        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: {
                'aoc-bot': [{
                    id: { S: 'invite:5555:2021:5:50505' }
                }]
            }
        });

        // filterUsersInChat
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE31
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE32
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE33
        // aoc_user nAmE32 is already member of the chat for day 13
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'member' } });
        // aoc_user nAmE52 has a telegram account in db, but it no longer exists
        network.sendTelegram.mockRejectedValueOnce({ isAxiosError: true, response: { data: { error_code: 400 } } });
        // aoc_user nAmE54 returned an error state
        network.sendTelegram.mockResolvedValueOnce({ ok: false });
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE56
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE57
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'left' } }); // nAmE59

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

        // aoc_user nAmE56, could not create an invite
        network.sendTelegram.mockResolvedValueOnce({ ok: false });

        // aoc_user nAmE57, could not send an invite
        network.sendTelegram.mockResolvedValueOnce(
            { ok: true, result: { name: 'iNvItE57_5', invite_link: 'InViTeLiNk57_5' } });
        network.sendTelegram.mockRejectedValueOnce(
            { isAxiosError: true, response: { data: { error_code: 400 } } });

        // aoc_user nAmE59, successful sending
        const invite = { ok: true, result: { name: `iNvItE59_25`, invite_link: `InViTeLiNk59_25` } };
        network.sendTelegram.mockResolvedValueOnce(invite);
        network.sendTelegram.mockResolvedValueOnce(undefined);

        await expect(processInvites(leaderboard)).resolves.toEqual({
            sent: [{
                aocUser: 'nAmE31', chat: 50505, day: 5, telegramUser: 3131, year: 2021
            }, {
                aocUser: 'nAmE31', chat: 111111, day: 11, telegramUser: 3131, year: 2021
            }, {
                aocUser: 'nAmE32', chat: 70707, day: 7, telegramUser: 3232, year: 2021
            }, {
                aocUser: 'nAmE59', chat: 252525, day: 25, telegramUser: 5959, year: 2021
            }],
            failed: [{
                aocUser: 'nAmE56', chat: 50505, day: 5, telegramUser: 5656, year: 2021
            }]
        });

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(3);

        // mapUsers
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(1, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [
                        { id: { S: 'aoc_user:nAmE31' } },
                        { id: { S: 'aoc_user:nAmE32' } },
                        { id: { S: 'aoc_user:nAmE51' } },
                        { id: { S: 'aoc_user:nAmE52' } },
                        { id: { S: 'aoc_user:nAmE54' } },
                        { id: { S: 'aoc_user:nAmE55' } },
                        { id: { S: 'aoc_user:nAmE56' } },
                        { id: { S: 'aoc_user:nAmE57' } },
                        { id: { S: 'aoc_user:nAmE59' } }
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
                        { id: { S: 'chat:2021:5' } },
                        { id: { S: 'chat:2021:11' } },
                        { id: { S: 'chat:2021:7' } },
                        { id: { S: 'chat:2021:13' } },
                        // chat:2021:17 is missing, nobody got 17 part 2
                        { id: { S: 'chat:2021:25' } }
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
                        { id: { S: 'invite:3131:2021:5:50505' } },
                        { id: { S: 'invite:3131:2021:11:111111' } },
                        { id: { S: 'invite:3232:2021:7:70707' } },
                        { id: { S: 'invite:3232:2021:13:131313' } },
                        // invite:5151:2021:5:50505 is missing, user nAmE51 has no telegram account in db
                        { id: { S: 'invite:5252:2021:5:50505' } },
                        { id: { S: 'invite:5454:2021:5:50505' } },
                        { id: { S: 'invite:5555:2021:5:50505' } },
                        { id: { S: 'invite:5656:2021:5:50505' } },
                        { id: { S: 'invite:5757:2021:5:50505' } },
                        { id: { S: 'invite:5959:2021:25:252525' } }
                    ],
                    ProjectionExpression: 'id'
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
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 5454 });
        // { chat_id: 50505, user_id: 5555 } is missing, user already has an invite
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 5656 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 5757 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 252525, user_id: 5959 });

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
            { chat_id: 5757, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk57_5/) });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 252525, name: 'AoC 2021 Day 25', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'sendMessage',
            { chat_id: 5959, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk59_25/) });

        expect(network.sendTelegram).toHaveBeenCalledTimes(st - 1);

        // markAsSent
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(4);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(1, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite:3131:2021:5:50505' },
                y: { N: '2021' },
                d: { N: '5' },
                chat: { N: '50505' }
            }
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(2, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite:3131:2021:11:111111' },
                y: { N: '2021' },
                d: { N: '11' },
                chat: { N: '111111' }
            }
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(3, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite:3232:2021:7:70707' },
                y: { N: '2021' },
                d: { N: '7' },
                chat: { N: '70707' }
            }
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(4, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite:5959:2021:25:252525' },
                y: { N: '2021' },
                d: { N: '25' },
                chat: { N: '252525' }
            }
        });
    });

    // TODO get more than 100 invites (test windowing in dynamodb)
    // TODO test when no users have invites pending (filterSentInvites with empty UnprocessedKeys)
});
