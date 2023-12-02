'use strict';

const { onMessage } = require('../src/message');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

const network = require('../src/network');
jest.mock('../src/network');

const times = require('../src/times');
jest.mock('../src/times');

const boardFormat = require('../src/board');
jest.mock('../src/board');

const leaderboards = require('../src/leaderboards');
jest.mock('../src/leaderboards');

const logs = require('../src/logs');
jest.mock('../src/logs');

const user = require('../src/user');
jest.mock('../src/user');

const fsp = require('fs/promises');

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
    dynamodb.DynamoDB.prototype.batchWriteItem.mockReset();
    dynamodb.DynamoDB.prototype.getItem.mockReset();
    dynamodb.DynamoDB.prototype.putItem.mockReset();
    logs.enableLogs.mockReset();
    logs.disableLogs.mockReset();
    logs.logActivity.mockReset();
    network.sendTelegram.mockReset();
    leaderboards.updateLeaderboards.mockReset();
    user.renameAocUser.mockReset();
});

describe('onMessage generic', () => {
    test('ignores non-private message', async () => {
        const update = {
            text: 'tExT',
            from: { id: 7878 },
            chat: { id: 2323, type: 'tYpE', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(network.sendTelegram).not.toHaveBeenCalled();
        expect(network.getLeaderboard).not.toHaveBeenCalled();
        expect(times.loadStartTimes).not.toHaveBeenCalled();
    });

    test('ignores message with no text', async () => {
        const update = {
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(network.sendTelegram).not.toHaveBeenCalled();
        expect(network.getLeaderboard).not.toHaveBeenCalled();
        expect(times.loadStartTimes).not.toHaveBeenCalled();
    });

    test('ignores message with no sender', async () => {
        const update = {
            text: 'tExT',
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(network.sendTelegram).not.toHaveBeenCalled();
        expect(network.getLeaderboard).not.toHaveBeenCalled();
        expect(times.loadStartTimes).not.toHaveBeenCalled();
    });

    test('handles message with unknown command', async () => {
        const update = {
            text: 'tExT',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: "Sorry, I don't understand that command"
        });
    });
});

describe('onMessage /reg', () => {
    test('without parameters', async () => {
        const update = {
            text: '/reg',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(user.createUserData).not.toHaveBeenCalled();

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: "Sorry, I don't understand that command"
        });
    });

    test('with a user', async () => {
        const update = {
            text: '/reg Some User',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({});

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(user.deleteTelegramUserData).toHaveBeenCalledWith(7878);
        expect(user.createUserData).toHaveBeenCalledWith('Some User', 7878);

        expect(logs.logActivity).toHaveBeenCalledWith("Registered user 'Some User'");

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, text: "You are now registered as AoC user 'Some User'", disable_notification: true
        });
    });
});

describe('onMessage /unreg', () => {
    test('with unknown user', async () => {
        const update = {
            text: '/unreg',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(user.deleteTelegramUserData).toHaveBeenCalledWith(7878);
        expect(logs.logActivity).not.toHaveBeenCalled();

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, text: 'You are not registered', disable_notification: true
        });
    });

    test('with existing user', async () => {
        const update = {
            text: '/unreg',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        user.deleteTelegramUserData.mockResolvedValueOnce('OlDaOcUsEr');

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(user.deleteTelegramUserData).toHaveBeenCalledWith(7878);
        expect(logs.logActivity).toHaveBeenCalledWith("Unregistered user 'OlDaOcUsEr'");

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: "You are no longer registered (your AoC name was 'OlDaOcUsEr')"
        });
    });
});

describe('onMessage /logs', () => {
    test('with an invalid parameter', async () => {
        const update = {
            text: '/logs xxx',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(logs.enableLogs).not.toHaveBeenCalled();
        expect(logs.disableLogs).not.toHaveBeenCalled();
        expect(logs.getLogsStatus).not.toHaveBeenCalled();

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: "Use '/logs on' to start sending activity logs to you, use '/logs off' to stop. To find out your current setting, use '/logs' without a parameter."
        });
    });

    test('enabling logs for a user', async () => {
        const update = {
            text: '/logs on',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(logs.enableLogs).toHaveBeenCalledWith(2323);
        expect(logs.disableLogs).not.toHaveBeenCalled();
        expect(logs.getLogsStatus).not.toHaveBeenCalled();

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: 'Activity logs will now be sent to this chat'
        });
    });

    test('disabling logs for a user', async () => {
        const update = {
            text: '/logs off',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(logs.enableLogs).not.toHaveBeenCalled();
        expect(logs.disableLogs).toHaveBeenCalledWith(2323);
        expect(logs.getLogsStatus).not.toHaveBeenCalled();

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: 'Activity logs will now be no longer sent to this chat'
        });
    });

    test.each([
        ['enabled', true],
        ['disabled', false]
    ])('getting logs status for a user, with %s logs', async (status, value) => {
        const update = {
            text: '/logs',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        logs.getLogsStatus.mockResolvedValueOnce(value);

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(logs.enableLogs).not.toHaveBeenCalled();
        expect(logs.disableLogs).not.toHaveBeenCalled();
        expect(logs.getLogsStatus).toHaveBeenCalledWith(2323);

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: `Activity logs are ${status} for this chat`
        });
    });
});

describe('onMessage /board', () => {
    test('with invalid parameters', async () => {
        const update = {
            text: '/board xyz abc 123',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: 'Invalid parameters (see /help)'
        });
    });

    test('with empty leaderboard', async () => {
        const update = {
            text: '/board 1980 24',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        network.getLeaderboard.mockResolvedValueOnce(undefined);

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(network.getLeaderboard).toHaveBeenCalledWith(1980);
        expect(times.loadStartTimes).not.toHaveBeenCalled();
        expect(boardFormat.formatBoard).not.toHaveBeenCalled();

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, parse_mode: 'MarkdownV2', disable_notification: true,
            text: 'Could not retrieve leaderboard data'
        });
    });

    describe.each([
        ['no parameters', '/board', { year: 1980, day: 13 }],
        ['the "today" parameter', '/board today', { year: 1980, day: 13 }],
        ['specific date selection, year first', '/board 2001 11', { year: 2001, day: 11 }],
        ['specific date selection, day first', '/board 11 2001', { year: 2001, day: 11 }],
        ['specific date selection, without a year', '/board 19', { year: 1980, day: 19 }]
    ])('with %s', (_description, command, expectedSelection) => {
        beforeEach(() => {
            jest.useFakeTimers('modern');
            // Intentionally use time that falls into different dates in UTC and in EST
            jest.setSystemTime(Date.UTC(1980, 11, 14, 4, 0, 0));
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        test('generates the board', async () => {
            const update = {
                text: command,
                from: { id: 7878 },
                chat: { id: 2323, type: 'private', title: 'tItLe' }
            };

            network.getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd: true });
            times.loadStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: true });
            boardFormat.formatBoard.mockReturnValueOnce('bOaRd');

            await expect(onMessage(update)).resolves.toBeUndefined();

            expect(network.getLeaderboard).toHaveBeenCalledWith(expectedSelection.year);
            expect(times.loadStartTimes).toHaveBeenCalledWith(expectedSelection.year, expectedSelection.day);
            expect(boardFormat.formatBoard).toHaveBeenCalledWith(
                expectedSelection.year, expectedSelection.day, { lEaDeRbOaRd: true }, { sTaRtTiMeS: true });

            expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323, parse_mode: 'MarkdownV2',
                disable_notification: true, disable_web_page_preview: true,
                text: 'bOaRd'
            });
        });
    });

    // TODO test errors from getLeaderboard, loadStartTimes, formatBoard
});

describe('onMessage /status', () => {
    test('with unknown user', async () => {
        const update = {
            text: '/status',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({});

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: {
                id: { S: 'telegram_user' },
                sk: { S: '7878' }
            },
            ProjectionExpression: 'aoc_user'
        });

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, text: 'You are not registered', disable_notification: true
        });
    });

    test('with existing user', async () => {
        const update = {
            text: '/status',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { aoc_user: { S: 'Existing User' } } });

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: { id: { S: 'telegram_user' }, sk: { S: '7878' } },
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
        ['the "year" parameter', '/update year']
    ])('with %s', (_description, command) => {
        beforeEach(() => {
            jest.useFakeTimers('modern');
            jest.setSystemTime(Date.UTC(1980, 8, 17, 8, 0, 0));
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        test('with no updates', async () => {
            const update = {
                text: command,
                from: { id: 7878, first_name: 'OnLyFiRsTnAmE' },
                chat: { id: 2323, type: 'private', title: 'tItLe' }
            };

            leaderboards.updateLeaderboards.mockResolvedValueOnce({
                unretrieved: [], sent: [], created: [], updated: []
            });

            await expect(onMessage(update)).resolves.toBeUndefined();

            expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: 'Processing leaderboards and invites (year 1979)'
            });

            expect(network.sendTelegram).toHaveBeenNthCalledWith(2, 'sendChatAction', {
                chat_id: 2323,
                action: 'typing'
            });

            expect(leaderboards.updateLeaderboards).toHaveBeenCalledWith({ year: 1979 });

            expect(logs.logActivity).toHaveBeenCalledWith("Update triggered by user 'OnLyFiRsTnAmE' (year 1979)");

            expect(network.sendTelegram).toHaveBeenNthCalledWith(3, 'sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: 'Leaderboards updated\n(no changes)\n'
            });
        });

        test('with updates', async () => {
            const update = {
                text: command,
                from: { id: 7878, first_name: 'FiRsTnAmE', last_name: 'LaStNaMe' },
                chat: { id: 2323, type: 'private', title: 'tItLe' }
            };

            leaderboards.updateLeaderboards.mockResolvedValueOnce({
                unretrieved: [{ year: 1984 }, { year: 2345 }],
                sent: [{ aocUser: 'AoCu1', year: 1980, day: 13 }, { aocUser: 'AoCu2', year: 1995, day: 4 }],
                created: [{ year: 1945, day: 2 }, { year: 1815, day: 7 }],
                updated: [{ year: 1918, day: 14 }, { year: 2063, day: 5 }]
            });

            await expect(onMessage(update)).resolves.toBeUndefined();

            expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: 'Processing leaderboards and invites (year 1979)'
            });

            expect(network.sendTelegram).toHaveBeenNthCalledWith(2, 'sendChatAction', {
                chat_id: 2323,
                action: 'typing'
            });

            expect(leaderboards.updateLeaderboards).toHaveBeenCalledWith({ year: 1979 });

            expect(logs.logActivity).toHaveBeenCalledWith("Update triggered by user 'FiRsTnAmE LaStNaMe' (year 1979)");

            expect(network.sendTelegram).toHaveBeenNthCalledWith(3, 'sendMessage', {
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
        ['specific date selection, year first', '/update 2001 11', { year: 2001, day: 11 }, 'year 2001 day 11'],
        ['specific date selection, day first', '/update 11 2001', { year: 2001, day: 11 }, 'year 2001 day 11'],
        ['specific date selection, without a year', '/update 19', { year: 1980, day: 19 }, 'year 1980 day 19'],
        ['specific year selection', '/update 1968', { year: 1968 }, 'year 1968']
    ])('with %s', (_description, command, expectedSelection, selectionString) => {
        beforeEach(() => {
            jest.useFakeTimers('modern');
            // Intentionally use time that falls into different dates in UTC and in EST
            jest.setSystemTime(Date.UTC(1980, 11, 14, 4, 0, 0));
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        test('with no updates', async () => {
            const update = {
                text: command,
                from: { id: 7878, first_name: 'OnLyFiRsTnAmE' },
                chat: { id: 2323, type: 'private', title: 'tItLe' }
            };

            leaderboards.updateLeaderboards.mockResolvedValueOnce({
                unretrieved: [], sent: [], created: [], updated: []
            });

            await expect(onMessage(update)).resolves.toBeUndefined();

            expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: `Processing leaderboards and invites (${selectionString})`
            });

            expect(network.sendTelegram).toHaveBeenNthCalledWith(2, 'sendChatAction', {
                chat_id: 2323,
                action: 'typing'
            });

            expect(leaderboards.updateLeaderboards).toHaveBeenCalledWith(expectedSelection);

            expect(logs.logActivity).toHaveBeenCalledWith(`Update triggered by user 'OnLyFiRsTnAmE' (${selectionString})`);

            expect(network.sendTelegram).toHaveBeenNthCalledWith(3, 'sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: 'Leaderboards updated\n(no changes)\n'
            });
        });

        test('with updates', async () => {
            const update = {
                text: command,
                from: { id: 7878, first_name: 'FiRsTnAmE', last_name: 'LaStNaMe' },
                chat: { id: 2323, type: 'private', title: 'tItLe' }
            };

            leaderboards.updateLeaderboards.mockResolvedValueOnce({
                unretrieved: [],
                sent: [{ aocUser: 'AoCu1', year: 1980, day: 13 }],
                created: [{ year: 1980, day: 13 }],
                updated: []
            });

            await expect(onMessage(update)).resolves.toBeUndefined();

            expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: `Processing leaderboards and invites (${selectionString})`
            });

            expect(network.sendTelegram).toHaveBeenNthCalledWith(2, 'sendChatAction', {
                chat_id: 2323,
                action: 'typing'
            });

            expect(leaderboards.updateLeaderboards).toHaveBeenCalledWith(expectedSelection);

            expect(logs.logActivity).toHaveBeenCalledWith(`Update triggered by user 'FiRsTnAmE LaStNaMe' (${selectionString})`);

            expect(network.sendTelegram).toHaveBeenNthCalledWith(3, 'sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: `Leaderboards updated
• invited AoCu1 to 1980 day 13
• created board for 1980 day 13
` });
        });
    });

    test.each([
        'asdf', 'jkl poi', '1980 a', '1122 11 17',
        '1980 1980', '13 14', '123'
    ])('with invalid parameters "%s"', async (params) => {
        const update = {
            text: `/update ${params}`,
            from: { id: 7878, first_name: 'OnLyFiRsTnAmE' },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        leaderboards.updateLeaderboards.mockResolvedValueOnce({
            unretrieved: [], sent: [], created: [], updated: []
        });

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: 'Invalid parameters (see /help)'
        });

        expect(leaderboards.updateLeaderboards).not.toHaveBeenCalled();
        expect(logs.logActivity).not.toHaveBeenCalled();
    });

    test('with no first or last name', async () => {
        const update = {
            text: '/update 1993',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        leaderboards.updateLeaderboards.mockResolvedValueOnce({
            unretrieved: [], sent: [], created: [], updated: []
        });

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(logs.logActivity).toHaveBeenCalledWith("Update triggered by user '(id 7878)' (year 1993)");
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
            text: '/help',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(readFileSpy).toHaveBeenCalledWith(expect.stringMatching(/\/help\.txt$/), 'utf-8');

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, parse_mode: 'MarkdownV2',
            disable_notification: true, disable_web_page_preview: true,
            text: expect.stringMatching(/^I can register[^]*matushorvath\/aoc-bot\)\n$/)
        });
    });

    test('displays help, second time from the cache', async () => {
        const update = {
            text: '/help',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(readFileSpy).not.toHaveBeenCalled();

        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, parse_mode: 'MarkdownV2',
            disable_notification: true, disable_web_page_preview: true,
            text: expect.stringMatching(/^I can register[^]*matushorvath\/aoc-bot\)\n$/)
        });
    });
});
