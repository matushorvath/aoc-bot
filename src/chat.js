'use strict';

const { sendTelegram } = require('./network');
const { updateLeaderboards } = require('./leaderboards');
const { addYear } = require('./years');
const { logActivity } = require('./logs');

const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const fs = require('fs');
const path = require('path');

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const createGroupDocsUrl = 'https://matushorvath.github.io/aoc-bot/create-group';

const onMyChatMember = async (my_chat_member) => {
    // Parse year and day from the chat title
    const { year, day } = parseChatTitle(my_chat_member?.chat?.title);
    if (year === undefined || day === undefined) {
        console.warn(`onMyChatMember: chat title '${my_chat_member?.chat?.title}' did not match`);
        return;
    }

    // Check for correct chat settings and admin rights
    if (!await checkChatMember(my_chat_member)) {
        return;
    }

    console.log(`onMyChatMember: admin in '${my_chat_member.chat.title}' id ${my_chat_member.chat.id} (${year}/${day})`);

    // Store chat info in db
    await saveChat(my_chat_member.chat.id, year, day);

    // Remember that we have at least one chat for this year
    await addYear(year);

    // Initialize the chat
    await initializeChat(my_chat_member.chat, year, day);

    // Update leaderboard for this day and send invites
    await updateLeaderboards({ year, day }),

    await logActivity(`Added to chat '${my_chat_member.chat.title}' (${year}/${day})`);

    console.log('onMyChatMember: done');
};

const parseChatTitle = (title) => {
    // Determine AoC day based on group title
    const match = title?.match(/AoC ([0-9]{4}) Day ([0-9]{1,2})/);
    if (!match) {
        console.warn(`onMyChatMember: chat title '${title}' did not match`);
        return {};
    }

    const year = Number(match[1]);
    const day = Number(match[2]);

    return { year, day };
};

const checkChatMember = async (my_chat_member) => {
    // TODO create a command to run these checks, /check 2023 13

    const { proceed, issues } = detectChatMemberIssues(my_chat_member);

    if (issues.length > 0) {
        const inviterUserId = getInviterUserId(my_chat_member);
        if (!inviterUserId) {
            return false;
        }

        const message = issues.join('\n');
        console.warn(`checkChatMember: ${message}`);

        try {
            await sendTelegram('sendMessage', {
                chat_id: inviterUserId,
                text: `Additional setup needed for group \`${my_chat_member.chat.title}\`:\n${message}`,
                parse_mode: 'MarkdownV2',
                disable_notification: true
            });
        } catch (error) {
            // The bot might not be able to send messages to this user
            if (error.isFetchError && error.code === 400) {
                console.warn(`checkChatMember: Could not send message: ${error.description}`);
            } else {
                throw error;
            }
        }
    }

    return proceed;
};

const getInviterUserId = (my_chat_member) => {
    const inviterUserId = my_chat_member?.from?.id;
    if (!inviterUserId) {
        console.warn('getInviterUserId: Could not determine who invited bot to chat');
        return undefined;
    }

    return inviterUserId;
};

const docsLink = (text, anchor) => {
    return `[${text}](${createGroupDocsUrl}#${anchor})`;
};

const detectChatMemberIssues = (my_chat_member) => {
    // Enabling visible history also upgrades the group to supergroup
    // TODO also explicitly check for visible history, currently not possible with bot API
    if (my_chat_member.chat.type === 'group') {
        return { proceed: false, issues: [`• enable ${docsLink('chat history', 'chat-history')} for new members`] };
    } else if (my_chat_member.chat.type !== 'supergroup') {
        // This handles membership in any other chat types, which the bot ignores
        return { proceed: false, issues: [] };
    }

    // Check if we were made an admin of this supergroup
    if (['member', 'restricted'].includes(my_chat_member.new_chat_member?.status)) {
        return { proceed: false, issues: [`• ${docsLink('promote', 'promote-bot')} the bot to admin of this group`] };
    } else if (my_chat_member.new_chat_member?.status !== 'administrator') {
        // This handles statuses like 'left' or 'kicked', where we don't want any bot messages
        return { proceed: false, issues: [] };
    }

    const issues = [];

    // Check necessary admin permissions
    if (!my_chat_member.new_chat_member.can_manage_chat) {
        issues.push(`• ${docsLink('allow', 'permissions')} the bot to manage the group`);
    }
    if (!my_chat_member.new_chat_member.can_promote_members) {
        issues.push(`• ${docsLink('allow', 'permissions')} the bot to add new admins`);
    }
    if (!my_chat_member.new_chat_member.can_change_info) {
        issues.push(`• ${docsLink('allow', 'permissions')} the bot to change group info`);
    }
    if (!my_chat_member.new_chat_member.can_invite_users) {
        issues.push(`• ${docsLink('allow', 'permissions')} the bot to add group members`);
    }
    if (!my_chat_member.new_chat_member.can_pin_messages) {
        issues.push(`• ${docsLink('allow', 'permissions')} the bot to pin messages`);
    }

    return { proceed: issues.length === 0, issues };
};

const saveChat = async (chatId, year, day) => {
    const params = {
        Item: {
            id: { S: 'chat' },
            sk: { S: `${year}:${day}` },
            y: { N: String(year) },
            d: { N: String(day) },
            chat: { N: String(chatId) }
        },
        TableName: DB_TABLE
    };
    await db.putItem(params);

    console.log('saveChat: done');
};

const initializeChat = async (chat, year, day) => {
    console.log('initializeChat: start');

    // Setup chat properties
    await setChatDescription(chat.id, year, day);
    await setChatPhoto(chat.id, day);
    await setChatPermissions(chat.id);

    // Write a message to the new chat
    await sendTelegram('sendMessage', {
        chat_id: chat.id,
        text: `@AocElfBot is online, AoC ${year} Day ${day}`,
        disable_notification: true
    });

    console.log('initializeChat: done');
};

const setChatDescription = async (chatId, year, day) => {
    try {
        await sendTelegram('setChatDescription', {
            chat_id: chatId,
            description: `Advent of Code ${year} day ${day} discussion`
        });
    } catch (error) {
        // Setting chat description to the same value results in a 400 error
        if (error.isFetchError && error.code === 400) {
            console.warn(`setChatDescription: Could not set chat description: ${error.description}`);
        } else {
            throw error;
        }
    }

    console.debug('setChatDescription: done');
};

const setChatPhoto = async (chatId, day) => {
    try {
        const photoName = `aoc${day.toString().padStart(2, '0')}.png`;
        const photo = fs.createReadStream(path.join(__dirname, '..', 'images', photoName));

        await sendTelegram('setChatPhoto', { chat_id: chatId, photo: photo },
            { 'Content-Type': 'multipart/form-data' });
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`setChatPhoto: No icon found for day ${day}`);
        } else {
            throw error;
        }
    }

    console.debug('setChatPhoto: done');
};

const setChatPermissions = async (chatId) => {
    try {
        await sendTelegram('setChatPermissions', {
            chat_id: chatId,
            permissions: {
                can_send_messages: true,
                can_send_audios: true,
                can_send_documents: true,
                can_send_photos: true,
                can_send_videos: true,
                can_send_video_notes: true,
                can_send_voice_notes: true,
                can_send_polls: true,
                can_send_other_messages: true,
                can_add_web_page_previews: true,

                can_change_info: false,
                can_invite_users: false,
                can_pin_messages: false,

                can_manage_topics: true
            }
        });
    } catch (error) {
        // Setting chat permissions to the same value results in a 400 error
        if (error.isFetchError && error.code === 400) {
            console.warn(`setChatPermissions: Could not set chat permissions: ${error.description}`);
        } else {
            throw error;
        }
    }

    console.debug('setChatPermissions: done');
};

exports.onMyChatMember = onMyChatMember;
