'use strict';

const { onTelegramUpdate } = require('../src/telegram');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

const network = require('../src/network');
jest.mock('../src/network');

const boardFormat = require('../src/board-format');
jest.mock('../src/board-format');

const schedule = require('../src/schedule');
jest.mock('../src/schedule');

const years = require('../src/years');
jest.mock('../src/years');

const logs = require('../src/logs');
jest.mock('../src/logs');

const fsp = require('fs/promises');

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
    dynamodb.DynamoDB.prototype.batchWriteItem.mockReset();
    dynamodb.DynamoDB.prototype.getItem.mockReset();
    dynamodb.DynamoDB.prototype.putItem.mockReset();
    years.addYear.mockReset();
    logs.enableLogs.mockReset();
    logs.disableLogs.mockReset();
    logs.logActivity.mockReset();
    network.sendTelegram.mockReset();
    schedule.updateLeaderboards.mockReset();
    logs.logActivity.mockReset();
});

describe('onTelegramUpdate', () => {
    test('ignores unknown updates', async () => {
        const update = { nOnSeNsE: true };
        await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(years.addYear).not.toHaveBeenCalled();
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

            expect(years.addYear).not.toHaveBeenCalled();
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

            expect(years.addYear).not.toHaveBeenCalled();
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

            expect(years.addYear).not.toHaveBeenCalled();
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

            expect(years.addYear).not.toHaveBeenCalled();
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

            expect(years.addYear).not.toHaveBeenCalled();
            expect(network.sendTelegram).not.toHaveBeenCalled();
        });

        test('fails if addYear throws', async () => {
            const update = {
                my_chat_member: {
                    new_chat_member: { status: 'administrator' },
                    chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
                }
            };

            dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
            years.addYear.mockRejectedValueOnce(new Error('aDdYeArErRoR'));

            await expect(onTelegramUpdate(update)).rejects.toThrow('aDdYeArErRoR');

            expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
                Item: {
                    id: { S: 'chat:1980:13' },
                    y: { N: '1980' },
                    d: { N: '13' },
                    chat: { N: '-4242' }
                },
                TableName: 'aoc-bot'
            });

            expect(years.addYear).toHaveBeenCalledWith(1980);
            expect(network.sendTelegram).not.toHaveBeenCalled();
        });

        test('fails if sendTelegram throws', async () => {
            const update = {
                my_chat_member: {
                    new_chat_member: { status: 'administrator' },
                    chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
                }
            };

            dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
            years.addYear.mockResolvedValueOnce(undefined);
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

            expect(years.addYear).toHaveBeenCalledWith(1980);

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: -4242,
                text: '@AocElfBot is online, AoC 1980 Day 13',
                disable_notification: true
            });

            expect(logs.logActivity).toHaveBeenCalledWith("Added to chat 'AoC 1980 Day 13' (1980/13)");
        });
    });

    describe('onMessage generic', () => {
        test('ignores non-private message', async () => {
            const update = {
                message: {
                    text: 'tExT',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'tYpE', title: 'tItLe' }
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

        test('ignores message with no text', async () => {
            const update = {
                message: {
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
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

        test('ignores message with no sender', async () => {
            const update = {
                message: {
                    text: 'tExT',
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
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

        test('handles message with unknown command', async () => {
            const update = {
                message: {
                    text: 'tExT',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: "Sorry, I don't understand that command"
            });
        });
    });

    describe('onMessage /reg', () => {
        test('without parameters', async () => {
            const update = {
                message: {
                    text: '/reg',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: "Sorry, I don't understand that command"
            });
        });

        test('with new user', async () => {
            const update = {
                message: {
                    text: '/reg New User',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({});

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                Key: { id: { S: 'telegram_user:7878' } },
                ProjectionExpression: 'aoc_user'
            });

            expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();

            expect(logs.logActivity).toHaveBeenCalledWith("Registered user 'New User'");

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, text: "You are now registered as AoC user 'New User'", disable_notification: true
            });
        });

        test('with existing user', async () => {
            const update = {
                message: {
                    text: '/reg Existing User',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { aoc_user: { S: 'OlDaOcUsEr' } } });
            dynamodb.DynamoDB.prototype.batchWriteItem.mockResolvedValueOnce({ UnprocessedItems: {} });

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                Key: { id: { S: 'telegram_user:7878' } },
                ProjectionExpression: 'aoc_user'
            });

            expect(dynamodb.DynamoDB.prototype.batchWriteItem).toHaveBeenCalledWith({
                RequestItems: {
                    'aoc-bot': [
                        { DeleteRequest: { Key: { id: { S: 'aoc_user:OlDaOcUsEr' } } } },
                        { DeleteRequest: { Key: { id: { S: 'telegram_user:7878' } } } }
                    ]
                }
            });

            expect(logs.logActivity).toHaveBeenCalledWith("Registered user 'Existing User'");

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, text: "You are now registered as AoC user 'Existing User'", disable_notification: true
            });
        });

        test('when some user records fail to delete', async () => {
            const update = {
                message: {
                    text: '/reg Existing User',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { aoc_user: { S: 'OlDaOcUsEr' } } });
            dynamodb.DynamoDB.prototype.batchWriteItem.mockResolvedValueOnce({
                UnprocessedItems: {
                    'aoc-bot': [
                        { DeleteRequest: { Key: { id: { S: 'aoc_user:OlDaOcUsEr' } } } }
                    ]
                }
            });

            // Expect it to succeed, we just log a warning that some records remained
            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                Key: { id: { S: 'telegram_user:7878' } },
                ProjectionExpression: 'aoc_user'
            });

            expect(dynamodb.DynamoDB.prototype.batchWriteItem).toHaveBeenCalledWith({
                RequestItems: {
                    'aoc-bot': [
                        { DeleteRequest: { Key: { id: { S: 'aoc_user:OlDaOcUsEr' } } } },
                        { DeleteRequest: { Key: { id: { S: 'telegram_user:7878' } } } }
                    ]
                }
            });

            expect(logs.logActivity).toHaveBeenCalledWith("Registered user 'Existing User'");

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, text: "You are now registered as AoC user 'Existing User'", disable_notification: true
            });
        });
    });

    describe('onMessage /unreg', () => {
        test('with unknown user', async () => {
            const update = {
                message: {
                    text: '/unreg',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({});

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                Key: { id: { S: 'telegram_user:7878' } },
                ProjectionExpression: 'aoc_user'
            });

            expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, text: 'You are not registered', disable_notification: true
            });
        });

        test('with existing user', async () => {
            const update = {
                message: {
                    text: '/unreg',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { aoc_user: { S: 'OlDaOcUsEr' } } });
            dynamodb.DynamoDB.prototype.batchWriteItem.mockResolvedValueOnce({ UnprocessedItems: {} });

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                Key: { id: { S: 'telegram_user:7878' } },
                ProjectionExpression: 'aoc_user'
            });

            expect(dynamodb.DynamoDB.prototype.batchWriteItem).toHaveBeenCalledWith({
                RequestItems: {
                    'aoc-bot': [
                        { DeleteRequest: { Key: { id: { S: 'aoc_user:OlDaOcUsEr' } } } },
                        { DeleteRequest: { Key: { id: { S: 'telegram_user:7878' } } } }
                    ]
                }
            });

            expect(logs.logActivity).toHaveBeenCalledWith("Unregistered user 'OlDaOcUsEr'");

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: "You are no longer registered (your AoC name was 'OlDaOcUsEr')"
            });
        });

        test('when some user records fail to delete', async () => {
            const update = {
                message: {
                    text: '/unreg',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { aoc_user: { S: 'OlDaOcUsEr' } } });
            dynamodb.DynamoDB.prototype.batchWriteItem.mockResolvedValueOnce({
                UnprocessedItems: {
                    'aoc-bot': [
                        { DeleteRequest: { Key: { id: { S: 'aoc_user:OlDaOcUsEr' } } } }
                    ]
                }
            });

            // Expect it to succeed, we just log a warning that some records remained
            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                Key: { id: { S: 'telegram_user:7878' } },
                ProjectionExpression: 'aoc_user'
            });

            expect(dynamodb.DynamoDB.prototype.batchWriteItem).toHaveBeenCalledWith({
                RequestItems: {
                    'aoc-bot': [
                        { DeleteRequest: { Key: { id: { S: 'aoc_user:OlDaOcUsEr' } } } },
                        { DeleteRequest: { Key: { id: { S: 'telegram_user:7878' } } } }
                    ]
                }
            });

            expect(logs.logActivity).toHaveBeenCalledWith("Unregistered user 'OlDaOcUsEr'");

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: "You are no longer registered (your AoC name was 'OlDaOcUsEr')"
            });
        });
    });

    describe('onMessage /logs', () => {
        test('without parameters', async () => {
            const update = {
                message: {
                    text: '/logs',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(logs.enableLogs).not.toHaveBeenCalled();
            expect(logs.disableLogs).not.toHaveBeenCalled();

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: "Sorry, I don't understand that command"
            });
        });

        test('with an invalid parameter', async () => {
            const update = {
                message: {
                    text: '/logs xxx',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(logs.enableLogs).not.toHaveBeenCalled();
            expect(logs.disableLogs).not.toHaveBeenCalled();

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: "Use '/logs on' to start sending activity logs to you, use '/logs off' to stop"
            });
        });

        test('enabling logs for a user', async () => {
            const update = {
                message: {
                    text: '/logs on',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(logs.enableLogs).toHaveBeenCalledWith(2323);
            expect(logs.disableLogs).not.toHaveBeenCalled();

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: 'Activity logs will now be sent to this chat'
            });
        });

        test('disabling logs for a user', async () => {
            const update = {
                message: {
                    text: '/logs off',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(logs.enableLogs).not.toHaveBeenCalled();
            expect(logs.disableLogs).toHaveBeenCalledWith(2323);

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: 'Activity logs will now be no longer sent to this chat'
            });
        });
    });

    describe('onMessage /board', () => {
        test('without parameters', async () => {
            const update = {
                message: {
                    text: '/board',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: "Sorry, I don't understand that command"
            });
        });

        test('with invalid parameters', async () => {
            const update = {
                message: {
                    text: '/board xyz abc 123',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: "I need two parameters, '/board <year> <day>'"
            });
        });

        test('with empty leaderboard', async () => {
            const update = {
                message: {
                    text: '/board 1980 24',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            network.getLeaderboard.mockResolvedValueOnce(undefined);

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(network.getLeaderboard).toHaveBeenCalledWith(1980);
            expect(network.getStartTimes).not.toHaveBeenCalled();
            expect(boardFormat.formatBoard).not.toHaveBeenCalled();

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, parse_mode: 'MarkdownV2', disable_notification: true,
                text: 'Could not retrieve leaderboard data'
            });
        });

        test('with valid parameters', async () => {
            const update = {
                message: {
                    text: '/board 1980 24',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd: true });
            network.getStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: true });
            boardFormat.formatBoard.mockReturnValueOnce('bOaRd');

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(network.getLeaderboard).toHaveBeenCalledWith(1980);
            expect(network.getStartTimes).toHaveBeenCalledWith();
            expect(boardFormat.formatBoard).toHaveBeenCalledWith(1980, 24, { lEaDeRbOaRd: true }, { sTaRtTiMeS: true });

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, parse_mode: 'MarkdownV2',
                disable_notification: true, disable_web_page_preview: true,
                text: 'bOaRd'
            });
        });

        // TODO test errors from getLeaderboard, getStartTimes, formatBoard
    });

    describe('onMessage /status', () => {
        test('with unknown user', async () => {
            const update = {
                message: {
                    text: '/status',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({});

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                Key: { id: { S: 'telegram_user:7878' } },
                ProjectionExpression: 'aoc_user'
            });

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, text: 'You are not registered', disable_notification: true
            });
        });

        test('with existing user', async () => {
            const update = {
                message: {
                    text: '/status',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { aoc_user: { S: 'Existing User' } } });

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                Key: { id: { S: 'telegram_user:7878' } },
                ProjectionExpression: 'aoc_user'
            });

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: "You are registered as AoC user 'Existing User'"
            });
        });
    });

    describe('onMessage /update', () => {
        describe.each([
            ['defaults (outside of December)', '/update'],
            ['the "all" parameter', '/update all']
        ])('with %s', (_description, command) => {
            beforeAll(() => {
                jest.useFakeTimers('modern');
                jest.setSystemTime(new Date(1980, 8, 17));
            });

            afterAll(() => {
                jest.useRealTimers();
            });

            test('with no updates', async () => {
                const update = {
                    message: {
                        text: command,
                        from: { id: 7878, first_name: 'OnLyFiRsTnAmE' },
                        chat: { id: 2323, type: 'private', title: 'tItLe' }
                    }
                };

                schedule.updateLeaderboards.mockResolvedValueOnce({
                    unretrieved: [], sent: [], created: [], updated: []
                });

                await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

                expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                    chat_id: 2323, disable_notification: true,
                    text: 'Processing leaderboards and invites (all years)'
                });

                expect(schedule.updateLeaderboards).toHaveBeenCalledWith({});

                expect(logs.logActivity).toHaveBeenCalledWith("Update triggered by user 'OnLyFiRsTnAmE' (all years)");

                expect(network.sendTelegram).toHaveBeenNthCalledWith(2, 'sendMessage', {
                    chat_id: 2323, disable_notification: true,
                    text: 'Leaderboards updated\n(no changes)\n'
                });
            });

            test('with updates', async () => {
                const update = {
                    message: {
                        text: '/update all',
                        from: { id: 7878, first_name: 'FiRsTnAmE', last_name: 'LaStNaMe' },
                        chat: { id: 2323, type: 'private', title: 'tItLe' }
                    }
                };

                schedule.updateLeaderboards.mockResolvedValueOnce({
                    unretrieved: [{ year: 1984 }, { year: 2345 }],
                    sent: [{ aocUser: 'AoCu1', year: 1980, day: 13 }, { aocUser: 'AoCu2', year: 1995, day: 4 }],
                    created: [{ year: 1945, day: 2 }, { year: 1815, day: 7 }],
                    updated: [{ year: 1918, day: 14 }, { year: 2063, day: 5 }]
                });

                await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

                expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                    chat_id: 2323, disable_notification: true,
                    text: 'Processing leaderboards and invites (all years)'
                });

                expect(schedule.updateLeaderboards).toHaveBeenCalledWith({});

                expect(logs.logActivity).toHaveBeenCalledWith("Update triggered by user 'FiRsTnAmE LaStNaMe' (all years)");

                expect(network.sendTelegram).toHaveBeenNthCalledWith(2, 'sendMessage', {
                    chat_id: 2323, disable_notification: true,
                    text: `Leaderboards updated
• could not retrieve data for year 1984
• could not retrieve data for year 2345
• invited AoCu1 to 1980 day 13
• invited AoCu2 to 1995 day 4
• created board for 1945 day 2
• created board for 1815 day 7
• updated board for 1918 day 14
• updated board for 2063 day 5
` });
            });
        });

        describe.each([
            ['defaults (in December)', '/update', { year: 1980, day: 13 }, 'year 1980 day 13'],
            ['the "today" parameter', '/update today', { year: 1980, day: 13 }, 'year 1980 day 13'],
            ['specific date selection', '/update 2001 11', { year: 2001, day: 11 }, 'year 2001 day 11'],
            ['specific year selection', '/update 1968', { year: 1968 }, 'year 1968']
        ])('with %s', (_description, command, expectedSelection, selectionString) => {
            beforeAll(() => {
                jest.useFakeTimers('modern');
                jest.setSystemTime(new Date(1980, 11, 13));
            });

            afterAll(() => {
                jest.useRealTimers();
            });

            test('with no updates', async () => {
                const update = {
                    message: {
                        text: command,
                        from: { id: 7878, first_name: 'OnLyFiRsTnAmE' },
                        chat: { id: 2323, type: 'private', title: 'tItLe' }
                    }
                };

                schedule.updateLeaderboards.mockResolvedValueOnce({
                    unretrieved: [], sent: [], created: [], updated: []
                });

                await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

                expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                    chat_id: 2323, disable_notification: true,
                    text: `Processing leaderboards and invites (${selectionString})`
                });

                expect(schedule.updateLeaderboards).toHaveBeenCalledWith(expectedSelection);

                expect(logs.logActivity).toHaveBeenCalledWith(`Update triggered by user 'OnLyFiRsTnAmE' (${selectionString})`);

                expect(network.sendTelegram).toHaveBeenNthCalledWith(2, 'sendMessage', {
                    chat_id: 2323, disable_notification: true,
                    text: 'Leaderboards updated\n(no changes)\n'
                });
            });

            test('with updates', async () => {
                const update = {
                    message: {
                        text: command,
                        from: { id: 7878, first_name: 'FiRsTnAmE', last_name: 'LaStNaMe' },
                        chat: { id: 2323, type: 'private', title: 'tItLe' }
                    }
                };

                schedule.updateLeaderboards.mockResolvedValueOnce({
                    unretrieved: [],
                    sent: [{ aocUser: 'AoCu1', year: 1980, day: 13 }],
                    created: [{ year: 1980, day: 13 }],
                    updated: []
                });

                await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

                expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                    chat_id: 2323, disable_notification: true,
                    text: `Processing leaderboards and invites (${selectionString})`
                });

                expect(schedule.updateLeaderboards).toHaveBeenCalledWith(expectedSelection);

                expect(logs.logActivity).toHaveBeenCalledWith(`Update triggered by user 'FiRsTnAmE LaStNaMe' (${selectionString})`);

                expect(network.sendTelegram).toHaveBeenNthCalledWith(2, 'sendMessage', {
                    chat_id: 2323, disable_notification: true,
                    text: `Leaderboards updated
• invited AoCu1 to 1980 day 13
• created board for 1980 day 13
` });
            });
        });

        test.each([
            'asdf', 'jkl poi', '1980 a', '1122 11 17'
        ])('with invalid parameters "%s"', async (params) => {
            const update = {
                message: {
                    text: `/update ${params}`,
                    from: { id: 7878, first_name: 'OnLyFiRsTnAmE' },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            schedule.updateLeaderboards.mockResolvedValueOnce({
                unretrieved: [], sent: [], created: [], updated: []
            });

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: 'Invalid parameters \\(see /help\\)'
            });

            expect(schedule.updateLeaderboards).not.toHaveBeenCalled();
            expect(logs.logActivity).not.toHaveBeenCalled();
        });

        test('with no first or last name', async () => {
            const update = {
                message: {
                    text: '/update all',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            schedule.updateLeaderboards.mockResolvedValueOnce({
                unretrieved: [], sent: [], created: [], updated: []
            });

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(logs.logActivity).toHaveBeenCalledWith("Update triggered by user '(id 7878)' (all years)");
        });
    });

    describe('onMessage /help', () => {
        let readFileSpy;

        beforeEach(() => {
            readFileSpy = jest.spyOn(fsp, 'readFile');
        });

        afterEach(() => {
            readFileSpy.mockRestore();
        });

        test('displays help, first time from help.txt', async () => {
            const update = {
                message: {
                    text: '/help',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(readFileSpy).toHaveBeenCalledWith(expect.stringMatching(/\/help\.txt$/), 'utf-8');

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, parse_mode: 'MarkdownV2', disable_notification: true,
                text: expect.stringMatching(/^I can register[^]*this message\\\.\n$/)
            });
        });

        test('displays help, second time from the cache', async () => {
            const update = {
                message: {
                    text: '/help',
                    from: { id: 7878 },
                    chat: { id: 2323, type: 'private', title: 'tItLe' }
                }
            };

            await expect(onTelegramUpdate(update)).resolves.toBeUndefined();

            expect(readFileSpy).not.toHaveBeenCalled();

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, parse_mode: 'MarkdownV2', disable_notification: true,
                text: expect.stringMatching(/^I can register[^]*this message\\\.\n$/)
            });
        });
    });
});
