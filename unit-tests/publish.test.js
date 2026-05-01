import { publishBoards } from '../src/publish.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { formatBoard } from '../src/board.js';
vi.mock(import('../src/board.js'));

import { sendTelegram } from '../src/network.js';
vi.mock(import('../src/network.js'));

import { mapDaysToChats } from '../src/invites.js';
vi.mock(import('../src/invites.js'));

import { loadStartTimes } from '../src/times.js';
vi.mock(import('../src/times.js'));

import dynamodb from '@aws-sdk/client-dynamodb';
vi.mock(import('@aws-sdk/client-dynamodb'));

describe('publishBoards', () => {
    // TODO board but no days, board days but no chats
    // TODO formatBoard error, mapDaysToChat error
    // TODO dynamo errors (get, put); telegram error send/edit/pin

    beforeEach(() => {
        mapDaysToChats.mockReset();
        formatBoard.mockReset();
        sendTelegram.mockReset();
        loadStartTimes.mockReset();

        dynamodb.DynamoDB.mockReset();
        dynamodb.DynamoDB.prototype.batchGetItem.mockReset();
        dynamodb.DynamoDB.prototype.putItem.mockReset();
    });

    test('with a simple board and start times', async () => {
        const leaderboard = {
            members: {
                '12345': {
                    completion_day_level: {
                        '1': { '1': { get_star_ts: 1638346411 }, '2': { get_star_ts: 1638346788 } },
                        '2': { '1': { get_star_ts: 1638435908 } },
                        '5': { '1': { get_star_ts: 1638346411 }, '2': { get_star_ts: 1638346788 } }
                    }
                },
                '67890': {
                    completion_day_level: {
                        '1': { '1': { get_star_ts: 1638354469 } },
                        '2': { '1': { get_star_ts: 1638432470 }, '2': { get_star_ts: 1638474143 } },
                        '4': { '1': { get_star_ts: 1638509099 } },
                        '6': { '1': { get_star_ts: 1638767262 } }
                    }
                },
                '98765': {
                    completion_day_level: {}
                }
            },
            event: '1918'
        };

        mapDaysToChats.mockResolvedValueOnce({ 1: 111, 2: 222, 4: 444, 6: 666 });
        loadStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: 1 });
        loadStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: 2 });
        loadStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: 4 });
        loadStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: 6 });
        formatBoard.mockReturnValueOnce('bOaRd111');    // 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE='
        formatBoard.mockReturnValueOnce('bOaRd222');    // 'IJo6Pb5KToujTV2uAhd2duw7iNgraffUcMDHYfvmzws='
        formatBoard.mockReturnValueOnce('bOaRd444');    // 'OdcQQdRmhfP2hAFgCekm9m4/jEDKouD9xFxBJEDJOWI='
        formatBoard.mockImplementationOnce(() => { throw new Error('fOrMaTeRrOr666'); });

        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: {
                'aoc-bot': [
                    // No message in db for 111
                    {
                        // Message found in db for 222, same hash
                        chat: { N: '222' },
                        message: { N: '777777' },
                        sha256: { S: 'IJo6Pb5KToujTV2uAhd2duw7iNgraffUcMDHYfvmzws=' }
                    }, {
                        // Message found in db for 444, different hash
                        chat: { N: '444' },
                        message: { N: '888888' },
                        sha256: { S: 'dIfFeReNtHaSh' }
                    }
                ]
            }
        });

        // Return message id of the message created in chat 111
        sendTelegram.mockResolvedValueOnce({ result: { message_id: 999999 } });

        await expect(publishBoards(leaderboard)).resolves.toEqual({
            created: [{ year: 1918, day: 1 }],
            updated: [{ year: 1918, day: 4 }]
        });

        expect(mapDaysToChats).toHaveBeenCalledWith(1918, [1, 2, 5, 4, 6]);

        expect(loadStartTimes).toHaveBeenCalledTimes(4);
        expect(loadStartTimes).toHaveBeenNthCalledWith(1, 1918, 1);
        expect(loadStartTimes).toHaveBeenNthCalledWith(2, 1918, 2);
        expect(loadStartTimes).toHaveBeenNthCalledWith(3, 1918, 4);
        expect(loadStartTimes).toHaveBeenNthCalledWith(4, 1918, 6);

        expect(formatBoard).toHaveBeenCalledTimes(4);
        expect(formatBoard).toHaveBeenNthCalledWith(1, 1918, 1, leaderboard, { sTaRtTiMeS: 1 });
        expect(formatBoard).toHaveBeenNthCalledWith(2, 1918, 2, leaderboard, { sTaRtTiMeS: 2 });
        expect(formatBoard).toHaveBeenNthCalledWith(3, 1918, 4, leaderboard, { sTaRtTiMeS: 4 });
        expect(formatBoard).toHaveBeenNthCalledWith(4, 1918, 6, leaderboard, { sTaRtTiMeS: 6 });

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(1);
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(1, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [
                        { id: { S: 'board' }, sk: { S: '111' } },
                        { id: { S: 'board' }, sk: { S: '222' } },
                        { id: { S: 'board' }, sk: { S: '444' } },
                        { id: { S: 'board' }, sk: { S: '666' } }
                    ],
                    ProjectionExpression: 'chat, message, sha256'
                }
            }
        });

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(3);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board' },
                sk: { S: '111' },
                chat: { N: '111' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board' },
                sk: { S: '111' },
                chat: { N: '111' },
                message: { N: '999999' },
                sha256: { S: 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE=' }
            },
            ConditionExpression: 'attribute_not_exists(sha256) OR sha256 <> :sha256',
            ExpressionAttributeValues: { ':sha256': { S: 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE=' } }
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board' },
                sk: { S: '444' },
                chat: { N: '444' },
                message: { N: '888888' },
                sha256: { S: 'OdcQQdRmhfP2hAFgCekm9m4/jEDKouD9xFxBJEDJOWI=' }
            },
            ConditionExpression: 'attribute_not_exists(sha256) OR sha256 <> :sha256',
            ExpressionAttributeValues: { ':sha256': { S: 'OdcQQdRmhfP2hAFgCekm9m4/jEDKouD9xFxBJEDJOWI=' } }
        });

        expect(sendTelegram).toHaveBeenCalledTimes(3);
        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 111,
            parse_mode: 'MarkdownV2',
            text: 'bOaRd111',
            disable_notification: true,
            disable_web_page_preview: true
        });
        expect(sendTelegram).toHaveBeenCalledWith('pinChatMessage', {
            chat_id: 111,
            message_id: 999999,
            disable_notification: true
        });
        expect(sendTelegram).toHaveBeenCalledWith('editMessageText', {
            chat_id: 444,
            message_id: 888888,
            parse_mode: 'MarkdownV2',
            text: 'bOaRd444',
            disable_web_page_preview: true
        });
    });

    test('handles race conditions', async () => {
        const leaderboard = {
            members: {
                '12345': {
                    completion_day_level: {
                        '1': { '1': { get_star_ts: 1638346411 }, '2': { get_star_ts: 1638346788 } },
                        '2': { '1': { get_star_ts: 1638346411 }, '2': { get_star_ts: 1638346788 } },
                        '3': { '1': { get_star_ts: 1638346411 }, '2': { get_star_ts: 1638346788 } }
                    }
                }
            },
            event: '1918'
        };

        mapDaysToChats.mockResolvedValueOnce({ 1: 111, 2: 222, 3: 333 });

        loadStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: 1 });
        loadStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: 2 });
        loadStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: 3 });

        formatBoard.mockReturnValueOnce('bOaRd111');    // 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE='
        formatBoard.mockReturnValueOnce('bOaRd222');    // 'IJo6Pb5KToujTV2uAhd2duw7iNgraffUcMDHYfvmzws='
        formatBoard.mockReturnValueOnce('bOaRd333');    // ''

        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: {
                'aoc-bot': [
                    // No message in db for 111
                    {
                        // Message found in db for 222, different hash
                        chat: { N: '222' },
                        message: { N: '777777' },
                        sha256: { S: 'dIfFeReNtHaSh' }
                    },
                    {
                        // Lock record found in db for 333, no message or sha256 field
                        chat: { N: '333' }
                    }
                ]
            }
        });

        // Simulate someone changing the records just before we try to lock them
        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' });
        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' });
        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' });

        await expect(publishBoards(leaderboard)).resolves.toEqual({
            created: [],
            updated: []
        });

        expect(mapDaysToChats).toHaveBeenCalledWith(1918, [1, 2, 3]);

        expect(loadStartTimes).toHaveBeenCalledTimes(3);
        expect(loadStartTimes).toHaveBeenNthCalledWith(1, 1918, 1);
        expect(loadStartTimes).toHaveBeenNthCalledWith(2, 1918, 2);
        expect(loadStartTimes).toHaveBeenNthCalledWith(3, 1918, 3);

        expect(formatBoard).toHaveBeenCalledTimes(3);
        expect(formatBoard).toHaveBeenNthCalledWith(1, 1918, 1, leaderboard, { sTaRtTiMeS: 1 });
        expect(formatBoard).toHaveBeenNthCalledWith(2, 1918, 2, leaderboard, { sTaRtTiMeS: 2 });
        expect(formatBoard).toHaveBeenNthCalledWith(3, 1918, 3, leaderboard, { sTaRtTiMeS: 3 });

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(1);
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(1, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [
                        { id: { S: 'board' }, sk: { S: '111' } },
                        { id: { S: 'board' }, sk: { S: '222' } },
                        { id: { S: 'board' }, sk: { S: '333' } }
                    ],
                    ProjectionExpression: 'chat, message, sha256'
                }
            }
        });

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(3);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board' },
                sk: { S: '111' },
                chat: { N: '111' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board' },
                sk: { S: '222' },
                chat: { N: '222' },
                message: { N: '777777' },
                sha256: { S: 'IJo6Pb5KToujTV2uAhd2duw7iNgraffUcMDHYfvmzws=' }
            },
            ConditionExpression: 'attribute_not_exists(sha256) OR sha256 <> :sha256',
            ExpressionAttributeValues: { ':sha256': { S: 'IJo6Pb5KToujTV2uAhd2duw7iNgraffUcMDHYfvmzws=' } }
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board' },
                sk: { S: '333' },
                chat: { N: '333' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });

        expect(sendTelegram).not.toHaveBeenCalled();
    });

    test('handles error in lockBoardMessage', async () => {
        const leaderboard = {
            members: {
                '12345': {
                    completion_day_level: {
                        '1': { '1': { get_star_ts: 1638346411 }, '2': { get_star_ts: 1638346788 } }
                    }
                }
            },
            event: '1918'
        };

        mapDaysToChats.mockResolvedValueOnce({ 1: 111 });
        loadStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: 1 });
        formatBoard.mockReturnValueOnce('bOaRd111');    // 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE='

        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: {
                'aoc-bot': [
                    // No message in db for 111
                ]
            }
        });

        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce(new Error('dYnAmOfAiLeD'));

        await expect(publishBoards(leaderboard)).resolves.toEqual({
            created: [],
            updated: []
        });

        expect(mapDaysToChats).toHaveBeenCalledWith(1918, [1]);

        expect(loadStartTimes).toHaveBeenCalledTimes(1);
        expect(loadStartTimes).toHaveBeenNthCalledWith(1, 1918, 1);

        expect(formatBoard).toHaveBeenCalledTimes(1);
        expect(formatBoard).toHaveBeenNthCalledWith(1, 1918, 1, leaderboard, { sTaRtTiMeS: 1 });

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(1);
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(1, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [{
                        id: { S: 'board' },
                        sk: { S: '111' }
                    }],
                    ProjectionExpression: 'chat, message, sha256'
                }
            }
        });

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(1);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board' },
                sk: { S: '111' },
                chat: { N: '111' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });

        expect(sendTelegram).not.toHaveBeenCalled();
    });

    test('handles error in saveBoardMessage', async () => {
        const leaderboard = {
            members: {
                '12345': {
                    completion_day_level: {
                        '1': { '1': { get_star_ts: 1638346411 }, '2': { get_star_ts: 1638346788 } }
                    }
                }
            },
            event: '1918'
        };

        mapDaysToChats.mockResolvedValueOnce({ 1: 111 });
        loadStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: 1 });
        formatBoard.mockReturnValueOnce('bOaRd111');    // 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE='

        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: {
                'aoc-bot': [
                    {
                        // Message found in db for 111, different hash
                        chat: { N: '111' },
                        message: { N: '777777' },
                        sha256: { S: 'dIfFeReNtHaSh' }
                    }
                ]
            }
        });

        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce(new Error('dYnAmOfAiLeD'));

        await expect(publishBoards(leaderboard)).resolves.toEqual({
            created: [],
            updated: []
        });

        expect(mapDaysToChats).toHaveBeenCalledWith(1918, [1]);

        expect(loadStartTimes).toHaveBeenCalledTimes(1);
        expect(loadStartTimes).toHaveBeenNthCalledWith(1, 1918, 1);

        expect(formatBoard).toHaveBeenCalledTimes(1);
        expect(formatBoard).toHaveBeenNthCalledWith(1, 1918, 1, leaderboard, { sTaRtTiMeS: 1 });

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(1);
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(1, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [{
                        id: { S: 'board' },
                        sk: { S: '111' }
                    }],
                    ProjectionExpression: 'chat, message, sha256'
                }
            }
        });

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(1);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board' },
                sk: { S: '111' },
                chat: { N: '111' },
                message: { N: '777777' },
                sha256: { S: 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE=' }
            },
            ConditionExpression: 'attribute_not_exists(sha256) OR sha256 <> :sha256',
            ExpressionAttributeValues: { ':sha256': { S: 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE=' } }
        });

        expect(sendTelegram).not.toHaveBeenCalled();
    });

    test('selected day is applied', async () => {
        const leaderboard = {
            members: {
                '12345': {
                    completion_day_level: {
                        '1': { '1': { get_star_ts: 1638346411 }, '2': { get_star_ts: 1638346788 } },
                        '9': { '1': { get_star_ts: 1638346411 }, '2': { get_star_ts: 1638346788 } }
                    }
                }
            },
            event: '1918'
        };

        mapDaysToChats.mockResolvedValueOnce({ 9: 999 });
        loadStartTimes.mockResolvedValueOnce({ sTaRtTiMeS: 9 });
        formatBoard.mockReturnValueOnce('bOaRd999');

        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: {
                'aoc-bot': [
                    {
                        // Message found in db for 999, different hash
                        chat: { N: '999' },
                        message: { N: '777777' },
                        sha256: { S: 'dIfFeReNtHaSh' }
                    }
                ]
            }
        });

        await expect(publishBoards(leaderboard, { year: 1918, day: 9 })).resolves.toEqual({
            created: [],
            updated: [{ year: 1918, day: 9 }]
        });

        expect(mapDaysToChats).toHaveBeenCalledWith(1918, [9]);

        expect(loadStartTimes).toHaveBeenCalledTimes(1);
        expect(loadStartTimes).toHaveBeenNthCalledWith(1, 1918, 9);

        expect(formatBoard).toHaveBeenCalledTimes(1);
        expect(formatBoard).toHaveBeenNthCalledWith(1, 1918, 9, leaderboard, { sTaRtTiMeS: 9 });

        expect(sendTelegram).toHaveBeenCalledTimes(1);
        expect(sendTelegram).toHaveBeenCalledWith('editMessageText', {
            chat_id: 999,
            message_id: 777777,
            parse_mode: 'MarkdownV2',
            text: 'bOaRd999',
            disable_web_page_preview: true
        });
    });

    test.each([
        ['year', { year: 1492 }],
        ['day', { year: 1918, day: 15 }]
    ])('selected %s not in leaderboard', async (_description, selection) => {
        const leaderboard = {
            members: {
                '12345': {
                    completion_day_level: {
                        '1': { '1': { get_star_ts: 1638346411 }, '2': { get_star_ts: 1638346788 } }
                    }
                }
            },
            event: '1918'
        };

        await expect(publishBoards(leaderboard, selection)).resolves.toEqual({
            created: [],
            updated: []
        });

        expect(mapDaysToChats).not.toHaveBeenCalled();
        expect(formatBoard).not.toHaveBeenCalled();
        expect(sendTelegram).not.toHaveBeenCalled();
    });
});
