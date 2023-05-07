'use strict';

const { onMyChatMember } = require('../src/member');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

const network = require('../src/network');
jest.mock('../src/network');

const schedule = require('../src/schedule');
jest.mock('../src/schedule');

const years = require('../src/years');
jest.mock('../src/years');

const logs = require('../src/logs');
jest.mock('../src/logs');

const fs = require('fs');

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
    dynamodb.DynamoDB.prototype.putItem.mockReset();
    years.addYear.mockReset();
    logs.logActivity.mockReset();
    network.sendTelegram.mockReset();
    schedule.updateLeaderboards.mockReset();
});

describe('onMyChatMember', () => {
    test('ignores non-admin chat member update', async () => {
        const update = {
            new_chat_member: { status: 'sTaTuS' },
            chat: { type: 'supergroup', title: 'tItLe' }
        };

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(years.addYear).not.toHaveBeenCalled();
        expect(network.sendTelegram).not.toHaveBeenCalled();
        expect(network.getLeaderboard).not.toHaveBeenCalled();
    });

    test('ignores non-group/non-supergroup membership', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { type: 'sTuFf', title: 'tItLe' }
        };

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(years.addYear).not.toHaveBeenCalled();
        expect(network.sendTelegram).not.toHaveBeenCalled();
        expect(schedule.updateLeaderboards).not.toHaveBeenCalled();
    });

    test('ignores membership in a supergroup with no title', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { type: 'supergroup' }
        };

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(years.addYear).not.toHaveBeenCalled();
        expect(network.sendTelegram).not.toHaveBeenCalled();
        expect(schedule.updateLeaderboards).not.toHaveBeenCalled();
    });

    test('ignores membership in a supergroup with invalid title', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { type: 'supergroup', title: 'tItLe' }
        };

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(years.addYear).not.toHaveBeenCalled();
        expect(network.sendTelegram).not.toHaveBeenCalled();
        expect(schedule.updateLeaderboards).not.toHaveBeenCalled();
    });

    test('fails if dynamodb throws', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce(new Error('dYnAmOeRrOr'));

        await expect(onMyChatMember(update)).rejects.toThrow('dYnAmOeRrOr');

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            Item: {
                id: { S: 'chat' },
                sk: { S: '1980:13' },
                y: { N: '1980' },
                d: { N: '13' },
                chat: { N: '-4242' }
            },
            TableName: 'aoc-bot'
        });

        expect(years.addYear).not.toHaveBeenCalled();
        expect(network.sendTelegram).not.toHaveBeenCalled();
    });

    test('fails if addYear throws', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        years.addYear.mockRejectedValueOnce(new Error('aDdYeArErRoR'));

        await expect(onMyChatMember(update)).rejects.toThrow('aDdYeArErRoR');

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            Item: {
                id: { S: 'chat' },
                sk: { S: '1980:13' },
                y: { N: '1980' },
                d: { N: '13' },
                chat: { N: '-4242' }
            },
            TableName: 'aoc-bot'
        });

        expect(years.addYear).toHaveBeenCalledWith(1980);
        expect(network.sendTelegram).not.toHaveBeenCalled();
    });

    test('succeeds if sendTelegram returns HTTP 400 for setChatDescription', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        years.addYear.mockResolvedValueOnce(undefined);
        network.sendTelegram.mockRejectedValueOnce({
            isAxiosError: true,
            response: { data: { error_code: 400 } }
        });     // setChatDescription

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(network.sendTelegram).toHaveBeenCalledTimes(4);
        expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'setChatDescription', expect.anything());
    });

    test('fails if sendTelegram throws for setChatDescription', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        years.addYear.mockResolvedValueOnce(undefined);
        network.sendTelegram.mockRejectedValueOnce(new Error('tElEgRaMeRrOr'));     // setChatDescription

        await expect(onMyChatMember(update)).rejects.toThrow('tElEgRaMeRrOr');

        expect(network.sendTelegram).toHaveBeenCalledTimes(1);
        expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'setChatDescription', expect.anything());
    });

    test('succeeds if createReadStream throws ENOENT', async () => {
        const mockCreateReadStream = jest.spyOn(fs, 'createReadStream');
        const mockConsoleWarn = jest.spyOn(console, 'warn');
        try {
            const update = {
                new_chat_member: { status: 'administrator' },
                chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
            };

            dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
            years.addYear.mockResolvedValueOnce(undefined);
            network.sendTelegram.mockResolvedValue(undefined);

            mockCreateReadStream.mockImplementation(() => { throw { message: 'fSeRrOr', code: 'ENOENT' }; });

            await expect(onMyChatMember(update)).resolves.toBeUndefined();

            expect(mockCreateReadStream).toHaveBeenCalled();
            expect(mockConsoleWarn).toHaveBeenCalledWith('setChatPhoto: No icon found for day 13');
        } finally {
            mockConsoleWarn.mockRestore();
            mockCreateReadStream.mockRestore();
        }
    });

    test('fails if sendTelegram throws for setChatPhoto', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        years.addYear.mockResolvedValueOnce(undefined);
        network.sendTelegram.mockResolvedValueOnce(undefined);     // setChatDescription
        network.sendTelegram.mockRejectedValueOnce(new Error('tElEgRaMeRrOr'));     // setChatPhoto

        await expect(onMyChatMember(update)).rejects.toThrow('tElEgRaMeRrOr');

        expect(network.sendTelegram).toHaveBeenCalledTimes(2);
        expect(network.sendTelegram).toHaveBeenNthCalledWith(2, 'setChatPhoto', expect.anything(), expect.anything());
    });

    test('fails if sendTelegram throws for setChatPermissions', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        years.addYear.mockResolvedValueOnce(undefined);
        network.sendTelegram.mockResolvedValueOnce(undefined);     // setChatDescription
        network.sendTelegram.mockResolvedValueOnce(undefined);     // setChatPhoto
        network.sendTelegram.mockRejectedValueOnce(new Error('tElEgRaMeRrOr'));     // setChatPermissions

        await expect(onMyChatMember(update)).rejects.toThrow('tElEgRaMeRrOr');

        expect(network.sendTelegram).toHaveBeenCalledTimes(3);
        expect(network.sendTelegram).toHaveBeenNthCalledWith(3, 'setChatPermissions', expect.anything());
    });

    test('fails if sendTelegram throws for sendMessage', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        years.addYear.mockResolvedValueOnce(undefined);
        network.sendTelegram.mockResolvedValueOnce(undefined);     // setChatDescription
        network.sendTelegram.mockResolvedValueOnce(undefined);     // setChatPhoto
        network.sendTelegram.mockResolvedValueOnce(undefined);     // setChatPermissions
        network.sendTelegram.mockRejectedValueOnce(new Error('tElEgRaMeRrOr'));     // sendMessage

        await expect(onMyChatMember(update)).rejects.toThrow('tElEgRaMeRrOr');

        expect(network.sendTelegram).toHaveBeenCalledTimes(4);
        expect(network.sendTelegram).toHaveBeenNthCalledWith(4, 'sendMessage', expect.anything());
    });

    test('fails if updateLeaderboards throws', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        years.addYear.mockResolvedValueOnce(undefined);
        network.sendTelegram.mockResolvedValue(undefined);
        schedule.updateLeaderboards.mockRejectedValueOnce(new Error('lEaDeRbOaRdSeRrOr'));

        await expect(onMyChatMember(update)).rejects.toThrow('lEaDeRbOaRdSeRrOr');
    });

    test.each(['group', 'supergroup'])('succeeds for admin membership in %s', async (chatType) => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { id: -4242, type: chatType, title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        network.sendTelegram.mockResolvedValue(undefined);

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
            Item: {
                id: { S: 'chat' },
                sk: { S: '1980:13' },
                y: { N: '1980' },
                d: { N: '13' },
                chat: { N: '-4242' }
            },
            TableName: 'aoc-bot'
        });

        expect(years.addYear).toHaveBeenCalledWith(1980);

        expect(network.sendTelegram).toHaveBeenCalledTimes(4);

        expect(network.sendTelegram).toHaveBeenNthCalledWith(1, 'setChatDescription', {
            chat_id: -4242,
            description: 'Advent of Code 1980 day 13 discussion'
        });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(2, 'setChatPhoto', {
            chat_id: -4242,
            photo: expect.anything() // TODO { path: 'path to the img }
        }, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(3, 'setChatPermissions', {
            chat_id: -4242,
            permissions: {
                can_send_messages: true,
                can_send_audios: true,
                can_send_documents: true,
                can_send_photos: true,
                can_send_videos: true,
                can_send_video_notes: true,
                can_send_voice_notes: true,
                can_send_polls: true,
                can_send_other_messages: true,
                can_add_web_page_previews: true,
    
                can_change_info: false,
                can_invite_users: false,
                can_pin_messages: false,
    
                can_manage_topics: true
            }
        });

        expect(network.sendTelegram).toHaveBeenNthCalledWith(4, 'sendMessage', {
            chat_id: -4242,
            text: '@AocElfBot is online, AoC 1980 Day 13',
            disable_notification: true
        });

        expect(schedule.updateLeaderboards).toHaveBeenCalledWith({ year: 1980, day: 13 });

        expect(logs.logActivity).toHaveBeenCalledWith("Added to chat 'AoC 1980 Day 13' (1980/13)");
    });
});
