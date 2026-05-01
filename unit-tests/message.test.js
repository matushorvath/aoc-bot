import { onMessage } from '../src/message.js';
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import dynamodb from '@aws-sdk/client-dynamodb';
vi.mock(import('@aws-sdk/client-dynamodb'));

import { getLeaderboard, sendTelegram } from '../src/network.js';
vi.mock(import('../src/network.js'));

import { loadStartTimes } from '../src/times.js';
vi.mock(import('../src/times.js'));

import { formatBoard } from '../src/board.js';
vi.mock(import('../src/board.js'));

import { updateLeaderboards } from '../src/leaderboards.js';
vi.mock(import('../src/leaderboards.js'));

import { disableLogs, enableLogs, getLogsStatus, logActivity } from '../src/logs.js';
vi.mock(import('../src/logs.js'));

import { createUserData, deleteTelegramUserData, renameAocUser } from '../src/user.js';
vi.mock(import('../src/user.js'));

import { forceInvite } from '../src/invites.js';
vi.mock(import('../src/invites.js'));

import fs from 'fs/promises';

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
    dynamodb.DynamoDB.prototype.getItem.mockReset();
    dynamodb.DynamoDB.prototype.putItem.mockReset();

    enableLogs.mockReset();
    disableLogs.mockReset();
    logActivity.mockReset();
    sendTelegram.mockReset();
    updateLeaderboards.mockReset();
    createUserData.mockReset();
    deleteTelegramUserData.mockReset();
    renameAocUser.mockReset();
});

describe('onMessage generic', () => {
    test('ignores non-private message', async () => {
        const update = {
            text: 'tExT',
            from: { id: 7878 },
            chat: { id: 2323, type: 'tYpE', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(sendTelegram).not.toHaveBeenCalled();
        expect(getLeaderboard).not.toHaveBeenCalled();
        expect(loadStartTimes).not.toHaveBeenCalled();
    });

    test('ignores message with no text', async () => {
        const update = {
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(sendTelegram).not.toHaveBeenCalled();
        expect(getLeaderboard).not.toHaveBeenCalled();
        expect(loadStartTimes).not.toHaveBeenCalled();
    });

    test('ignores message with no sender', async () => {
        const update = {
            text: 'tExT',
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(sendTelegram).not.toHaveBeenCalled();
        expect(getLeaderboard).not.toHaveBeenCalled();
        expect(loadStartTimes).not.toHaveBeenCalled();
    });

    test('handles message with unknown command', async () => {
        const update = {
            text: 'tExT',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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

        expect(createUserData).not.toHaveBeenCalled();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(deleteTelegramUserData).toHaveBeenCalledWith(7878);
        expect(createUserData).toHaveBeenCalledWith('Some User', 7878);

        expect(logActivity).toHaveBeenCalledWith("Registered user 'Some User'");

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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

        expect(deleteTelegramUserData).toHaveBeenCalledWith(7878);
        expect(logActivity).not.toHaveBeenCalled();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, text: 'You are not registered', disable_notification: true
        });
    });

    test('with existing user', async () => {
        const update = {
            text: '/unreg',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        deleteTelegramUserData.mockResolvedValueOnce('OlDaOcUsEr');

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(deleteTelegramUserData).toHaveBeenCalledWith(7878);
        expect(logActivity).toHaveBeenCalledWith("Unregistered user 'OlDaOcUsEr'");

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: "You are no longer registered (your AoC name was 'OlDaOcUsEr')"
        });
    });
});

describe('onMessage /rename', () => {
    test('without parameters', async () => {
        const update = {
            text: '/rename',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(renameAocUser).not.toHaveBeenCalled();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: 'Invalid parameters (see /help)'
        });
    });

    test('with invalid parameters', async () => {
        const update = {
            text: '/rename Old User New User',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(renameAocUser).not.toHaveBeenCalled();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: 'Invalid parameters (see /help)'
        });
    });

    test('when user is not found', async () => {
        const update = {
            text: '/rename "Old User" "New User"',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        renameAocUser.mockResolvedValueOnce(false);

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(renameAocUser).toHaveBeenCalledWith('Old User', 'New User');
        expect(logActivity).not.toHaveBeenCalled();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, text: "AoC user 'Old User' not found", disable_notification: true
        });
    });

    test('with valid users', async () => {
        const update = {
            text: '/rename "Old User" "New User"',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        renameAocUser.mockResolvedValueOnce(true);

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(renameAocUser).toHaveBeenCalledWith('Old User', 'New User');
        expect(logActivity).toHaveBeenCalledWith("Renamed AoC user 'Old User' to 'New User'");

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, text: "Renamed AoC user 'Old User' to 'New User'", disable_notification: true
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

        expect(enableLogs).not.toHaveBeenCalled();
        expect(disableLogs).not.toHaveBeenCalled();
        expect(getLogsStatus).not.toHaveBeenCalled();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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

        expect(enableLogs).toHaveBeenCalledWith(2323);
        expect(disableLogs).not.toHaveBeenCalled();
        expect(getLogsStatus).not.toHaveBeenCalled();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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

        expect(enableLogs).not.toHaveBeenCalled();
        expect(disableLogs).toHaveBeenCalledWith(2323);
        expect(getLogsStatus).not.toHaveBeenCalled();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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

        getLogsStatus.mockResolvedValueOnce(value);

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(enableLogs).not.toHaveBeenCalled();
        expect(disableLogs).not.toHaveBeenCalled();
        expect(getLogsStatus).toHaveBeenCalledWith(2323);

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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

        getLeaderboard.mockResolvedValueOnce(undefined);

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(getLeaderboard).toHaveBeenCalledWith(1980);
        expect(loadStartTimes).not.toHaveBeenCalled();
        expect(formatBoard).not.toHaveBeenCalled();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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
            vi.useFakeTimers('modern');
            // Intentionally use time that falls into different dates in UTC and in EST
            vi.setSystemTime(Date.UTC(1980, 11, 14, 4, 0, 0));
        });

        afterAll(() => {
            vi.useRealTimers();
        });

        test('generates the board', async () => {
            const update = {
                text: command,
                from: { id: 7878 },
                chat: { id: 2323, type: 'private', title: 'tItLe' }
            };

            getLeaderboard.mockResolvedValueOnce({ lEaDeRbOaRd: true });
            loadStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: true });
            formatBoard.mockReturnValueOnce('bOaRd');

            await expect(onMessage(update)).resolves.toBeUndefined();

            expect(getLeaderboard).toHaveBeenCalledWith(expectedSelection.year);
            expect(loadStartTimes).toHaveBeenCalledWith(expectedSelection.year, expectedSelection.day);
            expect(formatBoard).toHaveBeenCalledWith(
                expectedSelection.year, expectedSelection.day, { lEaDeRbOaRd: true }, { sTaRtTiMeS: true });

            expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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
            vi.useFakeTimers('modern');
            vi.setSystemTime(Date.UTC(1980, 8, 17, 8, 0, 0));
        });

        afterAll(() => {
            vi.useRealTimers();
        });

        test('with no updates', async () => {
            const update = {
                text: command,
                from: { id: 7878, first_name: 'OnLyFiRsTnAmE' },
                chat: { id: 2323, type: 'private', title: 'tItLe' }
            };

            updateLeaderboards.mockResolvedValueOnce({
                unretrieved: [], sent: [], created: [], updated: []
            });

            await expect(onMessage(update)).resolves.toBeUndefined();

            expect(sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: 'Processing leaderboards and invites (year 1979)'
            });

            expect(sendTelegram).toHaveBeenNthCalledWith(2, 'sendChatAction', {
                chat_id: 2323,
                action: 'typing'
            });

            expect(updateLeaderboards).toHaveBeenCalledWith({ year: 1979 });

            expect(logActivity).toHaveBeenCalledWith("Update triggered by user 'OnLyFiRsTnAmE' (year 1979)");

            expect(sendTelegram).toHaveBeenNthCalledWith(3, 'sendMessage', {
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

            updateLeaderboards.mockResolvedValueOnce({
                unretrieved: [{ year: 1984 }, { year: 2345 }],
                sent: [{ aocUser: 'AoCu1', year: 1980, day: 13 }, { aocUser: 'AoCu2', year: 1995, day: 4 }],
                created: [{ year: 1945, day: 2 }, { year: 1815, day: 7 }],
                updated: [{ year: 1918, day: 14 }, { year: 2063, day: 5 }]
            });

            await expect(onMessage(update)).resolves.toBeUndefined();

            expect(sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: 'Processing leaderboards and invites (year 1979)'
            });

            expect(sendTelegram).toHaveBeenNthCalledWith(2, 'sendChatAction', {
                chat_id: 2323,
                action: 'typing'
            });

            expect(updateLeaderboards).toHaveBeenCalledWith({ year: 1979 });

            expect(logActivity).toHaveBeenCalledWith("Update triggered by user 'FiRsTnAmE LaStNaMe' (year 1979)");

            expect(sendTelegram).toHaveBeenNthCalledWith(3, 'sendMessage', {
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
            vi.useFakeTimers('modern');
            // Intentionally use time that falls into different dates in UTC and in EST
            vi.setSystemTime(Date.UTC(1980, 11, 14, 4, 0, 0));
        });

        afterAll(() => {
            vi.useRealTimers();
        });

        test('with no updates', async () => {
            const update = {
                text: command,
                from: { id: 7878, first_name: 'OnLyFiRsTnAmE' },
                chat: { id: 2323, type: 'private', title: 'tItLe' }
            };

            updateLeaderboards.mockResolvedValueOnce({
                unretrieved: [], sent: [], created: [], updated: []
            });

            await expect(onMessage(update)).resolves.toBeUndefined();

            expect(sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: `Processing leaderboards and invites (${selectionString})`
            });

            expect(sendTelegram).toHaveBeenNthCalledWith(2, 'sendChatAction', {
                chat_id: 2323,
                action: 'typing'
            });

            expect(updateLeaderboards).toHaveBeenCalledWith(expectedSelection);

            expect(logActivity).toHaveBeenCalledWith(`Update triggered by user 'OnLyFiRsTnAmE' (${selectionString})`);

            expect(sendTelegram).toHaveBeenNthCalledWith(3, 'sendMessage', {
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

            updateLeaderboards.mockResolvedValueOnce({
                unretrieved: [],
                sent: [{ aocUser: 'AoCu1', year: 1980, day: 13 }],
                created: [{ year: 1980, day: 13 }],
                updated: []
            });

            await expect(onMessage(update)).resolves.toBeUndefined();

            expect(sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
                chat_id: 2323, disable_notification: true,
                text: `Processing leaderboards and invites (${selectionString})`
            });

            expect(sendTelegram).toHaveBeenNthCalledWith(2, 'sendChatAction', {
                chat_id: 2323,
                action: 'typing'
            });

            expect(updateLeaderboards).toHaveBeenCalledWith(expectedSelection);

            expect(logActivity).toHaveBeenCalledWith(`Update triggered by user 'FiRsTnAmE LaStNaMe' (${selectionString})`);

            expect(sendTelegram).toHaveBeenNthCalledWith(3, 'sendMessage', {
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

        updateLeaderboards.mockResolvedValueOnce({
            unretrieved: [], sent: [], created: [], updated: []
        });

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: 'Invalid parameters (see /help)'
        });

        expect(updateLeaderboards).not.toHaveBeenCalled();
        expect(logActivity).not.toHaveBeenCalled();
    });

    test('with no first or last name', async () => {
        const update = {
            text: '/update 1993',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        updateLeaderboards.mockResolvedValueOnce({
            unretrieved: [], sent: [], created: [], updated: []
        });

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(logActivity).toHaveBeenCalledWith("Update triggered by user '(id 7878)' (year 1993)");
    });
});

describe('onMessage /help', () => {
    let readFileSpy;

    beforeEach(() => {
        readFileSpy = vi.spyOn(fs, 'readFile');
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

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
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

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, parse_mode: 'MarkdownV2',
            disable_notification: true, disable_web_page_preview: true,
            text: expect.stringMatching(/^I can register[^]*matushorvath\/aoc-bot\)\n$/)
        });
    });
});

describe('onMessage /invite', () => {
    test('with invalid parameters', async () => {
        const update = {
            text: '/invite xyz abc 123',
            from: { id: 7878 },
            chat: { id: 2323, type: 'private', title: 'tItLe' }
        };

        await expect(onMessage(update)).resolves.toBeUndefined();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 2323, disable_notification: true,
            text: 'Invalid parameters (see /help)'
        });
    });

    describe.each([
        ['no parameters', '/invite', { year: 1980, day: 13 }],
        ['the "today" parameter', '/invite today', { year: 1980, day: 13 }],
        ['specific date selection, year first', '/invite 2001 11', { year: 2001, day: 11 }],
        ['specific date selection, day first', '/invite 11 2001', { year: 2001, day: 11 }],
        ['specific date selection, without a year', '/invite 19', { year: 1980, day: 19 }]
    ])('with %s', (_description, command, selection) => {
        beforeEach(() => {
            vi.useFakeTimers('modern');
            // Intentionally use time that falls into different dates in UTC and in EST
            vi.setSystemTime(Date.UTC(1980, 11, 14, 4, 0, 0));
        });

        afterAll(() => {
            vi.useRealTimers();
        });

        test('sends an invite', async () => {
            const update = {
                text: command,
                from: { id: 7878 },
                chat: { id: 2323, type: 'private', title: 'tItLe' }
            };

            forceInvite.mockResolvedValueOnce(true);

            await expect(onMessage(update)).resolves.toBeUndefined();

            expect(sendTelegram).toHaveBeenCalledWith('sendChatAction', { chat_id: 2323, action: 'upload_document' });

            expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323,
                text: 'Invite was sent',
                disable_notification: true
            });
        });

        test('does not send an invite', async () => {
            const update = {
                text: command,
                from: { id: 7878 },
                chat: { id: 2323, type: 'private', title: 'tItLe' }
            };

            forceInvite.mockResolvedValueOnce(false);

            await expect(onMessage(update)).resolves.toBeUndefined();

            expect(sendTelegram).toHaveBeenCalledWith('sendChatAction', { chat_id: 2323, action: 'upload_document' });

            expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
                chat_id: 2323,
                text: `Could not invite you to chat ${selection.year} day ${selection.day}`,
                disable_notification: true
            });
        });
    });
});
