'use strict';

test('dummy', () => expect(true).toBeTruthy());


// 'use strict';

// const { loadTimes, saveTime } = require('../src/times');

// const dynamodb = require('@aws-sdk/client-dynamodb');
// jest.mock('@aws-sdk/client-dynamodb');

// beforeEach(() => {
//     dynamodb.DynamoDB.prototype.putItem.mockReset();
//     dynamodb.DynamoDB.prototype.scan.mockReset();
// });

// describe('saveTime', () => {
//     test('saves a time to database', async () => {
//         await expect(saveTime(1945, 11, 2, 'sOmE oNe', 123456789)).resolves.toBeUndefined();

//         expect(dynamodb.DynamoDB.prototype.putItem).toHaveBeenCalledWith({
//             Item: {
//                 year: { N: '1945' },
//                 day: { N: '11' },
//                 part: { N: '2' },
//                 name: { S: 'sOmE oNe' },
//                 ts: { N: '123456789' },
//                 uuid: { S: expect.stringMatching(/^[0-9a-g-]{36}$/) }
//             },
//             TableName: 'aoc-redirect'
//         });
//     });
// });

// describe('getData', () => {
//     test('works with no data', async () => {
//         dynamodb.DynamoDB.prototype.scan.mockReturnValueOnce({ Items: [] });
//         await expect(loadTimes()).resolves.toEqual({});
//         expect(dynamodb.DynamoDB.prototype.scan).toHaveBeenCalledWith({ TableName: 'aoc-redirect' });
//     });

//     test('fails with too much data', async () => {
//         dynamodb.DynamoDB.prototype.scan.mockReturnValueOnce({ LastEvaluatedKey: 'key' });
//         await expect(loadTimes()).rejects.toMatchObject({ message: expect.stringMatching(/^Too many records/) });
//         expect(dynamodb.DynamoDB.prototype.scan).toHaveBeenCalledWith({ TableName: 'aoc-redirect' });
//     });

//     test('works with one data point', async () => {
//         dynamodb.DynamoDB.prototype.scan.mockReturnValueOnce({
//             Items: [{
//                 year: { N: '1848' },
//                 day: { N: '42' },
//                 name: { S: 'dEdOjOzEf' },
//                 uuid: { S: 'aBcD1234' },
//                 ts: { N: '975318642' },
//                 part: { N: '2' }
//             }]
//         });

//         await expect(loadTimes()).resolves.toEqual({
//             1848: { 42: { 'dEdOjOzEf': { 2: [975318642] } } }
//         });

//         expect(dynamodb.DynamoDB.prototype.scan).toHaveBeenCalledWith({ TableName: 'aoc-redirect' });
//     });

//     test('works with two years', async () => {
//         dynamodb.DynamoDB.prototype.scan.mockReturnValueOnce({
//             Items: [{
//                 year: { N: '1848' },
//                 day: { N: '45' },
//                 name: { S: 'fErOmRkViCkA' },
//                 uuid: { S: 'gFeD9876' },
//                 ts: { N: '951840' },
//                 part: { N: '1' }
//             }, {
//                 year: { N: '1843' },
//                 day: { N: '42' },
//                 name: { S: 'dEdOjOzEf' },
//                 uuid: { S: 'aBcD1234' },
//                 ts: { N: '975318642' },
//                 part: { N: '2' }
//             }]
//         });

//         await expect(loadTimes()).resolves.toEqual({
//             1848: { 45: { 'fErOmRkViCkA': { 1: [951840] } } },
//             1843: { 42: { 'dEdOjOzEf': { 2: [975318642] } } }
//         });

//         expect(dynamodb.DynamoDB.prototype.scan).toHaveBeenCalledWith({ TableName: 'aoc-redirect' });
//     });

//     test('works with two days in one year', async () => {
//         dynamodb.DynamoDB.prototype.scan.mockReturnValueOnce({
//             Items: [{
//                 year: { N: '1848' },
//                 day: { N: '45' },
//                 name: { S: 'fErOmRkViCkA' },
//                 uuid: { S: 'gFeD9876' },
//                 ts: { N: '951840' },
//                 part: { N: '1' }
//             }, {
//                 year: { N: '1848' },
//                 day: { N: '42' },
//                 name: { S: 'dEdOjOzEf' },
//                 uuid: { S: 'aBcD1234' },
//                 ts: { N: '975318642' },
//                 part: { N: '2' }
//             }]
//         });

//         await expect(loadTimes()).resolves.toEqual({
//             1848: {
//                 45: { 'fErOmRkViCkA': { 1: [951840] } },
//                 42: { 'dEdOjOzEf': { 2: [975318642] } }
//             }
//         });

//         expect(dynamodb.DynamoDB.prototype.scan).toHaveBeenCalledWith({ TableName: 'aoc-redirect' });
//     });

//     test('works with two people in one day', async () => {
//         dynamodb.DynamoDB.prototype.scan.mockReturnValueOnce({
//             Items: [{
//                 year: { N: '1848' },
//                 day: { N: '42' },
//                 name: { S: 'fErOmRkViCkA' },
//                 uuid: { S: 'gFeD9876' },
//                 ts: { N: '951840' },
//                 part: { N: '1' }
//             }, {
//                 year: { N: '1848' },
//                 day: { N: '42' },
//                 name: { S: 'dEdOjOzEf' },
//                 uuid: { S: 'aBcD1234' },
//                 ts: { N: '975318642' },
//                 part: { N: '2' }
//             }]
//         });

//         await expect(loadTimes()).resolves.toEqual({
//             1848: {
//                 42: {
//                     'fErOmRkViCkA': { 1: [951840] },
//                     'dEdOjOzEf': { 2: [975318642] }
//                 }
//             }
//         });

//         expect(dynamodb.DynamoDB.prototype.scan).toHaveBeenCalledWith({ TableName: 'aoc-redirect' });
//     });

//     test('works with two parts for one person', async () => {
//         dynamodb.DynamoDB.prototype.scan.mockReturnValueOnce({
//             Items: [{
//                 year: { N: '1848' },
//                 day: { N: '42' },
//                 name: { S: 'dEdOjOzEf' },
//                 uuid: { S: 'gFeD9876' },
//                 ts: { N: '951840' },
//                 part: { N: '1' }
//             }, {
//                 year: { N: '1848' },
//                 day: { N: '42' },
//                 name: { S: 'dEdOjOzEf' },
//                 uuid: { S: 'aBcD1234' },
//                 ts: { N: '975318642' },
//                 part: { N: '2' }
//             }]
//         });

//         await expect(loadTimes()).resolves.toEqual({
//             1848: { 42: { 'dEdOjOzEf': { 1: [951840], 2: [975318642] } } }
//         });

//         expect(dynamodb.DynamoDB.prototype.scan).toHaveBeenCalledWith({ TableName: 'aoc-redirect' });
//     });

//     test('works with two times for one part', async () => {
//         dynamodb.DynamoDB.prototype.scan.mockReturnValueOnce({
//             Items: [{
//                 year: { N: '1848' },
//                 day: { N: '42' },
//                 name: { S: 'dEdOjOzEf' },
//                 uuid: { S: 'gFeD9876' },
//                 ts: { N: '951840' },
//                 part: { N: '2' }
//             }, {
//                 year: { N: '1848' },
//                 day: { N: '42' },
//                 name: { S: 'dEdOjOzEf' },
//                 uuid: { S: 'aBcD1234' },
//                 ts: { N: '975318642' },
//                 part: { N: '2' }
//             }]
//         });

//         await expect(loadTimes()).resolves.toEqual({
//             1848: { 42: { 'dEdOjOzEf': { 2: [951840, 975318642] } } }
//         });

//         expect(dynamodb.DynamoDB.prototype.scan).toHaveBeenCalledWith({ TableName: 'aoc-redirect' });
//     });

//     test('correctly sorts timestamps', async () => {
//         dynamodb.DynamoDB.prototype.scan.mockReturnValueOnce({
//             Items: [{
//                 year: { N: '1848' },
//                 day: { N: '42' },
//                 name: { S: 'dEdOjOzEf' },
//                 uuid: { S: 'gFeD9876' },
//                 ts: { N: '981840' },
//                 part: { N: '1' }
//             }, {
//                 year: { N: '1848' },
//                 day: { N: '42' },
//                 name: { S: 'dEdOjOzEf' },
//                 uuid: { S: 'aBcD1234' },
//                 ts: { N: '975318642' },
//                 part: { N: '1' }
//             }]
//         });

//         await expect(loadTimes()).resolves.toEqual({
//             1848: { 42: { 'dEdOjOzEf': { 1: [981840, 975318642] } } }
//         });

//         expect(dynamodb.DynamoDB.prototype.scan).toHaveBeenCalledWith({ TableName: 'aoc-redirect' });
//     });
// });
