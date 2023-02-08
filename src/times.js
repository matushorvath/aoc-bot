'use strict';

const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const onStartTime = async (year, day, part, name, ts) => {
    const params = {
        Item: {
            id: { S: 'start_time' },
            sk: { S: `${year}:${day}:${part}:${name}` },
            year: { N: String(year) },
            day: { N: String(day) },
            part: { N: String(part) },
            name: { S: name },
            ts: { N: String(ts) }
        },
        TableName: DB_TABLE,
        ConditionExpression: 'attribute_not_exists(id)'
    };

    try {
        await db.putItem(params);
    } catch (e) {
        if (e.name === 'ConditionalCheckFailedException') {
            console.log(`onStartTime: already have start time for ${year} ${day} ${part} ${name}`);
            return false;
        }
        throw e;
    }

    console.log(`onStartTime: saved ${year} ${day} ${part} ${name} ${ts}`);
    return true;
};

const loadStartTimes = async (year, day) => {
    const commonParams = {
        TableName: DB_TABLE,
        KeyConditionExpression: 'id = :id AND begins_with(sk, :sk)',
        ExpressionAttributeValues: {
            ':id': { S: 'start_time' },
            ':sk': { S: `${year}:${day}` }
        },
        Limit: 10 // TODO remove this limit, it's just here to test paging
    };

    const startTimes = {};

    let data;
    while (!data || data.LastEvaluatedKey) {
        const params = { ...commonParams };
        if (data?.LastEvaluatedKey) {
            params.ExclusiveStartKey = data.LastEvaluatedKey;
        }
        data = await db.query(params);

        for (const item of data.Items) {
            if (!startTimes[item.name.S]) {
                startTimes[item.name.S] = {};
            }
            startTimes[item.name.S][item.part.N] = parseInt(item.ts.N, 10);
        }
    }

    return startTimes;
};

exports.loadStartTimes = loadStartTimes;
exports.onStartTime = onStartTime;
