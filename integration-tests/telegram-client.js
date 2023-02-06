'use strict';

const { Client } = require('tdl');
const { TDLib } = require('tdl-tdlib-addon');
const { getTdjson } = require('prebuilt-tdlib');
const timers = require('timers/promises');

class TelegramClient {
    constructor(credentials) {
        this.credentials = credentials;
    }

    async init() {
        const tdlib = new TDLib(getTdjson());
        this.client = new Client(tdlib, { skipOldUpdates: true, ...this.credentials });
        this.client.on('error', console.error);

        let connectionReady = false;
        const onUpdate = (update) => {
            // console.debug(JSON.stringify(update, undefined, 2));
            if (update?._ === 'updateConnectionState' && update?.state?._ === 'connectionStateReady') {
                connectionReady = true;
            }
        };

        try {
            this.client.on('update', onUpdate);

            await this.client.login();

            while (!connectionReady) {
                await timers.setTimeout(100);
            }
        } finally {
            this.client.off('update', onUpdate);
        }
    }

    async close() {
        if (this.client) {
            await this.client.close();
        }
    }

    async sendReceive(command, updateFilters) {
        const updates = {};
        for (const key in updateFilters) {
            updates[key] = [];
        }

        const onUpdate = (update) => {
            // console.debug(JSON.stringify(update, undefined, 2));
            for (const [key, [filter]] of Object.entries(updateFilters)) {
                if (filter(update)) {
                    updates[key].push(update);
                }
            }
        };

        try {
            this.client.on('update', onUpdate);

            await command();

            let retries = 140;
            while (retries-- > 0 && Object.keys(updates).some(key => updates[key].length < updateFilters[key][1])) {
                await timers.setTimeout(100);
            }

            return updates;
        } finally {
            this.client.off('update', onUpdate);
        }
    }

    async sendMessage(userId, text, responseCount = 1) {
        const sendMessageToBotCommand = async () => {
            const chat = await this.client.invoke({
                _: 'createPrivateChat',
                user_id: userId
            });

            await this.client.invoke({
                _: 'sendMessage',
                chat_id: chat.id,
                input_message_content: {
                    _: 'inputMessageText',
                    text: {
                        _: 'formattedText',
                        text: text
                    }
                }
            });
        };

        const newMessageFromBotFilter = (update) => {
            return update?._ === 'updateNewMessage'
                && update?.message?.sender_id?._ === 'messageSenderUser'
                && update?.message?.sender_id?.user_id === userId;
        };

        const updates = await this.sendReceive(sendMessageToBotCommand, {
            botMessages: [newMessageFromBotFilter, responseCount]
        });

        return updates.botMessages?.map(update => update?.message?.content?.text?.text);
    }

    async addChatAdmin(userId, chatId) {
        const addChatAdminCommand = async () => {
            await this.client.invoke({
                _: 'addChatMember',
                chat_id: chatId,
                user_id: userId
            });

            await this.client.invoke({
                _: 'setChatMemberStatus',
                chat_id: chatId,
                member_id: {
                    _: 'messageSenderUser',
                    user_id: userId
                },
                status: {
                    _: 'chatMemberStatusAdministrator',
                    can_manage_chat: true,
                    can_change_info: true,
                    can_post_messages: true,
                    can_edit_messages: true,
                    can_delete_messages: true,
                    can_invite_users: true,
                    can_restrict_members: true,
                    can_pin_messages: true,
                    can_promote_members: false,
                    can_manage_video_chats: true,
                    is_anonymous: false
                }
            });
        };

        const newChatMessageFromBotFilter = (update) => {
            return update?._ === 'updateNewMessage'
                && update?.message?.sender_id?._ === 'messageSenderUser'
                && update?.message?.sender_id?.user_id === userId
                && update?.message?.chat_id === chatId;
        };

        const updates = await this.sendReceive(addChatAdminCommand, {
            botMessages: [newChatMessageFromBotFilter, 1]
        });

        return updates.botMessages?.map(update => update?.message?.content?.text?.text);
    }

    async removeChatMember(userId, chatId) {
        const removeChatMemberCommand = async () => {
            await this.client.invoke({
                _: 'setChatMemberStatus',
                chat_id: chatId,
                member_id: {
                    _: 'messageSenderUser',
                    user_id: userId
                },
                status: {
                    _: 'chatMemberStatusLeft'
                }
            });
        };

        const oneAdminInSupergroupFilter = (update) => {
            return update?._ === 'updateSupergroupFullInfo'
                && update?.supergroup_full_info?.administrator_count === 1;
        };

        await this.sendReceive(removeChatMemberCommand, {
            botMessages: [oneAdminInSupergroupFilter, 1]
        });
    }
}

module.exports = {
    TelegramClient
};
