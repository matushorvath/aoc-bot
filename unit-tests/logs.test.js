import { enableLogs, disableLogs, getLogsStatus, logActivity } from '../src/logs.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import dynamodb from '@aws-sdk/client-dynamodb';
vi.mock(import('@aws-sdk/client-dynamodb'));

import { sendTelegram } from '../src/network.js';
vi.mock(import('../src/network.js'));

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
    dynamodb.DynamoDB.prototype.getItem.mockReset();
    dynamodb.DynamoDB.prototype.updateItem.mockReset();
    sendTelegram.mockReset();
});

describe('logActivity', () => {
    test('fails if dynamodb throws', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockRejectedValueOnce(new Error('dYnAmOeRrOr'));
        await expect(() => logActivity('mEsSaGe')).rejects.toThrow('dYnAmOeRrOr');
        expect(sendTelegram).not.toHaveBeenCalled();
    });

    test('does not send logs if dynamodb has no data', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({});

        await expect(logActivity('mEsSaGe')).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: { id: { S: 'logs' }, sk: { S: '0' } },
            ProjectionExpression: 'chats'
        });
        expect(sendTelegram).not.toHaveBeenCalled();
    });

    test('sends logs even if some chats are invalid', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { chats: { NS: ['111', '222', '333', '444'] } } });

        sendTelegram.mockResolvedValueOnce(undefined);
        sendTelegram.mockRejectedValueOnce({ isTelegramError: true, telegram_error_code: 403 });
        sendTelegram.mockRejectedValueOnce('nOnAxIoSeRrOr');
        sendTelegram.mockResolvedValueOnce(undefined);

        await expect(logActivity('mEsSaGe')).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: { id: { S: 'logs' }, sk: { S: '0' } },
            ProjectionExpression: 'chats'
        });

        expect(sendTelegram).toHaveBeenCalledTimes(4);
        expect(sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage',
            { chat_id: 111, text: 'log: mEsSaGe', disable_notification: true });
        expect(sendTelegram).toHaveBeenNthCalledWith(2, 'sendMessage',
            { chat_id: 222, text: 'log: mEsSaGe', disable_notification: true });
        expect(sendTelegram).toHaveBeenNthCalledWith(3, 'sendMessage',
            { chat_id: 333, text: 'log: mEsSaGe', disable_notification: true });
        expect(sendTelegram).toHaveBeenNthCalledWith(4, 'sendMessage',
            { chat_id: 444, text: 'log: mEsSaGe', disable_notification: true });
    });

    test('sends logs if dynamodb has data', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { chats: { NS: ['1234', '5678'] } } });

        await expect(logActivity('mEsSaGe')).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: { id: { S: 'logs' }, sk: { S: '0' } },
            ProjectionExpression: 'chats'
        });

        expect(sendTelegram).toHaveBeenCalledTimes(2);
        expect(sendTelegram).toHaveBeenNthCalledWith(1, 'sendMessage',
            { chat_id: 1234, text: 'log: mEsSaGe', disable_notification: true });
        expect(sendTelegram).toHaveBeenNthCalledWith(2, 'sendMessage',
            { chat_id: 5678, text: 'log: mEsSaGe', disable_notification: true });
    });
});

describe('enableLogs', () => {
    test('fails if dynamodb throws', async () => {
        dynamodb.DynamoDB.prototype.updateItem.mockRejectedValueOnce(new Error('dYnAmOeRrOr'));
        await expect(() => enableLogs(1234)).rejects.toThrow('dYnAmOeRrOr');
    });

    test('succeeds if dynamodb succeeds', async () => {
        dynamodb.DynamoDB.prototype.updateItem.mockResolvedValueOnce({ Attributes: { chats: { NS: ['98', '76', '54'] } } });

        await expect(enableLogs(32)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.updateItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: { id: { S: 'logs' }, sk: { S: '0' } },
            UpdateExpression: 'ADD chats :c',
            ExpressionAttributeValues: {
                ':c': { NS: ['32'] }
            },
            ReturnValues: 'ALL_NEW'
        });
    });
});

describe('disableLogs', () => {
    test('fails if dynamodb throws', async () => {
        dynamodb.DynamoDB.prototype.updateItem.mockRejectedValueOnce(new Error('dYnAmOeRrOr'));
        await expect(() => disableLogs(1234)).rejects.toThrow('dYnAmOeRrOr');
    });

    test('succeeds if dynamodb succeeds', async () => {
        dynamodb.DynamoDB.prototype.updateItem.mockResolvedValueOnce({ Attributes: { chats: { NS: ['98', '54'] } } });

        await expect(disableLogs(76)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.updateItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: { id: { S: 'logs' }, sk: { S: '0' } },
            UpdateExpression: 'DELETE chats :c',
            ExpressionAttributeValues: {
                ':c': { NS: ['76'] }
            },
            ReturnValues: 'ALL_NEW'
        });
    });
});

describe('getLogsStatus', () => {
    test('fails if dynamodb throws', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockRejectedValueOnce(new Error('dYnAmOeRrOr'));
        await expect(() => getLogsStatus(1234)).rejects.toThrow('dYnAmOeRrOr');
    });

    test('returns true if logs are enabled', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { chats: { NS: ['111', '222', '333', '444'] } } });

        await expect(getLogsStatus(333)).resolves.toBe(true);

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: { id: { S: 'logs' }, sk: { S: '0' } },
            ProjectionExpression: 'chats'
        });
    });

    test('returns false if logs are disabled', async () => {
        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: { chats: { NS: ['111', '222', '333', '444'] } } });

        await expect(getLogsStatus(999)).resolves.toBe(false);

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: { id: { S: 'logs' }, sk: { S: '0' } },
            ProjectionExpression: 'chats'
        });
    });
});
