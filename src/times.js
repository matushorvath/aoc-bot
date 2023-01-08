'use strict';

// const { DynamoDB } = require('@aws-sdk/client-dynamodb');
// const { v4: uuidv4 } = require('uuid');

// const DB_TABLE = 'aoc-redirect';
// const db = new DynamoDB({ apiVersion: '2012-08-10' });

// const saveTime = async (year, day, part, name, ts) => {
//     const params = {
//         Item: {
//             day: { N: String(day) },
//             name: { S: name },
//             ts: { N: String(ts) },
//             uuid: { S: uuidv4() },
//             year: { N: String(year) },
//             part: { N: String(part) }
//         },
//         TableName: DB_TABLE
//     };

//     await db.putItem(params);
// };

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


const onStartTime = (/*year, day, part, name, ts*/) => {
};

exports.onStartTime = onStartTime;
