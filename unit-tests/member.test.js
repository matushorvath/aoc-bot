'use strict';

const { onChatMember } = require('../src/member');

const dynamodb = require('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/client-dynamodb');

const network = require('../src/network');
jest.mock('../src/network');

beforeEach(() => {
    dynamodb.DynamoDB.mockReset();
    dynamodb.DynamoDB.prototype.getItem.mockReset();
    network.sendTelegram.mockReset();
});

describe('onChatMember', () => {
    test('ignores chat type other than group/supergroup', async () => {
        const update = {
            chat: { type: 'cHaTtYpE', title: 'AoC 2010 Day 13' },
            new_chat_member: { status: 'member', user: { id: 987654321 } },
            old_chat_member: { status: 'left' }
        };

        await expect(onChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(network.sendTelegram).not.toHaveBeenCalled();
    });

    test('ignores old member status other than left/kicked/restricted', async () => {
        const update = {
            chat: { type: 'supergroup', title: 'AoC 2010 Day 13' },
            new_chat_member: { status: 'member', user: { id: 987654321 } },
            old_chat_member: { status: 'mEmBeRsTaTuS' }
        };

        await expect(onChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(network.sendTelegram).not.toHaveBeenCalled();
    });

    test('ignores new member status other than member', async () => {
        const update = {
            chat: { type: 'supergroup', title: 'AoC 2010 Day 13' },
            new_chat_member: { status: 'mEmBeRsTaTuS', user: { id: 987654321 } },
            old_chat_member: { status: 'left' }
        };

        await expect(onChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).not.toHaveBeenCalled();
        expect(network.sendTelegram).not.toHaveBeenCalled();
    });

    test.each([
        ['no promotions', undefined],
        ['null promotions', null],
        ['empty promotions', {}]
    ])('does nothing with %s', async (_desc, data) => {
        const update = {
            chat: { type: 'supergroup', title: 'AoC 2010 Day 13' },
            new_chat_member: { status: 'member', user: { id: 987654321 } },
            old_chat_member: { status: 'left' }
        };

        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce(data);

        await expect(onChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: {
                id: { S: 'promotion' },
                sk: { S: '987654321' }
            }
        });

        expect(network.sendTelegram).not.toHaveBeenCalled();
    });

    test('handles axios error in sendTelegram', async () => {
        const update = {
            chat: { type: 'supergroup', id: -13579, title: 'AoC 2010 Day 13' },
            new_chat_member: { status: 'member', user: { id: 987654321 } },
            old_chat_member: { status: 'left' }
        };

        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: {} });
        network.sendTelegram.mockRejectedValueOnce({
            isAxiosError: true,
            response: {
                data: {
                    error_code: 400,
                    description: 'pReFiX not enough rights pOsTfIx'
                }
            }
        });

        await expect(onChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalled();
        expect(network.sendTelegram).toHaveBeenCalled();
    });

    test('handles non-axios error in sendTelegram', async () => {
        const update = {
            chat: { type: 'supergroup', id: -13579, title: 'AoC 2010 Day 13' },
            new_chat_member: { status: 'member', user: { id: 987654321 } },
            old_chat_member: { status: 'left' }
        };

        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: {} });
        network.sendTelegram.mockRejectedValueOnce('nOnAxIoSeRrOr');

        await expect(onChatMember(update)).rejects.toBe('nOnAxIoSeRrOr');

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalled();
        expect(network.sendTelegram).toHaveBeenCalled();
    });

    test('promotes a user to admin', async () => {
        const update = {
            chat: { type: 'supergroup', id: -13579, title: 'AoC 2010 Day 13' },
            new_chat_member: { status: 'member', user: { id: 987654321 } },
            old_chat_member: { status: 'left' }
        };

        dynamodb.DynamoDB.prototype.getItem.mockResolvedValueOnce({ Item: {} });

        await expect(onChatMember(update)).resolves.toBeUndefined();

        expect(dynamodb.DynamoDB.prototype.getItem).toHaveBeenCalledWith({
            TableName: 'aoc-bot',
            Key: {
                id: { S: 'promotion' },
                sk: { S: '987654321' }
            }
        });

        expect(network.sendTelegram).toHaveBeenCalledWith('promoteChatMember', {
            chat_id: -13579,
            user_id: 987654321,

            can_manage_chat: true,
            can_delete_messages: true,
            can_manage_video_chats: true,
            can_restrict_members: true,
            can_promote_members: true,
            can_change_info: true,
            can_invite_users: true,
            can_post_messages: true,
            can_edit_messages: true,
            can_pin_messages: true,
            can_post_stories: true,
            can_edit_stories: true,
            can_delete_stories: true,
            can_manage_topics: true
        });
    });
});
