'use strict';

const { onStart, loadStartTimes } = require('../src/times');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

beforeEach(() => {
    dynamodb.DynamoDB.prototype.putItem.mockReset();
    dynamodb.DynamoDB.prototype.query.mockReset();
});

describe('onStart', () => {
    test('saves a time to database', async () => {
        await expect(onStart(1945, 11, 2, 'sOmE oNe', 123456789)).resolves.toBe(true);

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            Item: {
                id: { S: 'start_time' },
                sk: { S: '1945:11:2:sOmE oNe' },
                year: { N: '1945' },
                day: { N: '11' },
                part: { N: '2' },
                name: { S: 'sOmE oNe' },
                ts: { N: '123456789' }
            },
            TableName: 'aoc-bot',
            ConditionExpression: 'attribute_not_exists(id)'
        });
    });

    test('does not save time when one already exists', async () => {
        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce({ name: 'ConditionalCheckFailedException' });

        await expect(onStart(1945, 11, 2, 'sOmE oNe', 123456789)).resolves.toBe(false);

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            Item: {
                id: { S: 'start_time' },
                sk: { S: '1945:11:2:sOmE oNe' },
                year: { N: '1945' },
                day: { N: '11' },
                part: { N: '2' },
                name: { S: 'sOmE oNe' },
                ts: { N: '123456789' }
            },
            TableName: 'aoc-bot',
            ConditionExpression: 'attribute_not_exists(id)'
        });
    });

    test('fails after an error while saving', async () => {
        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce(new Error('sOmEeRrOr'));
        await expect(onStart(1945, 11, 2, 'sOmE oNe', 123456789)).rejects.toThrow('sOmEeRrOr');
    });
});

describe('loadStartTimes', () => {
    test('works with no data', async () => {
        dynamodb.DynamoDB.prototype.query.mockResolvedValueOnce({ Items: [] });
        await expect(loadStartTimes(1848, 15)).resolves.toEqual({});

        expect(dynamodb.DynamoDB.prototype.query).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            KeyConditionExpression: 'id = :id AND begins_with(sk, :sk)',
            ExpressionAttributeValues: {
                ':id': { S: 'start_time' },
                ':sk': { S: '1848:15' }
            }
        });
    });

    test('works with one data point', async () => {
        dynamodb.DynamoDB.prototype.query.mockResolvedValueOnce({
            Items: [{
                name: { S: 'dEdOjOzEf' },
                ts: { N: '975318642' },
                part: { N: '2' }
            }]
        });

        await expect(loadStartTimes(1848, 15)).resolves.toEqual({
            'dEdOjOzEf': { 2: 975318642 }
        });

        expect(dynamodb.DynamoDB.prototype.query).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            KeyConditionExpression: 'id = :id AND begins_with(sk, :sk)',
            ExpressionAttributeValues: {
                ':id': { S: 'start_time' },
                ':sk': { S: '1848:15' }
            }
        });
    });

    test('works with two people in one day', async () => {
        dynamodb.DynamoDB.prototype.query.mockResolvedValueOnce({
            Items: [{
                name: { S: 'fErOmRkViCkA' },
                ts: { N: '951840' },
                part: { N: '1' }
            }, {
                name: { S: 'dEdOjOzEf' },
                ts: { N: '975318642' },
                part: { N: '2' }
            }]
        });

        await expect(loadStartTimes(1848, 15)).resolves.toEqual({
            'fErOmRkViCkA': { 1: 951840 },
            'dEdOjOzEf': { 2: 975318642 }
        });

        expect(dynamodb.DynamoDB.prototype.query).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            KeyConditionExpression: 'id = :id AND begins_with(sk, :sk)',
            ExpressionAttributeValues: {
                ':id': { S: 'start_time' },
                ':sk': { S: '1848:15' }
            }
        });
    });

    test('works with two parts for one person', async () => {
        dynamodb.DynamoDB.prototype.query.mockResolvedValueOnce({
            Items: [{
                name: { S: 'dEdOjOzEf' },
                ts: { N: '951840' },
                part: { N: '1' }
            }, {
                name: { S: 'dEdOjOzEf' },
                ts: { N: '975318642' },
                part: { N: '2' }
            }]
        });

        await expect(loadStartTimes(1848, 15)).resolves.toEqual({
            'dEdOjOzEf': { 1: 951840, 2: 975318642 }
        });

        expect(dynamodb.DynamoDB.prototype.query).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            KeyConditionExpression: 'id = :id AND begins_with(sk, :sk)',
            ExpressionAttributeValues: {
                ':id': { S: 'start_time' },
                ':sk': { S: '1848:15' }
            }
        });
    });

    test('works with two pages of data', async () => {
        dynamodb.DynamoDB.prototype.query.mockResolvedValueOnce({
            Items: [{
                name: { S: 'fErOmRkViCkA' },
                ts: { N: '951840' },
                part: { N: '1' }
            }],
            LastEvaluatedKey: {
                id: { S: 'start_time' },
                sk: { S: '1848:15:2:sOmE oNe' }
            }
        });

        dynamodb.DynamoDB.prototype.query.mockResolvedValueOnce({
            Items: [{
                name: { S: 'dEdOjOzEf' },
                ts: { N: '975318642' },
                part: { N: '2' }
            }]
        });

        await expect(loadStartTimes(1848, 15)).resolves.toEqual({
            'fErOmRkViCkA': { 1: 951840 },
            'dEdOjOzEf': { 2: 975318642 }
        });

        expect(dynamodb.DynamoDB.prototype.query).toHaveBeenCalledTimes(2);
        expect(dynamodb.DynamoDB.prototype.query).toHaveBeenNthCalledWith(1, {
            TableName: 'aoc-bot',
            KeyConditionExpression: 'id = :id AND begins_with(sk, :sk)',
            ExpressionAttributeValues: {
                ':id': { S: 'start_time' },
                ':sk': { S: '1848:15' }
            }
        });
        expect(dynamodb.DynamoDB.prototype.query).toHaveBeenNthCalledWith(2, {
            TableName: 'aoc-bot',
            KeyConditionExpression: 'id = :id AND begins_with(sk, :sk)',
            ExpressionAttributeValues: {
                ':id': { S: 'start_time' },
                ':sk': { S: '1848:15' }
            },
            ExclusiveStartKey: {
                id: { S: 'start_time' },
                sk: { S: '1848:15:2:sOmE oNe' }
            }
        });
    });
});
