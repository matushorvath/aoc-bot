'use strict';

const { sendTelegram } = require('./network');
const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const onChatMember = async (chat_member) => {
    // Handle new members added to the supergroup, who are not administrators
    const isSuperGroup = chat_member.chat.type === 'supergroup';
    const wasNotInChat = chat_member.old_chat_member?.status === 'left'
        || chat_member.old_chat_member?.status === 'kicked'
        || chat_member.old_chat_member?.status === 'restricted';
    const isNowInChat = chat_member.new_chat_member?.status === 'member';

    if (!isSuperGroup || !wasNotInChat || !isNowInChat) {
        return;
    }

    console.log(`onChatMember: new member ${chat_member.new_chat_member.user.id} chat ${chat_member.chat.title}`);

    // Check if the member is in the promotion list
    const promotion = await getPromotion(chat_member.new_chat_member.user.id);
    if (!promotion) {
        console.log(`onChatMember: no promotion for ${chat_member.new_chat_member.user.id}`);
        return;
    }

    console.log(`onChatMember: promoting ${chat_member.new_chat_member.user.id}`);

    await promote(chat_member.chat.id, chat_member.new_chat_member.user.id);

    console.log('onChatMember: done');
};

const getPromotion = async (telegramUser) => {
    // Check if there is a promotion for this user
    const params = {
        TableName: DB_TABLE,
        Key: {
            id: { S: 'promotion' },
            sk: { S: String(telegramUser) }
        }
    };

    const items = await db.getItem(params);
    return items?.Item !== undefined;
};

const promote = async (chat, telegramUser) => {
    try {
        await sendTelegram('promoteChatMember', {
            chat_id: chat,
            user_id: telegramUser,

            can_manage_chat: true,
            can_delete_messages: true,
            can_manage_video_chats: true,
            can_restrict_members: true,
            can_promote_members: true,
            can_change_info: true,
            can_invite_users: true,
            //can_post_messages: true,          // only for channels
            //can_edit_messages: true,          // only for channels
            can_pin_messages: true
            //can_post_stories: true,           // only for channels
            //can_edit_stories: true,           // only for channels
            //can_delete_stories: true,         // only for channels
            //can_manage_topics: true           // should work, but causes RIGHT_FORBIDDEN
        });
    } catch (error) {
        // Detect when the bot does not have enough rights to promote a member
        if (error.isFetchError && error.code === 400) {
            console.warn(`promote: Bad request (${error.description})`);
        } else {
            throw error;
        }
    }
};

exports.onChatMember = onChatMember;
