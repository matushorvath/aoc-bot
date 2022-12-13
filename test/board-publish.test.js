'use strict';

const { publishBoards } = require('../src/board-publish');

const boardFormat = require('../src/board-format');
jest.mock('../src/board-format');

const network = require('../src/network');
jest.mock('../src/network');

const invites = require('../src/invites');
jest.mock('../src/invites');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

describe('publishBoards', () => {
    // TODO board but no days, board days but no chats
    // TODO formatBoard error, mapDaysToChat error
    // TODO dynamo errors (get, put); telegram error send/edit/pin

    beforeEach(() => {
        invites.mapDaysToChats.mockReset();
        boardFormat.formatBoard.mockReset();
        network.sendTelegram.mockReset();

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

        invites.mapDaysToChats.mockResolvedValueOnce({ 1: 111, 2: 222, 4: 444, 6: 666 });
        boardFormat.formatBoard.mockReturnValueOnce('bOaRd111');    // 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE='
        boardFormat.formatBoard.mockReturnValueOnce('bOaRd222');    // 'IJo6Pb5KToujTV2uAhd2duw7iNgraffUcMDHYfvmzws='
        boardFormat.formatBoard.mockReturnValueOnce('bOaRd444');    // 'OdcQQdRmhfP2hAFgCekm9m4/jEDKouD9xFxBJEDJOWI='
        boardFormat.formatBoard.mockImplementationOnce(() => { throw new Error('fOrMaTeRrOr666'); });

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
        network.sendTelegram.mockResolvedValueOnce({ result: { message_id: 999999 } });

        await expect(publishBoards(leaderboard, { sTaRtTiMeS: true })).resolves.toEqual({
            created: [{ year: 1918, day: 1 }],
            updated: [{ year: 1918, day: 4 }]
        });

        expect(invites.mapDaysToChats).toHaveBeenCalledWith(1918, [1, 2, 5, 4, 6]);

        expect(boardFormat.formatBoard).toHaveBeenCalledTimes(4);
        expect(boardFormat.formatBoard).toHaveBeenNthCalledWith(1, 1918, 1, leaderboard, { sTaRtTiMeS: true });
        expect(boardFormat.formatBoard).toHaveBeenNthCalledWith(2, 1918, 2, leaderboard, { sTaRtTiMeS: true });
        expect(boardFormat.formatBoard).toHaveBeenNthCalledWith(3, 1918, 4, leaderboard, { sTaRtTiMeS: true });
        expect(boardFormat.formatBoard).toHaveBeenNthCalledWith(4, 1918, 6, leaderboard, { sTaRtTiMeS: true });

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(1);
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(1, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [
                        { id: { S: 'board:111' } },
                        { id: { S: 'board:222' } },
                        { id: { S: 'board:444' } },
                        { id: { S: 'board:666' } }
                    ],
                    ProjectionExpression: 'chat, message, sha256'
                }
            }
        });

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(3);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board:111' },
                chat: { N: '111' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board:111' },
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
                id: { S: 'board:444' },
                chat: { N: '444' },
                message: { N: '888888' },
                sha256: { S: 'OdcQQdRmhfP2hAFgCekm9m4/jEDKouD9xFxBJEDJOWI=' }
            },
            ConditionExpression: 'attribute_not_exists(sha256) OR sha256 <> :sha256',
            ExpressionAttributeValues: { ':sha256': { S: 'OdcQQdRmhfP2hAFgCekm9m4/jEDKouD9xFxBJEDJOWI=' } }
        });

        expect(network.sendTelegram).toHaveBeenCalledTimes(3);
        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 111,
            parse_mode: 'MarkdownV2',
            text: 'bOaRd111',
            disable_notification: true,
            disable_web_page_preview: true
        });
        expect(network.sendTelegram).toHaveBeenCalledWith('pinChatMessage', {
            chat_id: 111,
            message_id: 999999,
            disable_notification: true
        });
        expect(network.sendTelegram).toHaveBeenCalledWith('editMessageText', {
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

        invites.mapDaysToChats.mockResolvedValueOnce({ 1: 111, 2: 222, 3: 333 });
        boardFormat.formatBoard.mockReturnValueOnce('bOaRd111');    // 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE='
        boardFormat.formatBoard.mockReturnValueOnce('bOaRd222');    // 'IJo6Pb5KToujTV2uAhd2duw7iNgraffUcMDHYfvmzws='
        boardFormat.formatBoard.mockReturnValueOnce('bOaRd333');    // ''

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

        await expect(publishBoards(leaderboard, { sTaRtTiMeS: true })).resolves.toEqual({
            created: [],
            updated: []
        });

        expect(invites.mapDaysToChats).toHaveBeenCalledWith(1918, [1, 2, 3]);

        expect(boardFormat.formatBoard).toHaveBeenCalledTimes(3);
        expect(boardFormat.formatBoard).toHaveBeenNthCalledWith(1, 1918, 1, leaderboard, { sTaRtTiMeS: true });
        expect(boardFormat.formatBoard).toHaveBeenNthCalledWith(2, 1918, 2, leaderboard, { sTaRtTiMeS: true });
        expect(boardFormat.formatBoard).toHaveBeenNthCalledWith(3, 1918, 3, leaderboard, { sTaRtTiMeS: true });

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(1);
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(1, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [
                        { id: { S: 'board:111' } },
                        { id: { S: 'board:222' } },
                        { id: { S: 'board:333' } }
                    ],
                    ProjectionExpression: 'chat, message, sha256'
                }
            }
        });

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(3);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board:111' },
                chat: { N: '111' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board:222' },
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
                id: { S: 'board:333' },
                chat: { N: '333' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });

        expect(network.sendTelegram).not.toHaveBeenCalled();
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

        invites.mapDaysToChats.mockResolvedValueOnce({ 1: 111 });
        boardFormat.formatBoard.mockReturnValueOnce('bOaRd111');    // 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE='

        dynamodb.DynamoDB.prototype.batchGetItem.mockResolvedValueOnce({
            Responses: {
                'aoc-bot': [
                    // No message in db for 111
                ]
            }
        });

        // Simulate someone changing the records just before we try to lock them
        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce(new Error('dYnAmOfAiLeD'));

        await expect(publishBoards(leaderboard, { sTaRtTiMeS: true })).resolves.toEqual({
            created: [],
            updated: []
        });

        expect(invites.mapDaysToChats).toHaveBeenCalledWith(1918, [1]);

        expect(boardFormat.formatBoard).toHaveBeenCalledTimes(1);
        expect(boardFormat.formatBoard).toHaveBeenNthCalledWith(1, 1918, 1, leaderboard, { sTaRtTiMeS: true });

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(1);
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(1, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [
                        { id: { S: 'board:111' } }
                    ],
                    ProjectionExpression: 'chat, message, sha256'
                }
            }
        });

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(1);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board:111' },
                chat: { N: '111' }
            },
            ConditionExpression: 'attribute_not_exists(id)'
        });

        expect(network.sendTelegram).not.toHaveBeenCalled();
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

        invites.mapDaysToChats.mockResolvedValueOnce({ 1: 111 });
        boardFormat.formatBoard.mockReturnValueOnce('bOaRd111');    // 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE='

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

        // Simulate someone changing the records just before we try to lock them
        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce(new Error('dYnAmOfAiLeD'));

        await expect(publishBoards(leaderboard, { sTaRtTiMeS: true })).resolves.toEqual({
            created: [],
            updated: []
        });

        expect(invites.mapDaysToChats).toHaveBeenCalledWith(1918, [1]);

        expect(boardFormat.formatBoard).toHaveBeenCalledTimes(1);
        expect(boardFormat.formatBoard).toHaveBeenNthCalledWith(1, 1918, 1, leaderboard, { sTaRtTiMeS: true });

        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenCalledTimes(1);
        expect(dynamodb.DynamoDB.prototype.batchGetItem).toHaveBeenNthCalledWith(1, {
            RequestItems: {
                'aoc-bot': {
                    Keys: [
                        { id: { S: 'board:111' } }
                    ],
                    ProjectionExpression: 'chat, message, sha256'
                }
            }
        });

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(1);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board:111' },
                chat: { N: '111' },
                message: { N: '777777' },
                sha256: { S: 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE=' }
            },
            ConditionExpression: 'attribute_not_exists(sha256) OR sha256 <> :sha256',
            ExpressionAttributeValues: { ':sha256': { S: 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE=' } }
        });

        expect(network.sendTelegram).not.toHaveBeenCalled();
    });
});
