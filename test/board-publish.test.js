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

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(2);
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board:111' },
                chat: { N: '111' },
                message: { N: '999999' },
                sha256: { S: 'e9HOtOs9fRo24Vk4SjUb0pxmuoSQBEz9gHOYxwgrByE=' }
            }
        });
        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'board:444' },
                chat: { N: '444' },
                message: { N: '888888' },
                sha256: { S: 'OdcQQdRmhfP2hAFgCekm9m4/jEDKouD9xFxBJEDJOWI=' }
            }
        });
    });
});
