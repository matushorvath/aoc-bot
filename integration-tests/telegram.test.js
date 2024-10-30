'use strict';

// TODO
// - reg (invalid arguments, valid arguments)
// - reg with new user, already known user
// - unreg when regged, when not regged
// - logs (no params, invalid params, enable for user, disable for user, when enabled/disabled both
// - somehow test sending invites

const { TelegramClient } = require('./telegram-client');
const { loadTelegramCredentials } = require('./telegram-credentials');
const { loadTelegramDatabase } = require('./telegram-database');

jest.setTimeout(90 * 1000);

// Telegram ids to use for testing
const botUserId = 5071613978;
const testChatId = -1001842149447;      // id of the 'AoC 1980 Day 13' test chat

let client;

beforeAll(async () => {
    const { apiId, apiHash, aesKey } = await loadTelegramCredentials();
    const { databaseDirectory, filesDirectory } = await loadTelegramDatabase(aesKey);
    client = new TelegramClient(apiId, apiHash, databaseDirectory, filesDirectory);

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
        expect.stringMatching(/^I can register[^]*matushorvath\/aoc-bot$/)
    ]);
});

describe('chat membership', () => {
    beforeAll(async () => {
        await client.removeChatMember(botUserId, testChatId);
    });

    test('reset chat properties', async () => {
        await expect(client.setChatDescription(testChatId, '')).resolves.toBeUndefined();
        await expect(client.removeChatPhoto(testChatId)).resolves.toBeUndefined();
        await expect(client.setFullChatPermissions(testChatId)).resolves.toBeUndefined();
    });

    // First add and remove the bot when the chat does not have a description, photo or restrictions set.
    // Then run the same test again, but this time do not reset chat properties, so the description, photo
    // and restrictions are already initialized. Telegram API returns HTTP 400 errors if you set properties
    // that already have the requested value, and this tests for correct handling of such cases.
    describe.each(['default', 'pre-initialized'])('with %s chat status', () => {
        test('add bot to chat', async () => {
            // Expect the bot to be added to chat
            await expect(client.addChatMember(botUserId, testChatId)).resolves.toBeUndefined();
        });

        test('promote the bot to administrator', async () => {
            // Start receiving bot messages
            const filter = update =>
                update?._ === 'updateNewMessage'
                && update?.message?.sender_id?._ === 'messageSenderUser'
                && update?.message?.sender_id?.user_id === botUserId
                && update?.message?.chat_id === testChatId;
            const updatesPromise = client.waitForUpdates(filter, 2);

            // Expect the bot to promoted to administrator
            await expect(client.setMemberStatusAdministrator(botUserId, testChatId)).resolves.toBeUndefined();

            // Expect the bot to update the chat
            await expect(updatesPromise).resolves.toMatchObject([{
                message: {
                    content: {
                        _: 'messageChatChangePhoto',
                        photo: {
                            _: 'chatPhoto'
                        }
                    }
                }
            }, {
                message: {
                    content: {
                        _: 'messageText',
                        text: {
                            text: '@AocElfBot is online, AoC 1980 Day 13'
                        }
                    }
                }
            }]);
        });

        test('validate chat properties', async () => {
            // Description is available using getSupergroupFullInfo, but it is a cached value,
            // so it does not update quickly enough for this test

            await expect(client.getChat(testChatId)).resolves.toMatchObject({
                _: 'chat',
                type: {
                    _: 'chatTypeSupergroup'
                },
                photo: {
                    _: 'chatPhotoInfo'
                },
                permissions: {
                    _: 'chatPermissions',

                    can_send_polls: true,
                    can_send_other_messages: true,
                    can_add_web_page_previews: true,

                    can_change_info: false,
                    can_invite_users: false,
                    can_pin_messages: false
                }
            });
        });

        test('remove bot from chat', async () => {
            await expect(client.removeChatMember(botUserId, testChatId)).resolves.toBeUndefined();
        });
    });

    // TODO test that bot correctly fails when missing some admin rights
});
