'use strict';

const { getAdventOfCodeSecret, getTelegramSecret, getWebhookSecret, resetCache } = require('../src/secrets');

const ssm = require('@aws-sdk/client-ssm');
jest.mock('@aws-sdk/client-ssm');

beforeEach(() => {
    ssm.GetParametersCommand.mockReset();
    ssm.SSMClient.prototype.send.mockReset();
});

const functions = [
    ['getAdventOfCodeSecret', getAdventOfCodeSecret, 'aOcSeCrEt'],
    ['getTelegramSecret', getTelegramSecret, 'tElEgRaMsEcReT'],
    ['getWebhookSecret', getWebhookSecret, 'wEbHoOkSeCrEt']
];

describe.each(functions)('%s', (_description, getSecretFunction, result) => {
    test('gets secrets first time', async () => {
        resetCache();

        const data = {
            Parameters: [{
                Name: '/aoc-bot/webhook-secret',
                Value: 'wEbHoOkSeCrEt'
            }, {
                Name: '/aoc-bot/telegram-secret',
                Value: 'tElEgRaMsEcReT'
            }, {
                Name: '/aoc-bot/advent-of-code-secret',
                Value: 'aOcSeCrEt'
            }]
        };

        ssm.GetParametersCommand.mockReturnValueOnce({ GeTcOmMaNd: true });
        ssm.SSMClient.prototype.send.mockResolvedValueOnce(data);

        await expect(getSecretFunction()).resolves.toEqual(result);

        expect(ssm.GetParametersCommand).toHaveBeenCalledWith({
            Names: ['/aoc-bot/advent-of-code-secret', '/aoc-bot/telegram-secret', '/aoc-bot/webhook-secret'],
            WithDecryption: true
        });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith({ GeTcOmMaNd: true });
    });

    test('gets secrets from cache', async () => {
        await expect(getSecretFunction()).resolves.toEqual(result);

        expect(ssm.GetParametersCommand).not.toHaveBeenCalled();
        expect(ssm.SSMClient.prototype.send).not.toHaveBeenCalled();
    });

    test('fails with missing SSM', async () => {
        resetCache();

        const data = {
            Parameters: [{
                Name: '/uNeXpEcTed',
                Value: 'sEcReT'
            }],
            InvalidParameters: [
                '/aoc-bot/telegram-secret',
                '/aoc-bot/advent-of-code-secret',
                '/aoc-bot/webhook-secret'
            ]
        };

        ssm.GetParametersCommand.mockReturnValueOnce({ GeTcOmMaNd: true });
        ssm.SSMClient.prototype.send.mockResolvedValueOnce(data);

        await expect(getSecretFunction()).rejects.toThrow(/getSecrets/);

        expect(ssm.GetParametersCommand).toHaveBeenCalledWith({
            Names: ['/aoc-bot/advent-of-code-secret', '/aoc-bot/telegram-secret', '/aoc-bot/webhook-secret'],
            WithDecryption: true
        });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith({ GeTcOmMaNd: true });
    });

    test('fails with AWS error', async () => {
        resetCache();

        ssm.GetParametersCommand.mockReturnValueOnce({ GeTcOmMaNd: true });
        ssm.SSMClient.prototype.send.mockRejectedValueOnce(new Error('sSmErRoR'));

        await expect(getSecretFunction()).rejects.toThrow('sSmErRoR');

        expect(ssm.GetParametersCommand).toHaveBeenCalledWith({
            Names: ['/aoc-bot/advent-of-code-secret', '/aoc-bot/telegram-secret', '/aoc-bot/webhook-secret'],
            WithDecryption: true
        });
        expect(ssm.SSMClient.prototype.send).toHaveBeenCalledWith({ GeTcOmMaNd: true });
    });
});
