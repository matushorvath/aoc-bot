'use strict';

// TODO

// - add bot to chat (as admin, as regular user)
// - remove bot from chat
// - add bot to chat with unknown year

// - reg (invalid arguments, valid arguments)
// - reg with new user, already known user
// - unreg when regged, when not regged
// - logs (no params, invalid params, enable for user, disable for user, when enabled/disabled both

// - somehow test sending invites

const { TelegramClient } = require('./telegram-client');

const yaml = require('yaml');
const fs = require('fs/promises');
const path = require('path');

let client;

beforeAll(async () => {
    let config;

    try {
        config = yaml.parse(await fs.readFile(path.join(__dirname, 'config.yaml'), 'utf-8'));
    } catch (e) {
        console.error('You need to create config.yaml using config.yaml.template');
        throw e;
    }

    client = new TelegramClient(config);

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
    await expect(client.sendReceive('uNkNoWn CoMmAnD')).resolves.toMatchObject([{
        sender_id: {
            user_id: client.config.bot.userId
        },
        content: {
            _: 'messageText',
            text: {
                _: 'formattedText',
                text: "Sorry, I don't understand that command"
            }
        }
    }]);
});

test('/status command', async () => {
    await expect(client.sendReceive('/status')).resolves.toMatchObject([{
        sender_id: {
            user_id: client.config.bot.userId
        },
        content: {
            _: 'messageText',
            text: {
                _: 'formattedText',
                text: "You are registered as AoC user 'Matúš Horváth'"
            }
        }
    }]);
});

// - board generates a board, with invalid params, with no params, with day,
//   with year day (both orderings), with 'today'

// - update (no params, bad params, today, day, year, both year day (both orderings)

test('/help command', async () => {
    await expect(client.sendReceive('/help')).resolves.toMatchObject([{
        sender_id: {
            user_id: client.config.bot.userId
        },
        content: {
            _: 'messageText',
            text: {
                _: 'formattedText',
                text: expect.stringMatching(/^I can register[^]*matushorvath\/aoc-bot\.$/)
            }
        }
    }]);
});
