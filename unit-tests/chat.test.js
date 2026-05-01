import { onMyChatMember } from '../src/chat.js';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import dynamodb from '@aws-sdk/client-dynamodb';
vi.mock(import('@aws-sdk/client-dynamodb'));

import { sendTelegram } from '../src/network.js';
vi.mock(import('../src/network.js'));

import { updateLeaderboards } from '../src/leaderboards.js';
vi.mock(import('../src/leaderboards.js'));

import { addYear } from '../src/years.js';
vi.mock(import('../src/years.js'));

import { logActivity } from '../src/logs.js';
vi.mock(import('../src/logs.js'));

import { getLeaderboard } from '../src/network.js';
vi.mock(import('../src/network.js'));

import fs from 'fs/promises';

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
    dynamodb.DynamoDB.prototype.putItem.mockReset();

    addYear.mockReset();
    logActivity.mockReset();
    sendTelegram.mockReset();
    updateLeaderboards.mockReset();
});

describe('onMyChatMember', () => {
    test('ignores chats with no title', async () => {
        const update = {
            chat: { type: 'supergroup' }
        };

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(addYear).not.toHaveBeenCalled();
        expect(sendTelegram).not.toHaveBeenCalled();
        expect(getLeaderboard).not.toHaveBeenCalled();
    });

    test('ignores chats with invalid title', async () => {
        const update = {
            chat: { type: 'supergroup', title: 'BaDtItLe' }
        };

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(addYear).not.toHaveBeenCalled();
        expect(sendTelegram).not.toHaveBeenCalled();
        expect(getLeaderboard).not.toHaveBeenCalled();
    });

    test.each(['member', 'restricted'])('warns about %s status in chat member update', async (status) => {
        const update = {
            new_chat_member: { status },
            from: { id: 987654321 },
            chat: { type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 987654321, parse_mode: 'MarkdownV2', disable_notification: true,
            text: expect.stringMatching(
                /^Additional setup[\s\S]*\[promote\]\(https:.*\) the bot to admin of this group$/)
        });

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(addYear).not.toHaveBeenCalled();
        expect(getLeaderboard).not.toHaveBeenCalled();
    });

    test('ignores unknown status in chat member update', async () => {
        const update = {
            new_chat_member: { status: 'sTaTuS' },
            from: { id: 987654321 },
            chat: { type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(addYear).not.toHaveBeenCalled();
        expect(sendTelegram).not.toHaveBeenCalled();
        expect(getLeaderboard).not.toHaveBeenCalled();
    });

    test('warns about group membership', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            from: { id: 987654321 },
            chat: { type: 'group', title: 'AoC 1980 Day 13' }
        };

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 987654321, parse_mode: 'MarkdownV2', disable_notification: true,
            text: expect.stringMatching(/^Additional setup[\s\S]*enable \[chat history\]\(https:.*\) for new members$/)
        });

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(addYear).not.toHaveBeenCalled();
        expect(updateLeaderboards).not.toHaveBeenCalled();
    });

    test('fails to warn with missing user id', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            chat: { type: 'group', title: 'AoC 1980 Day 13' }
        };

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(addYear).not.toHaveBeenCalled();
        expect(sendTelegram).not.toHaveBeenCalled();
        expect(updateLeaderboards).not.toHaveBeenCalled();
    });

    test('handles HTTP 400 while sending a warning', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            from: { id: 987654321 },
            chat: { type: 'group', title: 'AoC 1980 Day 13' }
        };

        sendTelegram.mockRejectedValueOnce({ isTelegramError: true, telegram_error_code: 400 });

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 987654321, parse_mode: 'MarkdownV2', disable_notification: true,
            text: expect.stringMatching(/^Additional setup[\s\S]*enable \[chat history\]\(https:.*\) for new members$/)
        });

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(addYear).not.toHaveBeenCalled();
        expect(updateLeaderboards).not.toHaveBeenCalled();
    });

    test('handles other errors while sending a warning', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            from: { id: 987654321 },
            chat: { type: 'group', title: 'AoC 1980 Day 13' }
        };

        sendTelegram.mockRejectedValueOnce('nOnAxIoSeRrOr');

        await expect(() => onMyChatMember(update)).rejects.toBe('nOnAxIoSeRrOr');

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 987654321, parse_mode: 'MarkdownV2', disable_notification: true,
            text: expect.stringMatching(/^Additional setup[\s\S]*enable \[chat history\]\(https:.*\) for new members$/)
        });

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(addYear).not.toHaveBeenCalled();
        expect(updateLeaderboards).not.toHaveBeenCalled();
    });

    test('ignores non-group/non-supergroup membership', async () => {
        const update = {
            new_chat_member: { status: 'administrator' },
            from: { id: 987654321 },
            chat: { type: 'sTuFf', title: 'AoC 1980 Day 13' }
        };

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(addYear).not.toHaveBeenCalled();
        expect(sendTelegram).not.toHaveBeenCalled();
        expect(updateLeaderboards).not.toHaveBeenCalled();
    });

    const allRights = {
        can_manage_chat: true,
        can_promote_members: true,
        can_change_info: true,
        can_invite_users: true,
        can_pin_messages: true
    };

    test.each([
        ['can_manage_chat', '\\[allow\\]\\(https:.*\\) the bot to manage the group'],
        ['can_promote_members', '\\[allow\\]\\(https:.*\\) the bot to add new admins'],
        ['can_change_info', '\\[allow\\]\\(https:.*\\) the bot to change group info'],
        ['can_invite_users', '\\[allow\\]\\(https:.*\\) the bot to add group members'],
        ['can_pin_messages', '\\[allow\\]\\(https:.*\\) the bot to pin messages']
    ])('warns about membership with missing right %s', async (right, message) => {
        const testRights = { ...allRights };
        delete testRights[right];

        const update = {
            new_chat_member: { status: 'administrator', ...testRights },
            from: { id: 987654321 },
            chat: { type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(sendTelegram).toHaveBeenCalledWith('sendMessage', {
            chat_id: 987654321, parse_mode: 'MarkdownV2', disable_notification: true,
            text: expect.stringMatching(new RegExp(`^Additional setup[\\s\\S]*${message}$`))
        });

        expect(dynamodb.DynamoDB.prototype.batchWriteItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(dynamodb.DynamoDB.prototype.putItem).not.toHaveBeenCalled();

        expect(addYear).not.toHaveBeenCalled();
        expect(updateLeaderboards).not.toHaveBeenCalled();
    });

    test('fails if dynamodb throws', async () => {
        const update = {
            new_chat_member: { status: 'administrator', ...allRights },
            from: { id: 987654321 },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockRejectedValueOnce(new Error('dYnAmOeRrOr'));

        await expect(() => onMyChatMember(update)).rejects.toThrow('dYnAmOeRrOr');

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

        expect(addYear).not.toHaveBeenCalled();
        expect(sendTelegram).not.toHaveBeenCalled();
    });

    test('fails if addYear throws', async () => {
        const update = {
            new_chat_member: { status: 'administrator', ...allRights },
            from: { id: 987654321 },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        addYear.mockRejectedValueOnce(new Error('aDdYeArErRoR'));

        await expect(() => onMyChatMember(update)).rejects.toThrow('aDdYeArErRoR');

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

        expect(addYear).toHaveBeenCalledWith(1980);
        expect(sendTelegram).not.toHaveBeenCalled();
    });

    test('succeeds if sendTelegram returns HTTP 400 for setChatDescription', async () => {
        const update = {
            new_chat_member: { status: 'administrator', ...allRights },
            from: { id: 987654321 },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        addYear.mockResolvedValueOnce(undefined);
        sendTelegram.mockRejectedValueOnce({    // setChatDescription
            isTelegramError: true,
            telegram_error_code: 400
        });

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(sendTelegram).toHaveBeenCalledTimes(4);
        expect(sendTelegram).toHaveBeenNthCalledWith(1, 'setChatDescription', expect.anything());
    });

    test('fails if sendTelegram throws for setChatDescription', async () => {
        const update = {
            new_chat_member: { status: 'administrator', ...allRights },
            from: { id: 987654321 },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        addYear.mockResolvedValueOnce(undefined);
        sendTelegram.mockRejectedValueOnce(new Error('tElEgRaMeRrOr'));     // setChatDescription

        await expect(() => onMyChatMember(update)).rejects.toThrow('tElEgRaMeRrOr');

        expect(sendTelegram).toHaveBeenCalledTimes(1);
        expect(sendTelegram).toHaveBeenNthCalledWith(1, 'setChatDescription', expect.anything());
    });

    test('succeeds if createReadStream throws ENOENT', async () => {
        const mockReadFile = vi.spyOn(fs, 'readFile');
        const mockConsoleWarn = vi.spyOn(console, 'warn');
        try {
            const update = {
                new_chat_member: { status: 'administrator', ...allRights },
                from: { id: 987654321 },
                chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
            };

            dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
            addYear.mockResolvedValueOnce(undefined);
            sendTelegram.mockResolvedValue(undefined);

            mockReadFile.mockImplementation(() => { throw { message: 'fSeRrOr', code: 'ENOENT' }; });

            await expect(onMyChatMember(update)).resolves.toBeUndefined();

            expect(mockReadFile).toHaveBeenCalled();
            expect(mockConsoleWarn).toHaveBeenCalledWith('setChatPhoto: No icon found for day 13');
        } finally {
            mockConsoleWarn.mockRestore();
            mockReadFile.mockRestore();
        }
    });

    test('fails if sendTelegram throws for setChatPhoto', async () => {
        const update = {
            new_chat_member: { status: 'administrator', ...allRights },
            from: { id: 987654321 },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        addYear.mockResolvedValueOnce(undefined);
        sendTelegram.mockResolvedValueOnce(undefined);     // setChatDescription
        sendTelegram.mockRejectedValueOnce(new Error('tElEgRaMeRrOr'));     // setChatPhoto

        await expect(() => onMyChatMember(update)).rejects.toThrow('tElEgRaMeRrOr');

        expect(sendTelegram).toHaveBeenCalledTimes(2);
        expect(sendTelegram).toHaveBeenNthCalledWith(2, 'setChatPhoto', expect.anything(), expect.anything());
    });

    test('succeeds if sendTelegram returns HTTP 400 for setChatPermissions', async () => {
        const update = {
            new_chat_member: { status: 'administrator', ...allRights },
            from: { id: 987654321 },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        addYear.mockResolvedValueOnce(undefined);
        sendTelegram.mockResolvedValueOnce(undefined);      // setChatDescription
        sendTelegram.mockResolvedValueOnce(undefined);      // setChatPhoto
        sendTelegram.mockRejectedValueOnce({                // setChatPermissions
            isTelegramError: true,
            telegram_error_code: 400
        });

        await expect(onMyChatMember(update)).resolves.toBeUndefined();

        expect(sendTelegram).toHaveBeenCalledTimes(4);
        expect(sendTelegram).toHaveBeenNthCalledWith(3, 'setChatPermissions', expect.anything());
    });

    test('fails if sendTelegram throws for setChatPermissions', async () => {
        const update = {
            new_chat_member: { status: 'administrator', ...allRights },
            from: { id: 987654321 },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        addYear.mockResolvedValueOnce(undefined);
        sendTelegram.mockResolvedValueOnce(undefined);     // setChatDescription
        sendTelegram.mockResolvedValueOnce(undefined);     // setChatPhoto
        sendTelegram.mockRejectedValueOnce(new Error('tElEgRaMeRrOr'));     // setChatPermissions

        await expect(() => onMyChatMember(update)).rejects.toThrow('tElEgRaMeRrOr');

        expect(sendTelegram).toHaveBeenCalledTimes(3);
        expect(sendTelegram).toHaveBeenNthCalledWith(3, 'setChatPermissions', expect.anything());
    });

    test('fails if sendTelegram throws for sendMessage', async () => {
        const update = {
            new_chat_member: { status: 'administrator', ...allRights },
            from: { id: 987654321 },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        addYear.mockResolvedValueOnce(undefined);
        sendTelegram.mockResolvedValueOnce(undefined);     // setChatDescription
        sendTelegram.mockResolvedValueOnce(undefined);     // setChatPhoto
        sendTelegram.mockResolvedValueOnce(undefined);     // setChatPermissions
        sendTelegram.mockRejectedValueOnce(new Error('tElEgRaMeRrOr'));     // sendMessage

        await expect(() => onMyChatMember(update)).rejects.toThrow('tElEgRaMeRrOr');

        expect(sendTelegram).toHaveBeenCalledTimes(4);
        expect(sendTelegram).toHaveBeenNthCalledWith(4, 'sendMessage', expect.anything());
    });

    test('fails if updateLeaderboards throws', async () => {
        const update = {
            new_chat_member: { status: 'administrator', ...allRights },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        addYear.mockResolvedValueOnce(undefined);
        sendTelegram.mockResolvedValue(undefined);
        updateLeaderboards.mockRejectedValueOnce(new Error('lEaDeRbOaRdSeRrOr'));

        await expect(() => onMyChatMember(update)).rejects.toThrow('lEaDeRbOaRdSeRrOr');
    });

    test('succeeds for admin membership with required chat settings', async () => {
        const update = {
            new_chat_member: { status: 'administrator', ...allRights },
            from: { id: 987654321 },
            chat: { id: -4242, type: 'supergroup', title: 'AoC 1980 Day 13' }
        };

        dynamodb.DynamoDB.prototype.putItem.mockResolvedValueOnce(undefined);
        sendTelegram.mockResolvedValue(undefined);

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

        expect(addYear).toHaveBeenCalledWith(1980);

        expect(sendTelegram).toHaveBeenCalledTimes(4);

        expect(sendTelegram).toHaveBeenNthCalledWith(1, 'setChatDescription', {
            chat_id: -4242,
            description: 'Advent of Code 1980 day 13 discussion'
        });

        expect(sendTelegram).toHaveBeenNthCalledWith(2, 'setChatPhoto', {
            chat_id: -4242,
            photo: expect.anything()
        }, 'multipart/form-data');

        expect(sendTelegram).toHaveBeenNthCalledWith(3, 'setChatPermissions', {
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

        expect(sendTelegram).toHaveBeenNthCalledWith(4, 'sendMessage', {
            chat_id: -4242,
            text: '@AocElfBot is online, AoC 1980 Day 13',
            disable_notification: true
        });

        expect(updateLeaderboards).toHaveBeenCalledWith({ year: 1980, day: 13 });

        expect(logActivity).toHaveBeenCalledWith("Added to chat 'AoC 1980 Day 13' (1980/13)");
    });
});
