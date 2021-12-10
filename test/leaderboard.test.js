'use strict';

const { updateLeaderboard } = require('../src/leaderboard');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

const network = require('../src/network');
jest.mock('../src/network');

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
});

describe('updateLeaderboard', () => {
    test('sends invites', async () => {
        network.getLeaderboard.mockResolvedValueOnce({
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
                        '13': { '1': {}, '2': {} },
                        '17': { '1': {} }
                    },
                },
                '88': {
                    name: 'nAmE88',
                    completion_day_level: {},
                }
            }
        });

        // TODO error from getLeaderboard, invalid json from getLeaderboard

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
                }]
            }
        });

        // TODO missing user in telegram

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
                }]
            }
        });

        // TODO missing chat for a day

        // findChanges
        const member = { ok: true, result: { status: 'left' } };
        for (let i = 0; i < 4; i++) {
            network.sendTelegram.mockResolvedValueOnce(member);
        }

        // TODO member.ok === false (add??? or error), member.result.status === 'left' (add),
        // TODO member.result.status === 'member' (no add), 404 (no add)

        // filterSent
        for (let i = 0; i < 4; i++) {
            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({});
        }

        // TODO invite that was already sent = response is { Item: {} }

        // sendInvites
        for (let i = 0; i < 4; i++) {
            // createChatInviteLink
            const invite = { ok: true, result: { name: `iNvItE${i}`, invite_link: `InViTeLiNk${i}` } };
            network.sendTelegram.mockResolvedValueOnce(invite);

            // sendMessage
            network.sendTelegram.mockResolvedValueOnce(undefined);
        }

        // TODO invite.ok === false, missing result.name, missing result.invite_link
        // TODO sendmessage exception (400, some other error)

        // TODO test that markAsSent is called

        await expect(updateLeaderboard()).resolves.toEqual({
            failed: [],
            sent: [{
                aocUser: 'nAmE42', chat: 50505, day: 5, telegramUser: 4242, year: 2021
            }, {
                aocUser: 'nAmE42', chat: 111111, day: 11, telegramUser: 4242, year: 2021
            }, {
                aocUser: 'nAmE69', chat: 70707, day: 7, telegramUser: 6969, year: 2021
            }, {
                aocUser: 'nAmE69', chat: 131313, day: 13, telegramUser: 6969, year: 2021
            }]
        });

        expect(network.getLeaderboard).toHaveBeenCalled();

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(2);

        // mapUsers
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(1, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [
                        { id: { S: 'aoc_user:nAmE42' } },
                        { id: { S: 'aoc_user:nAmE69' } }
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
                        { id: { S: 'chat:2021:13' } }
                        // chat:2021:17 is missing, because nobody got 17 part 2
                    ],
                    ProjectionExpression: 'd, chat'
                }
            }
        });

        // findChanges
        expect(network.sendTelegram).toHaveBeenCalledTimes(4 + 8);
        expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'getChatMember', { chat_id: 50505, user_id: 4242 });
        // { chat_id: 70707, user_id: 4242 } is missing, because part 2 was not solved
        expect(network.sendTelegram).toHaveBeenNthCalledWith(2, 'getChatMember', { chat_id: 111111, user_id: 4242 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(3, 'getChatMember', { chat_id: 70707, user_id: 6969 });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(4, 'getChatMember', { chat_id: 131313, user_id: 6969 });
        // { chat_id: 171717, user_id: 6969 } is missing, because part 2 was not solved

        // filterSent
        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledTimes(4);
        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenNthCalledWith(1, {
            TableName: 'aoc-bot',
            Key: { id: { S: `invite:4242:2021:5:50505` } },
            ProjectionExpression: 'id'
        });
        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenNthCalledWith(2, {
            TableName: 'aoc-bot',
            Key: { id: { S: `invite:4242:2021:11:111111` } },
            ProjectionExpression: 'id'
        });
        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenNthCalledWith(3, {
            TableName: 'aoc-bot',
            Key: { id: { S: `invite:6969:2021:7:70707` } },
            ProjectionExpression: 'id'
        });
        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenNthCalledWith(4, {
            TableName: 'aoc-bot',
            Key: { id: { S: `invite:6969:2021:13:131313` } },
            ProjectionExpression: 'id'
        });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(5, 'createChatInviteLink',
            { chat_id: 50505, name: 'AoC 2021 Day 5', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(6, 'sendMessage',
            { chat_id: 4242, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk0/) });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(7, 'createChatInviteLink',
            { chat_id: 111111, name: 'AoC 2021 Day 11', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(8, 'sendMessage',
            { chat_id: 4242, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk1/) });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(9, 'createChatInviteLink',
            { chat_id: 70707, name: 'AoC 2021 Day 7', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(10, 'sendMessage',
            { chat_id: 6969, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk2/) });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(11, 'createChatInviteLink',
            { chat_id: 131313, name: 'AoC 2021 Day 13', member_limit: 1, creates_join_request: false });
        expect(network.sendTelegram).toHaveBeenNthCalledWith(12, 'sendMessage',
            { chat_id: 6969, parse_mode: 'MarkdownV2', text: expect.stringMatching(/InViTeLiNk3/) });
    });
});
