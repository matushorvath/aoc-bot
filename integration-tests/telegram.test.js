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
        client = undefined;

        throw e;
    }

    // We need to load all contacts and chats to be able to access them
    await client.getContacts();
    await client.loadChats();
});

afterAll(async () => {
    if (client) {
        await client.close();
    }
});

describe('bot commands', () => {
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

        test('with no parameters', async () => {
            await expect(client.sendMessage(botUserId, '/board')).resolves.toMatchObject([
                // Getting today's leaderboard will only work in December
                expect.stringMatching(/^Deň (\d| )\d @[^]*TrePe0\/aoc-plugin|Could not retrieve leaderboard data$/)
            ]);
        });

        test('with today', async () => {
            await expect(client.sendMessage(botUserId, '/board today')).resolves.toMatchObject([
                // Getting today's leaderboard will only work in December
                expect.stringMatching(/^Deň (\d| )\d @[^]*TrePe0\/aoc-plugin|Could not retrieve leaderboard data$/)
            ]);
        });

        test('with day', async () => {
            await expect(client.sendMessage(botUserId, '/board 23')).resolves.toMatchObject([
                expect.stringMatching(/^Deň 23 @[^]*TrePe0\/aoc-plugin$/)
            ]);
        });

        test('with year and day', async () => {
            await expect(client.sendMessage(botUserId, '/board 2022 13')).resolves.toMatchObject([
                expect.stringMatching(/^Deň 13 @[^]*TrePe0\/aoc-plugin$/)
            ]);
        });

        test('with day and year', async () => {
            await expect(client.sendMessage(botUserId, '/board 7 2023')).resolves.toMatchObject([
                expect.stringMatching(/^Deň {2}7 @[^]*TrePe0\/aoc-plugin$/)
            ]);
        });
    });

    describe('/update command', () => {
        test('with invalid parameters', async () => {
            await expect(client.sendMessage(botUserId, '/update iNvAlId PaRaMs')).resolves.toMatchObject([
                'Invalid parameters (see /help)'
            ]);
        });

        test('with no parameters', async () => {
            // This can update either a year or a single day, depending on whether it's December
            await expect(client.sendMessage(botUserId, '/update', 3)).resolves.toMatchObject([
                expect.stringMatching(/^Processing leaderboards and invites/),
                expect.stringMatching(/^Leaderboards updated/),
                expect.stringMatching(/^log: Update triggered by user 'Matúš Horváth'/)
            ]);
        });

        test('with today', async () => {
            await expect(client.sendMessage(botUserId, '/update today', 3)).resolves.toMatchObject([
                expect.stringMatching(/^Processing leaderboards and invites \(year 20\d\d day \d{1,2}\)$/),
                expect.stringMatching(/^Leaderboards updated/),
                expect.stringMatching(/^log: Update triggered by user 'Matúš Horváth' \(year 20\d\d day \d{1,2}\)$/)
            ]);
        });

        test('with day', async () => {
            await expect(client.sendMessage(botUserId, '/update 23', 3)).resolves.toMatchObject([
                expect.stringMatching(/^Processing leaderboards and invites \(year 20\d\d day 23\)$/),
                expect.stringMatching(/^Leaderboards updated/),
                expect.stringMatching(/^log: Update triggered by user 'Matúš Horváth' \(year 20\d\d day 23\)$/)
            ]);
        });

        test('with year', async () => {
            await expect(client.sendMessage(botUserId, '/update 2018', 3)).resolves.toMatchObject([
                'Processing leaderboards and invites (year 2018)',
                expect.stringMatching(/^Leaderboards updated/),
                "log: Update triggered by user 'Matúš Horváth' (year 2018)"
            ]);
        });

        test('with year and day', async () => {
            await expect(client.sendMessage(botUserId, '/update 2022 13', 3)).resolves.toMatchObject([
                'Processing leaderboards and invites (year 2022 day 13)',
                expect.stringMatching(/^Leaderboards updated/),
                "log: Update triggered by user 'Matúš Horváth' (year 2022 day 13)"
            ]);
        });

        test('with day and year', async () => {
            await expect(client.sendMessage(botUserId, '/update 7 2023', 3)).resolves.toMatchObject([
                'Processing leaderboards and invites (year 2023 day 7)',
                expect.stringMatching(/^Leaderboards updated/),
                "log: Update triggered by user 'Matúš Horváth' (year 2023 day 7)"
            ]);
        });
    });

    test('/logs command', async () => {
        await expect(client.sendMessage(botUserId, '/logs')).resolves.toMatchObject([
            'Activity logs are enabled for this chat'
        ]);
    });

    test('/help command', async () => {
        await expect(client.sendMessage(botUserId, '/help')).resolves.toMatchObject([
            expect.stringMatching(/^I can register[^]*matushorvath\/aoc-bot$/)
        ]);
    });
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
            // Expect the bot to promoted to administrator
            await expect(client.setMemberStatusAdministrator(botUserId, testChatId)).resolves.toBeUndefined();

            // Expect the bot to update the chat
            await expect(client.receiveResponse(botUserId, testChatId, 2)).resolves.toMatchObject([{
                content: {
                    _: 'messageChatChangePhoto',
                    photo: {
                        _: 'chatPhoto'
                    }
                }
            }, {
                content: {
                    _: 'messageText',
                    text: {
                        text: '@AocElfBot is online, AoC 1980 Day 13'
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
