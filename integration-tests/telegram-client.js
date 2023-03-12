'use strict';

const { Client } = require('tdl');
const { TDLib } = require('tdl-tdlib-addon');
const { getTdjson } = require('prebuilt-tdlib');

class TelegramClient {
    constructor(credentials) {
        this.credentials = credentials;
    }

    async init() {
        const tdlib = new TDLib(getTdjson());
        this.client = new Client(tdlib, { skipOldUpdates: true, ...this.credentials });
        this.client.on('error', console.error);

        const connectionReadyFilter = (update) => {
            return update?._ === 'updateConnectionState'
                && update?.state?._ === 'connectionStateReady';
        };
        const connectionReadyPromise = this.waitForUpdates(connectionReadyFilter);

        await this.client.login();
        await connectionReadyPromise;
    }

    async close() {
        if (this.client) {
            await this.client.close();
        }
    }

    async waitForUpdates(filter, count = 1) {
        const updates = [];

        let onUpdate;
        return new Promise(resolve => {
            onUpdate = (update) => {
                // console.debug(JSON.stringify(update, undefined, 2));
                if (filter(update)) {
                    updates.push(update);
                }
                if (updates.length >= count) {
                    resolve(updates);
                }
            };
            this.client.on('update', onUpdate);
        }).finally(() => {
            this.client.off('update', onUpdate);
        });
    }

    async sendMessage(userId, text, responseCount = 1) {
        const chat = await this.client.invoke({
            _: 'createPrivateChat',
            user_id: userId
        });

        if (chat?._ !== 'chat') {
            throw new Error(`Invalid response: ${chat}`);
        }

        const messageFromBotFilter = (update) => {
            return update?._ === 'updateNewMessage'
                && update?.message?.sender_id?._ === 'messageSenderUser'
                && update?.message?.sender_id?.user_id === userId
                && update?.message?.chat_id === chat.id;
        };
        const updatesPromise = this.waitForUpdates(messageFromBotFilter, responseCount);

        const message = await this.client.invoke({
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

        if (message?._ !== 'message' || message?.sending_state?._ !== 'messageSendingStatePending') {
            throw new Error(`Invalid response: ${message}`);
        }

        return (await updatesPromise).map(update => update?.message?.content?.text?.text);
    }

    async addChatAdmin(userId, chatId) {
        const added = await this.client.invoke({
            _: 'addChatMember',
            chat_id: chatId,
            user_id: userId
        });

        if (added?._ !== 'ok') {
            throw new Error(`Invalid response: ${added}`);
        }

        const messageFromBotFilter = (update) => {
            return update?._ === 'updateNewMessage'
                && update?.message?.sender_id?._ === 'messageSenderUser'
                && update?.message?.sender_id?.user_id === userId
                && update?.message?.chat_id === chatId;
        };
        const updatesPromise = this.waitForUpdates(messageFromBotFilter);

        const statusSet = await this.client.invoke({
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

        if (statusSet?._ !== 'ok') {
            throw new Error(`Invalid response: ${statusSet}`);
        }

        return (await updatesPromise)[0]?.message?.content?.text?.text;
    }

    async removeChatMember(userId, chatId) {
        const statusSet = await this.client.invoke({
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

        if (statusSet?._ !== 'ok') {
            throw new Error(`Invalid response: ${statusSet}`);
        }
    }
}

module.exports = {
    TelegramClient
};
