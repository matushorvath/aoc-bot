'use strict';

const { getYears, addYear } = require('../src/years');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
    dynamodb.DynamoDB.prototype.getItem.mockReset();
    dynamodb.DynamoDB.prototype.updateItem.mockReset();
});

describe('getYears', () => {
    test('fails if dynamodb throws', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockRejectedValueOnce(new Error('dYnAmOeRrOr'));
        await expect(() => getYears()).rejects.toThrow('dYnAmOeRrOr');
    });

    test('returns empty set if dynamodb has no data', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({});

        await expect(getYears()).resolves.toEqual(new Set());

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: { id: { S: 'years' }, sk: { S: '0' } },
            ProjectionExpression: 'years'
        });
    });

    test('returns data from dynamodb', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { years: { NS: ['1492', '1968'] } } });

        await expect(getYears()).resolves.toEqual(new Set([1492, 1968]));

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: { id: { S: 'years' }, sk: { S: '0' } },
            ProjectionExpression: 'years'
        });
    });
});

describe('addYear', () => {
    test('fails if dynamodb throws', async () => {
        dynamodb.DynamoDB.prototype.updateItem.mockRejectedValueOnce(new Error('dYnAmOeRrOr'));
        await expect(() => addYear(1234)).rejects.toThrow('dYnAmOeRrOr');
    });

    test('succeeds if dynamodb succeeds', async () => {
        dynamodb.DynamoDB.prototype.updateItem.mockResolvedValueOnce({ Attributes: { years: { NS: ['1492', '1968', '1815'] } } });

        await expect(addYear(1815)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.updateItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: { id: { S: 'years' }, sk: { S: '0' } },
            UpdateExpression: 'ADD years :y',
            ExpressionAttributeValues: {
                ':y': { NS: ['1815'] }
            },
            ReturnValues: 'ALL_NEW'
        });
    });
});
