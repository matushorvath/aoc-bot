'use strict';

const { Client } = require('tdl');
const { TDLib } = require('tdl-tdlib-addon');
const { getTdjson } = require('prebuilt-tdlib');
const timers = require('timers/promises');

class TelegramClient {
    constructor(config) {
        this.config = config;
    }

    async init() {
        const tdlib = new TDLib(getTdjson());
        this.client = new Client(tdlib, { skipOldUpdates: true, ...this.config.credentials });
        this.client.on('error', console.error);

        let connectionReady = false;
        const onUpdate = (update) => {
            console.debug('update', update);
            if (update?._ === 'updateConnectionState' && update?.state?._ === 'connectionStateReady') {
                connectionReady = true;
            }
        };

        try {
            this.client.on('update', onUpdate);

            await this.client.login();

            // TODO there is some kind of race condition here, sometimes we never receive connectionStateReady
            // TODO this probably happens if we receive connectionStateReady before this.client.on('update', onUpdate)

            while (!connectionReady) {
                console.debug('waiting...', connectionReady);
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

    async sendReceive(sendText, receiveCount = 1) {
        const messages = [];
        const onUpdate = (update) => {
            console.debug('update', update);
            if (update?._ === 'updateNewMessage'
                && update?.message?.sender_id?._ === 'messageSenderUser'
                && update?.message?.sender_id?.user_id === this.config.bot.userId) {

                messages.push(update.message);
            }
        };

        try {
            this.client.on('update', onUpdate);

            const chat = await this.client.invoke({
                _: 'createPrivateChat',
                user_id: this.config.bot.userId
            });

            await this.client.invoke({
                _: 'sendMessage',
                chat_id: chat.id,
                input_message_content: {
                    _: 'inputMessageText',
                    text: {
                        _: 'formattedText',
                        text: sendText
                    }
                }
            });

            while (messages.length < receiveCount) {
                console.debug('waiting...', JSON.stringify(messages, undefined, 2));
                await timers.setTimeout(100);
            }

            return messages;
        } finally {
            this.client.off('update', onUpdate);
        }
    }
}

module.exports = {
    TelegramClient
};
