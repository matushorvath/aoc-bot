'use strict';

// TODO
// - reg (invalid arguments, valid arguments)
// - reg with new user, already known user
// - unreg when regged, when not regged
// - logs (no params, invalid params, enable for user, disable for user, when enabled/disabled both
// - somehow test sending invites

const { TelegramClient } = require('./telegram-client');

const yaml = require('yaml');
const fs = require('fs/promises');
const path = require('path');

jest.setTimeout(15 * 1000);

// Telegram ids to use for testing
const botUserId = 5071613978;
const testChatId = -1001842149447;      // id of the 'AoC 1980 Day 13' test chat

const loadCredentials = async () => {
    try {
        return yaml.parse(await fs.readFile(path.join(__dirname, 'credentials.yaml'), 'utf-8'));
    } catch (e) {
        console.error('You need to create credentials.yaml using credentials.yaml.template');
        throw e;
    }
};

let client;

beforeAll(async () => {
    const { apiId, apiHash } = await loadCredentials();
    client = new TelegramClient(apiId, apiHash);

    try {
        await client.init();
    } catch (e) {
        await client.close();
        throw e;
    }
});

afterAll(async () => {
    if (client) {
        await client.close();
    }
});

test('unknown command', async () => {
    await expect(client.sendMessage(botUserId, 'uNkNoWn CoMmAnD')).resolves.toMatchObject([
        "Sorry, I don't understand that command"
    ]);
});

test('/status command', async () => {
    await expect(client.sendMessage(botUserId, '/status')).resolves.toMatchObject([
        "You are registered as AoC user 'Matúš Horváth'"
    ]);
});

describe('/board command', () => {
    test('with invalid parameters', async () => {
        await expect(client.sendMessage(botUserId, '/board iNvAlId PaRaMs')).resolves.toMatchObject([
            'Invalid parameters (see /help)'
        ]);
    });

    test('with year and day', async () => {
        await expect(client.sendMessage(botUserId, '/board 2022 13')).resolves.toMatchObject([
            expect.stringMatching(/^Deň 13 @[^]*TrePe0\/aoc-plugin$/)
        ]);
    });
});

describe('/update command', () => {
    test('with invalid parameters', async () => {
        await expect(client.sendMessage(botUserId, '/update iNvAlId PaRaMs')).resolves.toMatchObject([
            'Invalid parameters (see /help)'
        ]);
    });

    test('with year', async () => {
        await expect(client.sendMessage(botUserId, '/update 2022', 3)).resolves.toMatchObject([
            'Processing leaderboards and invites (year 2022)',
            expect.stringMatching(/^Leaderboards updated/),
            "log: Update triggered by user 'Matúš Horváth' (year 2022)"
        ]);
    });

    test('with year and day', async () => {
        await expect(client.sendMessage(botUserId, '/update 2022 13', 3)).resolves.toMatchObject([
            'Processing leaderboards and invites (year 2022 day 13)',
            expect.stringMatching(/^Leaderboards updated/),
            "log: Update triggered by user 'Matúš Horváth' (year 2022 day 13)"
        ]);
    });
});

test('/help command', async () => {
    await expect(client.sendMessage(botUserId, '/help')).resolves.toMatchObject([
        expect.stringMatching(/^I can register[^]*matushorvath\/aoc-bot\.$/)
    ]);
});

describe('chat membership', () => {
    beforeAll(async () => {
        await client.removeChatMember(botUserId, testChatId);
    });

    test('add bot to chat as admin', async () => {
        // Start receiving bot messages
        const filter = update =>
            update?._ === 'updateNewMessage'
            && update?.message?.sender_id?._ === 'messageSenderUser'
            && update?.message?.sender_id?.user_id === botUserId
            && update?.message?.chat_id === testChatId;
        const updatesPromise = client.waitForUpdates(filter);

        // Expect the bot to be added to chat
        await expect(client.addChatAdmin(botUserId, testChatId)).resolves.toBeUndefined();

        // Expect the bot to notify the chat with a message
        await expect(updatesPromise).resolves.toMatchObject([{
            message: { content: { text: { text: '@AocElfBot is online, AoC 1980 Day 13' } } }
        }]);
    });

    test('remove bot from chat', async () => {
        await expect(client.removeChatMember(botUserId, testChatId)).resolves.toBeUndefined();
    });
});
