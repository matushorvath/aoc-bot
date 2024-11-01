'use strict';

// TODO
// - use client.iterUpdates() instead of client.on('update', ...)

const tdl = require('tdl');
const { getTdjson } = require('prebuilt-tdlib');
const { setTimeout } = require('timers/promises');

tdl.configure({ tdjson: getTdjson() });

class TelegramClient {
    constructor(apiId, apiHash, databaseDirectory, filesDirectory) {
        const options = {
            apiId, apiHash,
            databaseDirectory, filesDirectory,
            skipOldUpdates: true
        };

        this.client = tdl.createClient(options);

        //this.client.on('update', (update) => { console.debug(JSON.stringify(update, undefined, 2)); }); // TODO remove
        this.client.on('error', console.error);
    }

    async init() {
        // Wait for both connection and authorization ready, or for a request for interaction
        let authorized, connected;

        for await (const update of this.client.iterUpdates()) {
            if (update._ === 'updateAuthorizationState') {
                authorized = update.authorization_state._ === 'authorizationStateReady';

                if (update.authorization_state._ === 'authorizationStateClosed') {
                    throw new Error('authorization failed');
                } else if (update.authorization_state._.startsWith('authorizationStateWait') &&
                        update.authorization_state._ !== 'authorizationStateWaitTdlibParameters') {
                    throw new Error(`authorization is interactive (${update.authorization_state._})`);
                }
            }

            if (update._ === 'updateConnectionState') {
                connected = update.state._ === 'connectionStateReady';
            }

            if (authorized && connected) {
                return;
            }
        }
    }

    async interactiveLogin() {
        await this.client.login();
    }

    async close() {
        await this.client.close();
    }

    async clientInvoke(...params) {
        // Call client.invoke while handling throttling error messages
        try {
            return await this.client.invoke(...params);
        } catch (error) {
            if (error._ !== 'error' || error.code !== 429) {
                throw error;
            }

            const match = error.message.match(/Too Many Requests: retry after ([0-9]+)/);
            if (!match) {
                throw error;
            }

            // Telegram is asking us to throttle. Wait for requested time, then try again.
            const delay = Number(match[1]);
            console.log(`Throttling for ${delay} milliseconds...`);
            await setTimeout(delay);

            return await this.client.invoke(...params);
        }
    }

    async waitForUpdates(filter, count = 1) {
        const updates = [];

        let onUpdate;
        return new Promise((resolve, reject) => {
            onUpdate = (update) => {
                try {
                    if (filter(update)) {
                        updates.push(update);
                    }
                } catch (error) {
                    reject(error);
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
        const chat = await this.clientInvoke({
            _: 'createPrivateChat',
            user_id: userId
        });

        if (chat?._ !== 'chat') {
            throw new Error(`Invalid response: ${JSON.stringify(chat)}`);
        }

        const messageFromBotFilter = (update) => {
            return update?._ === 'updateNewMessage'
                && update?.message?.sender_id?._ === 'messageSenderUser'
                && update?.message?.sender_id?.user_id === userId
                && update?.message?.chat_id === chat.id;
        };
        const updatesPromise = this.waitForUpdates(messageFromBotFilter, responseCount);

        const message = await this.clientInvoke({
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
            throw new Error(`Invalid response: ${JSON.stringify(message)}`);
        }

        return (await updatesPromise).map(update => update?.message?.content?.text?.text);
    }

    async addChatMember(userId, chatId) {
        const status = await this.clientInvoke({
            _: 'addChatMember',
            chat_id: chatId,
            user_id: userId
        });

        if (status?._ !== 'ok') {
            throw new Error(`Invalid response: ${JSON.stringify(status)}`);
        }
    }

    async setMemberStatusAdministrator(userId, chatId) {
        const status = await this.clientInvoke({
            _: 'setChatMemberStatus',
            chat_id: chatId,
            member_id: {
                _: 'messageSenderUser',
                user_id: userId
            },
            status: {
                _: 'chatMemberStatusAdministrator',
                can_be_edited: true,
                rights: {
                    _: 'chatAdministratorRights',
                    can_manage_chat: true,
                    can_change_info: true,
                    can_post_messages: true,
                    can_edit_messages: true,
                    can_delete_messages: true,
                    can_invite_users: true,
                    can_restrict_members: true,
                    can_pin_messages: true,
                    can_manage_topics: true,
                    can_promote_members: true,
                    can_manage_video_chats: true,
                    is_anonymous: false
                }
            }
        });

        if (status?._ !== 'ok') {
            throw new Error(`Invalid response: ${JSON.stringify(status)}`);
        }
    }

    async removeChatMember(userId, chatId) {
        const status = await this.clientInvoke({
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

        if (status?._ !== 'ok') {
            throw new Error(`Invalid response: ${JSON.stringify(status)}`);
        }
    }

    async setChatDescription(chatId, description) {
        const status = await this.clientInvoke({
            _: 'setChatDescription',
            chat_id: chatId,
            description: description
        });

        if (status?._ !== 'ok') {
            throw new Error(`Invalid response: ${JSON.stringify(status)}`);
        }
    }

    async removeChatPhoto(chatId) {
        const status = await this.clientInvoke({
            _: 'setChatPhoto',
            chat_id: chatId,
            photo: {
                _: 'inputChatPhotoStatic',
                photo: null
            }
        });

        if (status?._ !== 'ok') {
            throw new Error(`Invalid response: ${JSON.stringify(status)}`);
        }
    }

    async setFullChatPermissions(chatId) {
        const status = await this.clientInvoke({
            _: 'setChatPermissions',
            chat_id: chatId,
            permissions: {
                _: 'chatPermissions',
                can_send_messages: true,
                can_send_media_messages: true,
                can_send_polls: true,
                can_send_other_messages: true,
                can_add_web_page_previews: true,
                can_change_info: true,
                can_invite_users: true,
                can_pin_messages: true
            }
        });

        if (status?._ !== 'ok') {
            throw new Error(`Invalid response: ${JSON.stringify(status)}`);
        }
    }

    async getContacts() {
        const users = await this.clientInvoke({
            _: 'getContacts'
        });

        if (users?._ !== 'users') {
            throw new Error(`Invalid response: ${JSON.stringify(users)}`);
        }

        return users;
    }

    async loadChats() {
        try {
            while (true) {
                const status = await this.clientInvoke({
                    _: 'loadChats',
                    limit: 1000
                });

                if (status?._ !== 'ok') {
                    throw new Error(`Invalid response: ${JSON.stringify(status)}`);
                }
            }
        } catch (error) {
            // Receiving a 404 means all chats have been loaded
            if (error._ === 'error' && error.code === 404) {
                return;
            }

            throw error;
        }
    }

    async getChat(chatId) {
        const chat = await this.clientInvoke({
            _: 'getChat',
            chat_id: chatId
        });

        if (chat?._ !== 'chat') {
            throw new Error(`Invalid response: ${JSON.stringify(chat)}`);
        }

        return chat;
    }
}

module.exports = {
    TelegramClient
};
