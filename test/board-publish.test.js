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

        dynamodb.DynamoDB.prototype.getItem.mockReset();
        dynamodb.DynamoDB.prototype.putItem.mockReset();
    });

    test('with a simple board and start times', async () => {
        const leaderboard = {
            members: {
                '12345': {
                    completion_day_level: {
                        '1': { '1': { get_star_ts: 1638346411 }, '2': { get_star_ts: 1638346788 } },
                        '2': { '1': { get_star_ts: 1638435908 } },
                        '5': { '1': { get_star_ts: 1638346411 }, '2': { get_star_ts: 1638346788 }
                        },
                    }
                },
                '67890': {
                    completion_day_level: {
                        '1': { '1': { get_star_ts: 1638354469 }, },
                        '2': { '1': { get_star_ts: 1638432470 }, '2': { get_star_ts: 1638474143 } },
                        '4': { '1': { get_star_ts: 1638509099 } }
                    }
                },
                '98765': {
                    completion_day_level: {}
                }
            },
            event: '1918'
        };

        invites.mapDaysToChats.mockResolvedValueOnce({ 1: 111, 2: 222, 4: 444 });
        boardFormat.formatBoard.mockReturnValueOnce('bOaRd111');    // '2INkWWDej19GH+0clyxLxE4/vttyHYuRQ+V+E/Fq8kU='
        boardFormat.formatBoard.mockReturnValueOnce('bOaRd222');    // 'RgabrYcLKO7hBXKpvA7ejffjxlRNeyS0MTjnAEGIVLg='
        boardFormat.formatBoard.mockReturnValueOnce('bOaRd444');    // 'FbplNUZdPUMuEBC6Z2BDOAEVMWVFnpeZ4Xiy1Zp+QMk='

        // No message in db for 111
        dynamodb.DynamoDB.prototype.getItem.mockReturnValueOnce({});
        // Message found in db for 222, same hash
        dynamodb.DynamoDB.prototype.getItem.mockReturnValueOnce({ Item: {
            message: { N: '777777' },
            sha256: { S: 'RgabrYcLKO7hBXKpvA7ejffjxlRNeyS0MTjnAEGIVLg=' }
        } });
        // Message found in db for 222, different hash
        dynamodb.DynamoDB.prototype.getItem.mockReturnValueOnce({ Item: {
            message: { N: '888888' },
            sha256: { S: 'dIfFeReNtHaSh' }
        } });

        // Return message id of the message created in chat 111
        network.sendTelegram.mockResolvedValueOnce({ result: { message_id: 999999 } });

        await expect(publishBoards(leaderboard, { sTaRtTiMeS: true })).resolves.toBe(undefined);

        expect(invites.mapDaysToChats).toHaveBeenCalledWith(1918, [1, 2, 5, 4]);

        expect(boardFormat.formatBoard).toHaveBeenCalledTimes(3);
        expect(boardFormat.formatBoard).toHaveBeenNthCalledWith(1, 1918, 1, leaderboard, { sTaRtTiMeS: true });
        expect(boardFormat.formatBoard).toHaveBeenNthCalledWith(2, 1918, 2, leaderboard, { sTaRtTiMeS: true });
        expect(boardFormat.formatBoard).toHaveBeenNthCalledWith(3, 1918, 4, leaderboard, { sTaRtTiMeS: true });

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledTimes(3);
        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenNthCalledWith(1, {
            TableName: 'aoc-bot',
            Key: { id: { S: 'board:111' } },
            ProjectionExpression: 'message, sha256'
        });
        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenNthCalledWith(2, {
            TableName: 'aoc-bot',
            Key: { id: { S: 'board:222' } },
            ProjectionExpression: 'message, sha256'
        });
        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenNthCalledWith(3, {
            TableName: 'aoc-bot',
            Key: { id: { S: 'board:444' } },
            ProjectionExpression: 'message, sha256'
        });

        expect(network.sendTelegram).toHaveBeenCalledTimes(3);
        expect(network.sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 111,
            parse_mode: 'MarkdownV2',
            text: '```\nbOaRd111\n```',
            disable_notification: true
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
            text: '```\nbOaRd444\n```'
        });

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(2);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board:111' },
                chat: { N: '111' },
                message: { N: '999999' },
                sha256: { S: '2INkWWDej19GH+0clyxLxE4/vttyHYuRQ+V+E/Fq8kU=' }
            }
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board:444' },
                chat: { N: '444' },
                message: { N: '888888' },
                sha256: { S: 'FbplNUZdPUMuEBC6Z2BDOAEVMWVFnpeZ4Xiy1Zp+QMk=' }
            }
        });
    });
});