'use strict';

const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const createUserData = async (aocUser, telegramUser) => {
    // Store user mapping in db
    const aocParams = {
        Item: {
            id: { S: 'aoc_user' },
            sk: { S: aocUser },
            aoc_user: { S: aocUser },
            telegram_user: { N: String(telegramUser) }
        },
        TableName: DB_TABLE
    };
    await db.putItem(aocParams);

    const telegramParams = {
        Item: {
            id: { S: 'telegram_user' },
            sk: { S: String(telegramUser) },
            aoc_user: { S: aocUser },
            telegram_user: { N: String(telegramUser) }
        },
        TableName: DB_TABLE
    };
    await db.putItem(telegramParams);
};

const deleteTelegramUserData = async (telegramUser) => {
    // Find AoC record in database
    const getParams = {
        TableName: DB_TABLE,
        Key: {
            id: { S: 'telegram_user' },
            sk: { S: String(telegramUser) }
        },
        ProjectionExpression: 'aoc_user'
    };

    const getData = await db.getItem(getParams);
    if (!getData.Item) {
        console.log('deleteTelegramUserData: no records to delete');
        return undefined;
    }

    const aocUser = getData.Item.aoc_user.S;
    console.log(`deleteTelegramUserData: found aocUser ${aocUser}`);

    await deleteUserData(aocUser, telegramUser);

    return aocUser;
};

const deleteUserData = async (aocUser, telegramUser) => {
    // Delete all user records
    const writeParams = {
        RequestItems: {
            [DB_TABLE]: [{
                DeleteRequest: {
                    Key: {
                        id: { S: 'aoc_user' },
                        sk: { S: aocUser }
                    }
                }
            }, {
                DeleteRequest: {
                    Key: {
                        id: { S: 'telegram_user' },
                        sk: { S: String(telegramUser) }
                    }
                }
            }]
        }
    };
    const writeData = await db.batchWriteItem(writeParams);

    if (Object.keys(writeData.UnprocessedItems).length > 0) {
        console.warn(`deleteUserData: some records not deleted: ${JSON.stringify(writeData.UnprocessedItems)}`);
    }

    console.log(`deleteUserData: user telegramUser ${telegramUser} aocUser ${aocUser} deleted from db`);
};

const renameAocUser = async (oldAocUser, newAocUser) => {
    console.log(`renameAocUser: renaming '${oldAocUser}' to '${newAocUser}'`);

    const telegramUser = await renameAocUserRecord(oldAocUser, newAocUser);
    if (telegramUser === undefined) {
        console.warn(`renameAocUser: aoc_user record not found for ${oldAocUser}`);
        return false;
    }

    console.log(`renameAocUser: found telegram_user '${telegramUser}'`);

    const oldAocUserInTelegramUser = await renameTelegramUserRecord(telegramUser, newAocUser);
    if (oldAocUserInTelegramUser === undefined) {
        console.warn(`renameAocUser: telegram_user record not found ${telegramUser}`);
        return false;
    }

    await renameStartTimeRecords(oldAocUser, newAocUser);

    console.log(`renameAocUser: renamed '${oldAocUser}' to '${newAocUser}'`);
    return true;
};

const renameAocUserRecord = async (oldAocUser, newAocUser) => {
    // Get the old item
    const getParams = {
        TableName: DB_TABLE,
        Key: {
            id: { S: 'aoc_user' },
            sk: { S: oldAocUser }
        }
    };

    const items = await db.getItem(getParams);
    if (items?.Item === undefined) {
        return undefined;
    }

    // Create a new item
    const putParams = {
        Item: {
            ...items.Item,
            sk: { S: newAocUser },
            aoc_user: { S: newAocUser }
        },
        TableName: DB_TABLE
    };

    await db.putItem(putParams);

    // TODO we should also delete the old item, but make sure the new one was successfully created first

    console.log(`renameAocUserRecord: done, telegram_user ${items.Item.telegram_user.N}`);

    return Number(items.Item.telegram_user.N);
};

const renameTelegramUserRecord = async (telegramUser, newAocUser) => {
    const params = {
        TableName: DB_TABLE,
        Key: {
            id: { S: 'telegram_user' },
            sk: { S: String(telegramUser) }
        },
        UpdateExpression: 'SET aoc_user=:new_aoc_user',
        ExpressionAttributeValues: {
            ':new_aoc_user': { S: newAocUser }
        },
        ReturnValues: 'ALL_OLD'
    };

    const data = await db.updateItem(params);
    console.log(`renameTelegramUserRecord: done, old aoc_user [${data.Attributes?.aoc_user?.S}]`);

    return data.Attributes?.aoc_user?.S;
};

const renameStartTimeRecords = async (oldAocUser, newAocUser) => {
    // TODO There is a race condition here, if the user submits start times while we are renaming

    const commonParams = {
        TableName: DB_TABLE,
        KeyConditionExpression: 'id = :id',
        FilterExpression: '#name = :old_aoc_user',
        ExpressionAttributeNames: {
            '#name': 'name'
        },
        ExpressionAttributeValues: {
            ':id': { S: 'start_time' },
            ':old_aoc_user': { S: oldAocUser }
        }
    };

    let startTimeCount = 0;

    let data;
    while (!data || data.LastEvaluatedKey) {
        const params = { ...commonParams };
        if (data?.LastEvaluatedKey) {
            params.ExclusiveStartKey = data.LastEvaluatedKey;
        }
        data = await db.query(params);

        for (const item of data.Items) {
            await renameOneStartTimeRecord(item, newAocUser);
            startTimeCount++;
        }
    }

    console.log(`renameStartTimeRecords: done, processed ${startTimeCount} start_time records`);
};

const renameOneStartTimeRecord = async (item, newAocUser) => {
    // Replace last component of the sk value
    const newSk = item.sk.S.split(':').with(-1, newAocUser).join(':');

    // Create a new item
    const putParams = {
        Item: {
            ...item,
            sk: { S: newSk },
            name: { S: newAocUser }
        },
        TableName: DB_TABLE
    };

    await db.putItem(putParams);

    // TODO delete old item once putItem passes
};

exports.createUserData = createUserData;
exports.deleteTelegramUserData = deleteTelegramUserData;
exports.renameAocUser = renameAocUser;
