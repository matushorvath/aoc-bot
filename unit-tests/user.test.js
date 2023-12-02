'use strict';

const { createUserData, deleteTelegramUserData, renameAocUser } = require('../src/user');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
    dynamodb.DynamoDB.prototype.batchWriteItem.mockReset();
    dynamodb.DynamoDB.prototype.getItem.mockReset();
    dynamodb.DynamoDB.prototype.putItem.mockReset();
});

describe('createUserData', () => {
    test('with a user', async () => {
        await expect(createUserData('Some User', 7878)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(2);

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(1, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'aoc_user' },
                sk: { S: 'Some User' },
                aoc_user: { S: 'Some User' },
                telegram_user: { N: '7878' }
            }
        });

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(2, {
            TableName: 'aoc-bot',
            Item: {
                id: { S: 'telegram_user' },
                sk: { S: '7878' },
                aoc_user: { S: 'Some User' },
                telegram_user: { N: '7878' }
            }
        });
    });
});

describe('deleteTelegramUserData', () => {
    test('with unknown user', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({});

        await expect(deleteTelegramUserData(7878)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: {
                id: { S: 'telegram_user' },
                sk: { S: '7878' }
            },
            ProjectionExpression: 'aoc_user'
        });

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
    });

    test('with existing user', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { aoc_user: { S: 'OlDaOcUsEr' } } });
        dynamodb.DynamoDB.prototype.batchWriteItem.mockResolvedValueOnce({ UnprocessedItems: {} });

        await expect(deleteTelegramUserData(7878)).resolves.toEqual('OlDaOcUsEr');

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: {
                id: { S: 'telegram_user' },
                sk: { S: '7878' }
            },
            ProjectionExpression: 'aoc_user'
        });

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).toHaveBeenCalledWith({
            RequestItems: {
                'aoc-bot': [
                    { DeleteRequest: { Key: { id: { S: 'aoc_user' }, sk: { S: 'OlDaOcUsEr' } } } },
                    { DeleteRequest: { Key: { id: { S: 'telegram_user' }, sk: { S: '7878' } } } }
                ]
            }
        });
    });

    test('when some user records fail to delete', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { aoc_user: { S: 'OlDaOcUsEr' } } });
        dynamodb.DynamoDB.prototype.batchWriteItem.mockResolvedValueOnce({
            UnprocessedItems: {
                'aoc-bot': [
                    { DeleteRequest: { Key: { id: { S: 'aoc_user' }, sk: { S: 'OlDaOcUsEr' } } } }
                ]
            }
        });

        // Expect it to succeed, we just log a warning that some records remained
        await expect(deleteTelegramUserData(7878)).resolves.toEqual('OlDaOcUsEr');

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: {
                id: { S: 'telegram_user' },
                sk: { S: '7878' }
            },
            ProjectionExpression: 'aoc_user'
        });

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).toHaveBeenCalledWith({
            RequestItems: {
                'aoc-bot': [
                    { DeleteRequest: { Key: { id: { S: 'aoc_user' }, sk: { S: 'OlDaOcUsEr' } } } },
                    { DeleteRequest: { Key: { id: { S: 'telegram_user' }, sk: { S: '7878' } } } }
                ]
            }
        });
    });
});
