'use strict';

const { createUserData, deleteTelegramUserData, renameAocUser } = require('../src/user');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
    dynamodb.DynamoDB.prototype.batchWriteItem.mockReset();
    dynamodb.DynamoDB.prototype.getItem.mockReset();
    dynamodb.DynamoDB.prototype.putItem.mockReset();
    dynamodb.DynamoDB.prototype.query.mockReset();
    dynamodb.DynamoDB.prototype.updateItem.mockReset();
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

describe('renameAocUser', () => {
    describe('aoc_user record', () => {
        test('with unknown user', async () => {
            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({});

            await expect(renameAocUser('OlD uSeR', 'NeW uSeR')).resolves.toEqual(false);

            expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                Key: {
                    id: { S: 'aoc_user' },
                    sk: { S: 'OlD uSeR' }
                }
            });

            expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();
        });

        test('updates aoc_user', async () => {
            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({
                Item: {
                    id: { S: 'aoc_user' },
                    sk: { S: 'OlD uSeR' },
                    aoc_user: { S: 'OlD uSeR' },
                    telegram_user: { N: 1414 }
                }
            });
            dynamodb.DynamoDB.prototype.updateItem.mockResolvedValueOnce({});

            await expect(renameAocUser('OlD uSeR', 'NeW uSeR')).resolves.toEqual(false);

            expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                Key: {
                    id: { S: 'aoc_user' },
                    sk: { S: 'OlD uSeR' }
                }
            });

            expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                Item: {
                    id: { S: 'aoc_user' },
                    sk: { S: 'NeW uSeR' },
                    aoc_user: { S: 'NeW uSeR' },
                    telegram_user: { N: 1414 }
                }
            });
        });
    });

    describe('telegram_user record', () => {
        test('handles missing telegram_user', async () => {
            // We just return an error in if telegram_user is missing
            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({
                Item: {
                    id: { S: 'aoc_user' },
                    sk: { S: 'OlD uSeR' },
                    aoc_user: { S: 'OlD uSeR' },
                    telegram_user: { N: 1414 }
                }
            });

            dynamodb.DynamoDB.prototype.updateItem.mockResolvedValueOnce({});

            await expect(renameAocUser('OlD uSeR', 'NeW uSeR')).resolves.toEqual(false);
        });

        test('updates telegram_user', async () => {
            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({
                Item: {
                    id: { S: 'aoc_user' },
                    sk: { S: 'OlD uSeR' },
                    aoc_user: { S: 'OlD uSeR' },
                    telegram_user: { N: 1414 }
                }
            });

            dynamodb.DynamoDB.prototype.updateItem.mockResolvedValueOnce({
                Attributes: {
                    aoc_user: { S: 'OlD uSeR' }
                }
            });

            dynamodb.DynamoDB.prototype.query.mockResolvedValueOnce({});

            await expect(renameAocUser('OlD uSeR', 'NeW uSeR')).resolves.toEqual(true);

            expect(dynamodb.DynamoDB.prototype.updateItem).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                Key: {
                    id: { S: 'telegram_user' },
                    sk: { S: '1414' }
                },
                UpdateExpression: 'SET aoc_user=:new_aoc_user',
                ExpressionAttributeValues: {
                    ':new_aoc_user': { S: 'NeW uSeR' }
                },
                ReturnValues: 'ALL_OLD'
            });
        });
    });

    describe('start_time records', () => {
        test('works with no start_time records', async () => {
            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({
                Item: {
                    id: { S: 'aoc_user' },
                    sk: { S: 'OlD uSeR' },
                    aoc_user: { S: 'OlD uSeR' },
                    telegram_user: { N: 1414 }
                }
            });

            dynamodb.DynamoDB.prototype.updateItem.mockResolvedValueOnce({
                Attributes: {
                    aoc_user: { S: 'OlD uSeR' }
                }
            });

            dynamodb.DynamoDB.prototype.query.mockResolvedValueOnce({ Items: [] });

            await expect(renameAocUser('OlD uSeR', 'NeW uSeR')).resolves.toEqual(true);

            expect(dynamodb.DynamoDB.prototype.query).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                KeyConditionExpression: 'id = :id',
                FilterExpression: '#name = :old_aoc_user',
                ExpressionAttributeNames: {
                    '#name': 'name'
                },
                ExpressionAttributeValues: {
                    ':id': { S: 'start_time' },
                    ':old_aoc_user': { S: 'OlD uSeR' }
                }
            });

            // Check putItem was only called to rename aoc_user, but not for any start_time records
            expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(1);
        });

        test('works with some start_time records', async () => {
            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({
                Item: {
                    id: { S: 'aoc_user' },
                    sk: { S: 'OlD uSeR' },
                    aoc_user: { S: 'OlD uSeR' },
                    telegram_user: { N: 1414 }
                }
            });

            dynamodb.DynamoDB.prototype.updateItem.mockResolvedValueOnce({
                Attributes: {
                    aoc_user: { S: 'OlD uSeR' }
                }
            });

            dynamodb.DynamoDB.prototype.query.mockResolvedValueOnce({
                Items: [{
                    id: { S: 'start_time' },
                    sk: { S: '2000:25:1:OlD uSeR' },
                    year: { N: '2000' },
                    day: { N: '25' },
                    part: { N: '1' },
                    name: { S: 'OlD uSeR' },
                    ts: { N: '123456' }
                }]
            });

            await expect(renameAocUser('OlD uSeR', 'NeW uSeR')).resolves.toEqual(true);

            expect(dynamodb.DynamoDB.prototype.query).toHaveBeenCalledTimes(1);
            expect(dynamodb.DynamoDB.prototype.query).toHaveBeenCalledWith({
                TableName: 'aoc-bot',
                KeyConditionExpression: 'id = :id',
                FilterExpression: '#name = :old_aoc_user',
                ExpressionAttributeNames: {
                    '#name': 'name'
                },
                ExpressionAttributeValues: {
                    ':id': { S: 'start_time' },
                    ':old_aoc_user': { S: 'OlD uSeR' }
                }
            });

            expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(2);
            expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(2, {
                TableName: 'aoc-bot',
                Item: {
                    id: { S: 'start_time' },
                    sk: { S: '2000:25:1:NeW uSeR' },
                    year: { N: '2000' },
                    day: { N: '25' },
                    part: { N: '1' },
                    name: { S: 'NeW uSeR' },
                    ts: { N: '123456' }
                }
            });
        });

        test('works with multiple pages of start_time records', async () => {
            dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({
                Item: {
                    id: { S: 'aoc_user' },
                    sk: { S: 'OlD uSeR' },
                    aoc_user: { S: 'OlD uSeR' },
                    telegram_user: { N: 1414 }
                }
            });

            dynamodb.DynamoDB.prototype.updateItem.mockResolvedValueOnce({
                Attributes: {
                    aoc_user: { S: 'OlD uSeR' }
                }
            });

            dynamodb.DynamoDB.prototype.query.mockResolvedValueOnce({
                Items: [{
                    id: { S: 'start_time' },
                    sk: { S: '2000:25:1:OlD uSeR' },
                    year: { N: '2000' },
                    day: { N: '25' },
                    part: { N: '1' },
                    name: { S: 'OlD uSeR' },
                    ts: { N: '123456' }
                }],
                LastEvaluatedKey: 'lAsTkEy'
            });
            dynamodb.DynamoDB.prototype.query.mockResolvedValueOnce({
                Items: [{
                    id: { S: 'start_time' },
                    sk: { S: '2000:13:2:OlD uSeR' },
                    year: { N: '2000' },
                    day: { N: '13' },
                    part: { N: '2' },
                    name: { S: 'OlD uSeR' },
                    ts: { N: '987654' }
                }]
            });

            await expect(renameAocUser('OlD uSeR', 'NeW uSeR')).resolves.toEqual(true);

            expect(dynamodb.DynamoDB.prototype.query).toHaveBeenCalledTimes(2);
            expect(dynamodb.DynamoDB.prototype.query).toHaveBeenNthCalledWith(1, {
                TableName: 'aoc-bot',
                KeyConditionExpression: 'id = :id',
                FilterExpression: '#name = :old_aoc_user',
                ExpressionAttributeNames: {
                    '#name': 'name'
                },
                ExpressionAttributeValues: {
                    ':id': { S: 'start_time' },
                    ':old_aoc_user': { S: 'OlD uSeR' }
                }
            });
            expect(dynamodb.DynamoDB.prototype.query).toHaveBeenNthCalledWith(2, {
                TableName: 'aoc-bot',
                KeyConditionExpression: 'id = :id',
                FilterExpression: '#name = :old_aoc_user',
                ExpressionAttributeNames: {
                    '#name': 'name'
                },
                ExpressionAttributeValues: {
                    ':id': { S: 'start_time' },
                    ':old_aoc_user': { S: 'OlD uSeR' }
                },
                ExclusiveStartKey: 'lAsTkEy'
            });

            expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledTimes(3);
            expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(2, {
                TableName: 'aoc-bot',
                Item: {
                    id: { S: 'start_time' },
                    sk: { S: '2000:25:1:NeW uSeR' },
                    year: { N: '2000' },
                    day: { N: '25' },
                    part: { N: '1' },
                    name: { S: 'NeW uSeR' },
                    ts: { N: '123456' }
                }
            });
            expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenNthCalledWith(3, {
                TableName: 'aoc-bot',
                Item: {
                    id: { S: 'start_time' },
                    sk: { S: '2000:13:2:NeW uSeR' },
                    year: { N: '2000' },
                    day: { N: '13' },
                    part: { N: '2' },
                    name: { S: 'NeW uSeR' },
                    ts: { N: '987654' }
                }
            });
        });
    });
});
