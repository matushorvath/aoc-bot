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

const timers = require('timers/promises');

const loadConfigYaml = async () => {
    try {
        return yaml.parse(await fs.readFile(path.join(__dirname, 'config.yaml'), 'utf-8'));
    } catch (e) {
        console.error('You need to create config.yaml using config.yaml.template');
        throw e;
    }
};

let config;
let client;

beforeAll(async () => {
    config = await loadConfigYaml();
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
    await expect(client.sendMessage('uNkNoWn CoMmAnD')).resolves.toMatchObject([
        "Sorry, I don't understand that command"
    ]);
});

test('/status command', async () => {
    await expect(client.sendMessage('/status')).resolves.toMatchObject([
        "You are registered as AoC user 'Matúš Horváth'"
    ]);
});

describe('/board command', () => {
    test('with invalid parameters', async () => {
        await expect(client.sendMessage('/board iNvAlId PaRaMs')).resolves.toMatchObject([
            'Invalid parameters (see /help)'
        ]);
    });

    test('with year and day', async () => {
        await expect(client.sendMessage('/board 2022 13')).resolves.toMatchObject([
            expect.stringMatching(/^Deň 13 @ [^]*TrePe0\/aoc-plugin$/)
        ]);
    });
});

describe('/update command', () => {
    test('with invalid parameters', async () => {
        await expect(client.sendMessage('/update iNvAlId PaRaMs')).resolves.toMatchObject([
            'Invalid parameters (see /help)'
        ]);
    });

    test('with year', async () => {
        await expect(client.sendMessage('/update 2022', 3)).resolves.toMatchObject([
            'Processing leaderboards and invites (year 2022)',
            expect.stringMatching(/^Leaderboards updated/),
            "log: Update triggered by user 'Matúš Horváth' (year 2022)"
        ]);
    });

    test('with year and day', async () => {
        await expect(client.sendMessage('/update 2022 13', 3)).resolves.toMatchObject([
            'Processing leaderboards and invites (year 2022 day 13)',
            expect.stringMatching(/^Leaderboards updated/),
            "log: Update triggered by user 'Matúš Horváth' (year 2022 day 13)"
        ]);
    });
});

test('/help command', async () => {
    await expect(client.sendMessage('/help')).resolves.toMatchObject([
        expect.stringMatching(/^I can register[^]*matushorvath\/aoc-bot\.$/)
    ]);
});

// describe('chat membership', () => {
//     test('add bot to chat as user', async () => {
//         const onUpdate = (update) => {
//             console.debug('update', JSON.stringify(update, undefined, 2));
//         };

//         try {
//             client.client.on('update', onUpdate);

//             const chat = await client.client.invoke({
//                 _: 'addChatMember',
//                 chat_id: config.fixtures.testChatId,
//                 user_id: config.bot.userId
//             });

//             // await this.client.invoke({
//             //     _: 'sendMessage',
//             //     chat_id: chat.id,
//             //     input_message_content: {
//             //         _: 'inputMessageText',
//             //         text: {
//             //             _: 'formattedText',
//             //             text: sendText
//             //         }
//             //     }
//             // });

//             // while (messages.length < receiveCount) {
//                 // console.debug('waiting...', JSON.stringify(messages, undefined, 2));
//                 // await timers.setTimeout(100);
//             // }
//             await timers.setTimeout(10000);
//         } finally {
//             client.client.off('update', onUpdate);
//         }
//     });
// });

/*
  console.debug
    update {
      "_": "updateBasicGroup",
      "basic_group": {
        "_": "basicGroup",
        "id": 402358716,
        "member_count": 2,
        "status": {
          "_": "chatMemberStatusCreator",
          "custom_title": "",
          "is_anonymous": false,
          "is_member": true
        },
        "is_active": true,
        "upgraded_to_supergroup_id": 0
      }
    }

      at EventEmitter.debug (integration-tests/telegram.test.js:224:21)

  console.debug
    update {
      "_": "updateNewMessage",
      "message": {
        "_": "message",
        "id": 84309704704,
        "sender_id": {
          "_": "messageSenderUser",
          "user_id": 81174104
        },
        "chat_id": -402358716,
        "is_outgoing": true,
        "is_pinned": false,
        "can_be_edited": false,
        "can_be_forwarded": false,
        "can_be_saved": true,
        "can_be_deleted_only_for_self": true,
        "can_be_deleted_for_all_users": true,
        "can_get_statistics": false,
        "can_get_message_thread": false,
        "can_get_viewers": true,
        "can_get_media_timestamp_links": false,
        "has_timestamped_media": true,
        "is_channel_post": false,
        "contains_unread_mention": false,
        "date": 1675636414,
        "edit_date": 0,
        "reply_in_chat_id": 0,
        "reply_to_message_id": 0,
        "message_thread_id": 0,
        "ttl": 0,
        "ttl_expires_in": 0,
        "via_bot_user_id": 0,
        "author_signature": "",
        "media_album_id": "0",
        "restriction_reason": "",
        "content": {
          "_": "messageChatAddMembers",
          "member_user_ids": [
            5071613978
          ]
        }
      }
    }

      at EventEmitter.debug (integration-tests/telegram.test.js:224:21)

  console.debug
    update {
      "_": "updateChatLastMessage",
      "chat_id": -402358716,
      "last_message": {
        "_": "message",
        "id": 84309704704,
        "sender_id": {
          "_": "messageSenderUser",
          "user_id": 81174104
        },
        "chat_id": -402358716,
        "is_outgoing": true,
        "is_pinned": false,
        "can_be_edited": false,
        "can_be_forwarded": false,
        "can_be_saved": true,
        "can_be_deleted_only_for_self": true,
        "can_be_deleted_for_all_users": true,
        "can_get_statistics": false,
        "can_get_message_thread": false,
        "can_get_viewers": true,
        "can_get_media_timestamp_links": false,
        "has_timestamped_media": true,
        "is_channel_post": false,
        "contains_unread_mention": false,
        "date": 1675636414,
        "edit_date": 0,
        "reply_in_chat_id": 0,
        "reply_to_message_id": 0,
        "message_thread_id": 0,
        "ttl": 0,
        "ttl_expires_in": 0,
        "via_bot_user_id": 0,
        "author_signature": "",
        "media_album_id": "0",
        "restriction_reason": "",
        "content": {
          "_": "messageChatAddMembers",
          "member_user_ids": [
            5071613978
          ]
        }
      },
      "positions": []
    }

      at EventEmitter.debug (integration-tests/telegram.test.js:224:21)

  console.debug
    update {
      "_": "updateChatReadOutbox",
      "chat_id": -402358716,
      "last_read_outbox_message_id": 84309704704
    }

      at EventEmitter.debug (integration-tests/telegram.test.js:224:21)

  console.debug
    update {
      "_": "updateBasicGroupFullInfo",
      "basic_group_id": 402358716,
      "basic_group_full_info": {
        "_": "basicGroupFullInfo",
        "description": "",
        "creator_user_id": 81174104,
        "members": [
          {
            "_": "chatMember",
            "member_id": {
              "_": "messageSenderUser",
              "user_id": 5071613978
            },
            "inviter_user_id": 81174104,
            "joined_chat_date": 1675636352,
            "status": {
              "_": "chatMemberStatusMember"
            }
          },
          {
            "_": "chatMember",
            "member_id": {
              "_": "messageSenderUser",
              "user_id": 81174104
            },
            "inviter_user_id": 81174104,
            "joined_chat_date": 1675635013,
            "status": {
              "_": "chatMemberStatusCreator",
              "custom_title": "",
              "is_anonymous": false,
              "is_member": true
            }
          }
        ],
        "invite_link": {
          "_": "chatInviteLink",
          "invite_link": "https://t.me/+dzoP-DC3WZ5lNTg0",
          "name": "",
          "creator_user_id": 81174104,
          "date": 1675635018,
          "edit_date": 0,
          "expiration_date": 0,
          "member_limit": 0,
          "member_count": 0,
          "pending_join_request_count": 0,
          "creates_join_request": false,
          "is_primary": true,
          "is_revoked": false
        },
        "bot_commands": []
      }
    }

      at EventEmitter.debug (integration-tests/telegram.test.js:224:21)

  console.debug
    update {
      "_": "updateBasicGroupFullInfo",
      "basic_group_id": 402358716,
      "basic_group_full_info": {
        "_": "basicGroupFullInfo",
        "description": "",
        "creator_user_id": 81174104,
        "members": [
          {
            "_": "chatMember",
            "member_id": {
              "_": "messageSenderUser",
              "user_id": 5071613978
            },
            "inviter_user_id": 81174104,
            "joined_chat_date": 1675636414,
            "status": {
              "_": "chatMemberStatusMember"
            }
          },
          {
            "_": "chatMember",
            "member_id": {
              "_": "messageSenderUser",
              "user_id": 81174104
            },
            "inviter_user_id": 81174104,
            "joined_chat_date": 1675635013,
            "status": {
              "_": "chatMemberStatusCreator",
              "custom_title": "",
              "is_anonymous": false,
              "is_member": true
            }
          }
        ],
        "invite_link": {
          "_": "chatInviteLink",
          "invite_link": "https://t.me/+dzoP-DC3WZ5lNTg0",
          "name": "",
          "creator_user_id": 81174104,
          "date": 1675635018,
          "edit_date": 0,
          "expiration_date": 0,
          "member_limit": 0,
          "member_count": 0,
          "pending_join_request_count": 0,
          "creates_join_request": false,
          "is_primary": true,
          "is_revoked": false
        },
        "bot_commands": []
      }
    }

      at EventEmitter.debug (integration-tests/telegram.test.js:224:21)

  console.debug
    update {
      "_": "updateBasicGroupFullInfo",
      "basic_group_id": 402358716,
      "basic_group_full_info": {
        "_": "basicGroupFullInfo",
        "description": "",
        "creator_user_id": 81174104,
        "members": [
          {
            "_": "chatMember",
            "member_id": {
              "_": "messageSenderUser",
              "user_id": 5071613978
            },
            "inviter_user_id": 81174104,
            "joined_chat_date": 1675636414,
            "status": {
              "_": "chatMemberStatusMember"
            }
          },
          {
            "_": "chatMember",
            "member_id": {
              "_": "messageSenderUser",
              "user_id": 81174104
            },
            "inviter_user_id": 81174104,
            "joined_chat_date": 1675635013,
            "status": {
              "_": "chatMemberStatusCreator",
              "custom_title": "",
              "is_anonymous": false,
              "is_member": true
            }
          }
        ],
        "invite_link": {
          "_": "chatInviteLink",
          "invite_link": "https://t.me/+dzoP-DC3WZ5lNTg0",
          "name": "",
          "creator_user_id": 81174104,
          "date": 1675635018,
          "edit_date": 0,
          "expiration_date": 0,
          "member_limit": 0,
          "member_count": 0,
          "pending_join_request_count": 0,
          "creates_join_request": false,
          "is_primary": true,
          "is_revoked": false
        },
        "bot_commands": []
      }
    }

      at EventEmitter.debug (integration-tests/telegram.test.js:224:21)

*/