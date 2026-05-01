import { getAdventOfCodeSecret, getTelegramSecret, getWebhookSecret, resetCache } from '../src/secrets.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import ssm from '@aws-sdk/client-ssm';
vi.mock(import('@aws-sdk/client-ssm'));

beforeEach(() => {
    ssm.GetParameterCommand.mockReset();
    ssm.SSMClient.prototype.send.mockReset();
});

describe('getAdventOfCodeSecret', () => {
    test('gets the secret from remote', async () => {
        resetCache();

        ssm.GetParameterCommand.mockImplementation(class { GeTcOmMaNd = true; });
        ssm.SSMClient.prototype.send.mockResolvedValueOnce({ Parameter: { Value: 'aOcSeCrEt' } });

        await expect(getAdventOfCodeSecret()).resolves.toEqual('aOcSeCrEt');

        expect(ssm.GetParameterCommand).toHaveBeenCalledWith({ Name: '/aoc-bot/advent-of-code-secret', WithDecryption: true });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith(expect.objectContaining({ GeTcOmMaNd: true }));
    });

    test('gets secrets from cache', async () => {
        await expect(getAdventOfCodeSecret()).resolves.toEqual('aOcSeCrEt');

        expect(ssm.GetParameterCommand).not.toHaveBeenCalled();
        expect(ssm.SSMClient.prototype.send).not.toHaveBeenCalled();
    });

    test('fails with a SSM error', async () => {
        resetCache();

        ssm.GetParameterCommand.mockImplementation(class { GeTcOmMaNd = true; });
        ssm.SSMClient.prototype.send.mockRejectedValueOnce(new Error('sSmErRoR'));

        await expect(() => getAdventOfCodeSecret()).rejects.toThrow('sSmErRoR');

        expect(ssm.GetParameterCommand).toHaveBeenCalledWith({ Name: '/aoc-bot/advent-of-code-secret', WithDecryption: true });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith(expect.objectContaining({ GeTcOmMaNd: true }));
    });
});

describe('getTelegramSecret', () => {
    test('gets the secret from remote', async () => {
        resetCache();

        ssm.GetParameterCommand.mockImplementation(class { GeTcOmMaNd = true; });
        ssm.SSMClient.prototype.send.mockResolvedValueOnce({ Parameter: { Value: 'tElEgRaMsEcReT' } });

        await expect(getTelegramSecret()).resolves.toEqual('tElEgRaMsEcReT');

        expect(ssm.GetParameterCommand).toHaveBeenCalledWith({ Name: '/aoc-bot/telegram-secret', WithDecryption: true });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith(expect.objectContaining({ GeTcOmMaNd: true }));
    });

    test('gets secrets from cache', async () => {
        await expect(getTelegramSecret()).resolves.toEqual('tElEgRaMsEcReT');

        expect(ssm.GetParameterCommand).not.toHaveBeenCalled();
        expect(ssm.SSMClient.prototype.send).not.toHaveBeenCalled();
    });

    test('fails with a SSM error', async () => {
        resetCache();

        ssm.GetParameterCommand.mockImplementation(class { GeTcOmMaNd = true; });
        ssm.SSMClient.prototype.send.mockRejectedValueOnce(new Error('sSmErRoR'));

        await expect(() => getTelegramSecret()).rejects.toThrow('sSmErRoR');

        expect(ssm.GetParameterCommand).toHaveBeenCalledWith({ Name: '/aoc-bot/telegram-secret', WithDecryption: true });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith(expect.objectContaining({ GeTcOmMaNd: true }));
    });
});

describe('getWebhookSecret', () => {
    test('gets the secret from remote', async () => {
        resetCache();

        ssm.GetParameterCommand.mockImplementation(class { GeTcOmMaNd = true; });
        ssm.SSMClient.prototype.send.mockResolvedValueOnce({ Parameter: { Value: 'wEbHoOkSeCrEt' } });

        await expect(getWebhookSecret()).resolves.toEqual('wEbHoOkSeCrEt');

        expect(ssm.GetParameterCommand).toHaveBeenCalledWith({ Name: '/aoc-bot/webhook-secret', WithDecryption: true });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith(expect.objectContaining({ GeTcOmMaNd: true }));
    });

    test('gets secrets from cache', async () => {
        await expect(getWebhookSecret()).resolves.toEqual('wEbHoOkSeCrEt');

        expect(ssm.GetParameterCommand).not.toHaveBeenCalled();
        expect(ssm.SSMClient.prototype.send).not.toHaveBeenCalled();
    });

    test('fails with a SSM error', async () => {
        resetCache();

        ssm.GetParameterCommand.mockImplementation(class { GeTcOmMaNd = true; });
        ssm.SSMClient.prototype.send.mockRejectedValueOnce(new Error('sSmErRoR'));

        await expect(() => getWebhookSecret()).rejects.toThrow('sSmErRoR');

        expect(ssm.GetParameterCommand).toHaveBeenCalledWith({ Name: '/aoc-bot/webhook-secret', WithDecryption: true });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith(expect.objectContaining({ GeTcOmMaNd: true }));
    });
});
