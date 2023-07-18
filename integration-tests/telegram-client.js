'use strict';

const tdl = require('tdl');
const { getTdjson } = require('prebuilt-tdlib');

const crypto = require ('crypto');
const fs = require('fs/promises');
const path = require('path');
const util = require('util');
const os = require('os');

const { setTimeout } = require('timers/promises');

const pbkdf2Async = util.promisify(crypto.pbkdf2);

tdl.configure({ tdjson: getTdjson() });

class TelegramClient {
    constructor(apiId, apiHash, aesKey) {
        this.apiId = apiId;
        this.apiHash = apiHash;
        this.aesKey = aesKey;
    }

    async init() {
        const { databaseDirectory, filesDirectory } = await this.prepareDatabase();

        const options = {
            apiId: this.apiId,
            apiHash: this.apiHash,
            databaseDirectory,
            filesDirectory,
            skipOldUpdates: true
        };

        this.client = tdl.createClient(options);
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

    async prepareDatabase() {
        const tmpDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'aoc-bot-tdlib-'));

        const databaseDirectory = path.join(tmpDirectory, '_td_database');
        await fs.mkdir(databaseDirectory, { recursive: true });

        const filesDirectory = path.join(tmpDirectory, '_td_files');
        await fs.mkdir(filesDirectory, { recursive: true });

        const encryptedName = path.join(__dirname, 'td.binlog.aes');
        const decryptedName = path.join(databaseDirectory, 'td.binlog');

        // Create the td.binlog unless it already exists
        let decryptedHandle;
        try {
            decryptedHandle = await fs.open(decryptedName, 'wx', 0o644);
        } catch (error) {
            if (error.code === 'EEXIST') {
                return;
            }
            throw error;
        }

        // Decrypt the file and write it out
        try {
            const encrypted = await fs.readFile(encryptedName);
            const decrypted = await this.decryptDatabase(encrypted);

            await decryptedHandle.writeFile(decrypted);
        } finally {
            await decryptedHandle.close();
        }

        return { databaseDirectory, filesDirectory };
    }

    async decryptDatabase(encrypted) {
        console.log('decryptDatabase: start');

        const salt = encrypted.subarray(8, 16);
        const input = encrypted.subarray(16);

        const info = crypto.getCipherInfo('aes-256-cbc');
        const keyIv = await pbkdf2Async(this.aesKey, salt, 10000, info.keyLength + info.ivLength, 'sha256');

        const key = keyIv.subarray(0, info.keyLength);
        const iv = keyIv.subarray(info.keyLength);

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        const decrypted = Buffer.concat([decipher.update(input), decipher.final()]);

        console.log('decryptDatabase: done');

        return decrypted;
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
