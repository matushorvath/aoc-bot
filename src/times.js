'use strict';

const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const onStartTime = async (year, day, part, name, ts) => {
    const params = {
        Item: {
            id: { S: 'times' },
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


// TODO this should take year, day parameters, be called per day from a different place in code
// const loadTimes = async () => {
//     const params = {
//         TableName: DB_TABLE
//     };
//     const data = await db.scan(params);

//     // TODO implement paging
//     if (data.LastEvaluatedKey && data.LastEvaluatedKey !== '') {
//         throw new Error('Too many records in db, someone will have to implement paging');
//     }

//     const json = {};

//     for (const item of data.Items) {
//         if (!json[item.year.N]) {
//             json[item.year.N] = {};
//         }
//         if (!json[item.year.N][item.day.N]) {
//             json[item.year.N][item.day.N] = {};
//         }
//         if (!json[item.year.N][item.day.N][item.name.S]) {
//             json[item.year.N][item.day.N][item.name.S] = {};
//         }
//         if (!json[item.year.N][item.day.N][item.name.S][item.part.N]) {
//             json[item.year.N][item.day.N][item.name.S][item.part.N] = [];
//         }

//         const ts = parseInt(item.ts.N, 10);
//         json[item.year.N][item.day.N][item.name.S][item.part.N].push(ts);
//     }

//     return json;
// };

// exports.loadTimes = loadTimes;

exports.onStartTime = onStartTime;
