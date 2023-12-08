'use strict';

const { getAdventOfCodeSecret, getTelegramSecret, getWebhookSecret, resetCache } = require('../src/secrets');

const ssm = require('@aws-sdk/client-ssm');
jest.mock('@aws-sdk/client-ssm');

beforeEach(() => {
    ssm.GetParameterCommand.mockReset();
    ssm.SSMClient.prototype.send.mockReset();
});

describe('getAdventOfCodeSecret', () => {
    test('gets the secret from remote', async () => {
        resetCache();

        ssm.GetParameterCommand.mockReturnValueOnce({ GeTcOmMaNd: true });
        ssm.SSMClient.prototype.send.mockResolvedValueOnce({ Parameter: { Value: 'aOcSeCrEt' } });

        await expect(getAdventOfCodeSecret()).resolves.toEqual('aOcSeCrEt');

        expect(ssm.GetParameterCommand).toHaveBeenCalledWith({ Name: '/aoc-bot/advent-of-code-secret', WithDecryption: true });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith({ GeTcOmMaNd: true });
    });

    test('gets secrets from cache', async () => {
        await expect(getAdventOfCodeSecret()).resolves.toEqual('aOcSeCrEt');

        expect(ssm.GetParameterCommand).not.toHaveBeenCalled();
        expect(ssm.SSMClient.prototype.send).not.toHaveBeenCalled();
    });

    test('fails with a SSM error', async () => {
        resetCache();

        ssm.GetParameterCommand.mockReturnValueOnce({ GeTcOmMaNd: true });
        ssm.SSMClient.prototype.send.mockRejectedValueOnce(new Error('sSmErRoR'));

        await expect(getAdventOfCodeSecret()).rejects.toThrow('sSmErRoR');

        expect(ssm.GetParameterCommand).toHaveBeenCalledWith({ Name: '/aoc-bot/advent-of-code-secret', WithDecryption: true });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith({ GeTcOmMaNd: true });
    });
});

describe('getTelegramSecret', () => {
    test('gets the secret from remote', async () => {
        resetCache();

        ssm.GetParameterCommand.mockReturnValueOnce({ GeTcOmMaNd: true });
        ssm.SSMClient.prototype.send.mockResolvedValueOnce({ Parameter: { Value: 'tElEgRaMsEcReT' } });

        await expect(getTelegramSecret()).resolves.toEqual('tElEgRaMsEcReT');

        expect(ssm.GetParameterCommand).toHaveBeenCalledWith({ Name: '/aoc-bot/telegram-secret', WithDecryption: true });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith({ GeTcOmMaNd: true });
    });

    test('gets secrets from cache', async () => {
        await expect(getTelegramSecret()).resolves.toEqual('tElEgRaMsEcReT');

        expect(ssm.GetParameterCommand).not.toHaveBeenCalled();
        expect(ssm.SSMClient.prototype.send).not.toHaveBeenCalled();
    });

    test('fails with a SSM error', async () => {
        resetCache();

        ssm.GetParameterCommand.mockReturnValueOnce({ GeTcOmMaNd: true });
        ssm.SSMClient.prototype.send.mockRejectedValueOnce(new Error('sSmErRoR'));

        await expect(getTelegramSecret()).rejects.toThrow('sSmErRoR');

        expect(ssm.GetParameterCommand).toHaveBeenCalledWith({ Name: '/aoc-bot/telegram-secret', WithDecryption: true });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith({ GeTcOmMaNd: true });
    });
});

describe('getWebhookSecret', () => {
    test('gets the secret from remote', async () => {
        resetCache();

        ssm.GetParameterCommand.mockReturnValueOnce({ GeTcOmMaNd: true });
        ssm.SSMClient.prototype.send.mockResolvedValueOnce({ Parameter: { Value: 'wEbHoOkSeCrEt' } });

        await expect(getWebhookSecret()).resolves.toEqual('wEbHoOkSeCrEt');

        expect(ssm.GetParameterCommand).toHaveBeenCalledWith({ Name: '/aoc-bot/webhook-secret', WithDecryption: true });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith({ GeTcOmMaNd: true });
    });

    test('gets secrets from cache', async () => {
        await expect(getWebhookSecret()).resolves.toEqual('wEbHoOkSeCrEt');

        expect(ssm.GetParameterCommand).not.toHaveBeenCalled();
        expect(ssm.SSMClient.prototype.send).not.toHaveBeenCalled();
    });

    test('fails with a SSM error', async () => {
        resetCache();

        ssm.GetParameterCommand.mockReturnValueOnce({ GeTcOmMaNd: true });
        ssm.SSMClient.prototype.send.mockRejectedValueOnce(new Error('sSmErRoR'));

        await expect(getWebhookSecret()).rejects.toThrow('sSmErRoR');

        expect(ssm.GetParameterCommand).toHaveBeenCalledWith({ Name: '/aoc-bot/webhook-secret', WithDecryption: true });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith({ GeTcOmMaNd: true });
    });
});
