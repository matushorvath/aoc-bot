'use strict';

const { DynamoDB } = require('@aws-sdk/client-dynamodb');

const DB_TABLE = 'aoc-bot';
const db = new DynamoDB({ apiVersion: '2012-08-10' });

const getYears = async () => {
    console.log('getYears: start');

    // Load list of years from db
    const params = {
        TableName: DB_TABLE,
        Key: { id: { S: 'years' } },
        ProjectionExpression: 'years'
    };

    const x = await db.getItem(params);
    const years = new Set(x?.Item?.years?.NS?.map(Number));

    console.log(`getYears: done, found [${[...years]}]`);
    return years;
};

const addYear = async (year) => {
    console.log(`addYear: start, year ${year}`);

    // Add year to the set
    const params = {
        TableName: DB_TABLE,
        Key: { id: { S: 'years' } },
        UpdateExpression: 'ADD years :y',
        ExpressionAttributeValues: {
            ':y': { NS: [String(year)] }
        },
        ReturnValues: 'ALL_NEW'
    };
    const data = await db.updateItem(params);

    console.log(`addYear: done, years [${data.Attributes?.years?.NS}]`);
};

exports.getYears = getYears;
exports.addYear = addYear;
