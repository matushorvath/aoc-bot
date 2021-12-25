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
                '42': {
                    name: 'nAmE42',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} },
                        '7': { '1': {} },
                        '11': { '1': {}, '2': {} }
                    }
                },
                '69': {
                    name: 'nAmE69',
                    completion_day_level: {
                        '7': { '1': {}, '2': {} },
                        '13': { '1': {}, '2': {} },     // user is already a member of this chat
                        '17': { '1': {} }
                    },
                },
                '88': {
                    name: 'nAmE88',
                    completion_day_level: {},
                },
                '91': {         // user with no telegram account
                    name: 'nAmE91',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    },
                },
                '92': {         // user with a telegram account that no longer exists
                    name: 'nAmE92',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    },
                },
                '93': {         // user where telegrams fails when retrieving the membership
                    name: 'nAmE93',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    },
                },
                '94': {         // user who is not in the chat room, but already has an invite
                    name: 'nAmE94',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    },
                },
                '95': {         // user where we could not create an invite
                    name: 'nAmE95',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    },
                },
                '96': {         // user where we could not send an invite
                    name: 'nAmE96',
                    completion_day_level: {
                        '5': { '1': {}, '2': {} }
                    },
                },
                '97': {         // user with just part 1 for day 25
                    name: 'nAmE97',
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
                    aoc_user: { S: 'nAmE42' },
                    telegram_user: { N: 4242 }
                }, {
                    aoc_user: { S: 'nAmE69' },
                    telegram_user: { N: 6969 }
                }, {
                    aoc_user: { S: 'nAmE88' },
                    telegram_user: { N: 8888 }
                },
                // aoc_user nAmE11 has no telegram account in db
                {
                    aoc_user: { S: 'nAmE92' },
                    telegram_user: { N: 9292 }
                }, {
                    aoc_user: { S: 'nAmE93' },
                    telegram_user: { N: 9393 }
                }, {
                    aoc_user: { S: 'nAmE94' },
                    telegram_user: { N: 9494 }
                }, {
                    aoc_user: { S: 'nAmE95' },
                    telegram_user: { N: 9595 }
                }, {
                    aoc_user: { S: 'nAmE96' },
                    telegram_user: { N: 9696 }
                }, {
                    aoc_user: { S: 'nAmE97' },
                    telegram_user: { N: 9797 }
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
                    id: { S: 'invite:9494:2021:5:50505' }
                }]
            }
        });

        // filterUsersInChat
        const leftMember = { ok: true, result: { status: 'left' } };
        for (let i = 0; i < 3; i++) {
            network.sendTelegram.mockResolvedValueOnce(leftMember);
        }
        // aoc_user nAmE69 is already member of the chat for day 13
        network.sendTelegram.mockResolvedValueOnce({ ok: true, result: { status: 'member' } });
        // aoc_user nAmE92 has a telegram account in db, but it no longer exists
        network.sendTelegram.mockRejectedValueOnce({ isAxiosError: true, response: { data: { error_code: 400 } } });
        // aoc_user nAmE93 returned an error state
        network.sendTelegram.mockResolvedValueOnce({ ok: false });
        // aoc_users nAmE95 to nAmE97 are not in chat yet
        for (let i = 0; i < 3; i++) {
            network.sendTelegram.mockResolvedValueOnce(leftMember);
        }

        // sendInvites
        for (let i = 0; i < 3; i++) {
            // createChatInviteLink
            const invite = { ok: true, result: { name: `iNvItE${i}`, invite_link: `InViTeLiNk${i}` } };
            network.sendTelegram.mockResolvedValueOnce(invite);

            // sendMessage
            network.sendTelegram.mockResolvedValueOnce(undefined);
        }

        // aoc_user nAmE95, could not create an invite
        network.sendTelegram.mockResolvedValueOnce({ ok: false });

        // aoc_user nAmE96, could not send an invite
        network.sendTelegram.mockResolvedValueOnce(
            { ok: true, result: { name: 'iNvItE96', invite_link: 'InViTeLiNk96' } });
        network.sendTelegram.mockRejectedValueOnce(
            { isAxiosError: true, response: { data: { error_code: 400 } } });

        // aoc_user nAmE97, send an invite
        const invite = { ok: true, result: { name: `iNvItE97`, invite_link: `InViTeLiNk97` } };
        network.sendTelegram.mockResolvedValueOnce(invite);
        network.sendTelegram.mockResolvedValueOnce(undefined);

        await expect(processInvites(leaderboard)).resolves.toEqual({
            sent: [{
                aocUser: 'nAmE42', chat: 50505, day: 5, telegramUser: 4242, year: 2021
            }, {
                aocUser: 'nAmE42', chat: 111111, day: 11, telegramUser: 4242, year: 2021
            }, {
                aocUser: 'nAmE69', chat: 70707, day: 7, telegramUser: 6969, year: 2021
            }, {
                aocUser: 'nAmE97', chat: 252525, day: 25, telegramUser: 9797, year: 2021
            }],
            failed: [{
                aocUser: 'nAmE95', chat: 50505, day: 5, telegramUser: 9595, year: 2021
            }]
        });

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(3);

        // mapUsers
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(1, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [
                        { id: { S: 'aoc_user:nAmE42' } },
                        { id: { S: 'aoc_user:nAmE69' } },
                        { id: { S: 'aoc_user:nAmE91' } },
                        { id: { S: 'aoc_user:nAmE92' } },
                        { id: { S: 'aoc_user:nAmE93' } },
                        { id: { S: 'aoc_user:nAmE94' } },
                        { id: { S: 'aoc_user:nAmE95' } },
                        { id: { S: 'aoc_user:nAmE96' } },
                        { id: { S: 'aoc_user:nAmE97' } }
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
                        { id: { S: 'invite:4242:2021:5:50505' } },
                        { id: { S: 'invite:4242:2021:11:111111' } },
                        { id: { S: 'invite:6969:2021:7:70707' } },
                        { id: { S: 'invite:6969:2021:13:131313' } },
                        // invite:9191:2021:5:50505 is missing, user nAmE91 has no telegram account in db
                        { id: { S: 'invite:9292:2021:5:50505' } },
                        { id: { S: 'invite:9393:2021:5:50505' } },
                        { id: { S: 'invite:9494:2021:5:50505' } },
                        { id: { S: 'invite:9595:2021:5:50505' } },
                        { id: { S: 'invite:9696:2021:5:50505' } },
                        { id: { S: 'invite:9797:2021:25:252525' } }
                    ],
                    ProjectionExpression: 'id'
                }
            }
        });

        // filterUsersInChat
        expect(network.sendTelegram).toHaveBeenCalledTimes(9 + 11);
        let st = 1;
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 4242 });
        // { chat_id: 70707, user_id: 4242 } is missing, part 2 was not solved
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 111111, user_id: 4242 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 70707, user_id: 6969 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 131313, user_id: 6969 });
        // { chat_id: 171717, user_id: 6969 } is missing, part 2 was not solved
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 9292 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 9393 });
        // { chat_id: 50505, user_id: 9494 } is missing, user already has an invite
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 9595 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 50505, user_id: 9696 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'getChatMember', { chat_id: 252525, user_id: 9797 });

        // sendInvites
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 50505, name: 'AoC 2021 Day 5', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'sendMessage',
            { chat_id: 4242, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk0/) });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 111111, name: 'AoC 2021 Day 11', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'sendMessage',
            { chat_id: 4242, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk1/) });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 70707, name: 'AoC 2021 Day 7', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'sendMessage',
            { chat_id: 6969, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk2/) });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 50505, name: 'AoC 2021 Day 5', member_limit: 1, creates_join_request: false });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 50505, name: 'AoC 2021 Day 5', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'sendMessage',
            { chat_id: 9696, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk96/) });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'createChatInviteLink',
            { chat_id: 252525, name: 'AoC 2021 Day 25', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(st++, 'sendMessage',
            { chat_id: 9797, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk97/) });

        // markAsSent
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(4);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(1, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite:4242:2021:5:50505' },
                y: { N: '2021' },
                d: { N: '5' },
                chat: { N: '50505' }
            }
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(2, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite:4242:2021:11:111111' },
                y: { N: '2021' },
                d: { N: '11' },
                chat: { N: '111111' }
            }
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(3, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite:6969:2021:7:70707' },
                y: { N: '2021' },
                d: { N: '7' },
                chat: { N: '70707' }
            }
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(4, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'invite:9797:2021:25:252525' },
                y: { N: '2021' },
                d: { N: '25' },
                chat: { N: '252525' }
            }
        });
    });

    // TODO get more than 100 invites (test windowing in dynamodb)
    // TODO test when no users have invites pending (filterSentInvites with empty UnprocessedKeys)
});
