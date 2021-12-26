'use strict';

const { onTelegramUpdate } = require('../src/telegram');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

const network = require('../src/network');
jest.mock('../src/network');

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
    dynamodb.DynamoDB.prototype.putItem.mockReset();
    network.sendTelegram.mockReset();
});

describe('onTelegramUpdate', () => {
    test('ignores unknown updates', async () => {
        const update = { nOnSeNsE: true };
        await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(network.sendTelegram).not.toHaveBeenCalled();
        expect(network.getLeaderboard).not.toHaveBeenCalled();
        expect(network.getStartTimes).not.toHaveBeenCalled();
    });

    describe('onMyChatMember', () => {
        test('ignores non-admin chat member update', async () => {
            const update = {
                my_chat_member: {
                    new_chat_member: { status: 'sTaTuS' },
                    chat: { type: 'supergroup', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
            expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
            expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

            expect(network.sendTelegram).not.toHaveBeenCalled();
            expect(network.getLeaderboard).not.toHaveBeenCalled();
            expect(network.getStartTimes).not.toHaveBeenCalled();
        });

        test('ignores non-group/non-supergroup membership', async () => {
            const update = {
                my_chat_member: {
                    new_chat_member: { status: 'administrator' },
                    chat: { type: 'sTuFf', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
            expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
            expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

            expect(network.sendTelegram).not.toHaveBeenCalled();
            expect(network.getLeaderboard).not.toHaveBeenCalled();
            expect(network.getStartTimes).not.toHaveBeenCalled();
        });

        test('ignores membership in a supergroup with no title', async () => {
            const update = {
                my_chat_member: {
                    new_chat_member: { status: 'administrator' },
                    chat: { type: 'supergroup' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
            expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
            expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

            expect(network.sendTelegram).not.toHaveBeenCalled();
            expect(network.getLeaderboard).not.toHaveBeenCalled();
            expect(network.getStartTimes).not.toHaveBeenCalled();
        });

        test('ignores membership in a supergroup with invalid title', async () => {
            const update = {
                my_chat_member: {
                    new_chat_member: { status: 'administrator' },
                    chat: { type: 'supergroup', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
            expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
            expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

            expect(network.sendTelegram).not.toHaveBeenCalled();
            expect(network.getLeaderboard).not.toHaveBeenCalled();
            expect(network.getStartTimes).not.toHaveBeenCalled();
        });

        test('fails if dynamodb throws', async () => {
            const update = {
                my_chat_member: {
                    new_chat_member: { status: 'administrator' },
                    chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
                }
            };

            dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce(new Error('dYnAmOeRrOr'));

            await expect(onTelegramUpdate(update)).rejects.toThrow('dYnAmOeRrOr');

            expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
                Item: {
                    id: { S: 'chat:1980:13' },
                    y: { N: '1980' },
                    d: { N: '13' },
                    chat: { N: '-4242' }
                },
                TableName: 'aoc-bot'
            });
        });

        test('fails if sendTelegram throws', async () => {
            const update = {
                my_chat_member: {
                    new_chat_member: { status: 'administrator' },
                    chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
                }
            };

            dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
            network.sendTelegram.mockRejectedValueOnce(new Error('tElEgRaMeRrOr'));

            await expect(onTelegramUpdate(update)).rejects.toThrow('tElEgRaMeRrOr');

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: -4242,
                text: '@AocElfBot is online, AoC 1980 Day 13',
                disable_notification: true
            });
        });

        test.each(['group', 'supergroup'])('succeeds for admin membership in %s', async (chatType) => {
            const update = {
                my_chat_member: {
                    new_chat_member: { status: 'administrator' },
                    chat: { id: -4242, type: chatType, title: 'AoC 1980 Day 13' }
                }
            };

            dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
            network.sendTelegram.mockResolvedValueOnce(undefined);

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
                Item: {
                    id: { S: 'chat:1980:13' },
                    y: { N: '1980' },
                    d: { N: '13' },
                    chat: { N: '-4242' }
                },
                TableName: 'aoc-bot'
            });

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: -4242,
                text: '@AocElfBot is online, AoC 1980 Day 13',
                disable_notification: true
            });
        });
    });
});
