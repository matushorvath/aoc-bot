'use strict';

const axios = require('axios');
<<<<<<< Updated upstream
require('./expect-one-of');
=======
>>>>>>> Stashed changes

jest.setTimeout(15 * 1000);

const url = 'https://7b79gj2si4.execute-api.eu-central-1.amazonaws.com/Prod/start';

describe('POST /start', () => {
    const validData = {
        version: 1,
        year: 2003,
        day: 13,
        part: 2,
        name: 'TeSt UsEr'
    };

    test.each(['GET', 'HEAD', 'PUT', 'DELETE', 'PATCH'])('with invalid method %s', async (method) => {
        await expect(axios({ method, url })).rejects.toMatchObject({
            response: {
                status: 403
            }
        });
    });

<<<<<<< Updated upstream
    test('returns correct error response', async () => {
        await expect(axios.post(url)).rejects.toMatchObject({
            response: {
                status: 400,
                data: {
                    error: 'Bad Request',
                    details: 'Missing or invalid request body',
                    usage:
`POST https://<hostname>/start
body: {
    "version": 1,
    "year": 2022,
    "day": 13,
    "part": 1,
    "name": "John Smith"
}`
                }
            }
        });
    });

=======
>>>>>>> Stashed changes
    test('with no payload', async () => {
        await expect(axios.post(url)).rejects.toMatchObject({
            response: {
                status: 400,
                data: {
<<<<<<< Updated upstream
                    details: 'Missing or invalid request body'
=======
                    error: 'Bad Request',
                    details: 'Missing request body',
                    usage: expect.any(String)
>>>>>>> Stashed changes
                }
            }
        });
    });

    test('with invalid body', async () => {
        await expect(axios.post(url, '%$@#$')).rejects.toMatchObject({
            response: {
                status: 400,
                data: {
<<<<<<< Updated upstream
                    details: 'Invalid JSON syntax'
=======
                    error: 'Bad Request',
                    details: 'Invalid JSON syntax',
                    usage: expect.any(String)
>>>>>>> Stashed changes
                }
            }
        });
    });

    test('with invalid JSON data', async () => {
        await expect(axios.post(url, { uNeXpEcTeD: 42 })).rejects.toMatchObject({
            response: {
                status: 400,
                data: {
<<<<<<< Updated upstream
                    details: "Expecting 'version' parameter to be 1"
=======
                    error: 'Bad Request',
                    details: 'Invalid JSON syntax',
                    usage: expect.any(String)
                }
            }
        });
    });

    test('with invalid Content-Type', async () => {
        await expect(axios.post(url, validData, { headers: { 'Content-Type': 'text/plain' } })).rejects.toMatchObject({
            response: {
                status: 400,
                data: {
                    error: 'Bad Request',
                    details: 'Invalid JSON syntax',
                    usage: expect.any(String)
>>>>>>> Stashed changes
                }
            }
        });
    });

    const without = (object, field) => {
        const copy = { ...object };
        delete copy[field];
        return copy;
    };

<<<<<<< Updated upstream
    test.each([
        ['missing version', without(validData, 'version'), "Expecting 'version' parameter to be 1"],
        ['invalid version', { ...validData, version: '1' }, "Expecting 'version' parameter to be 1"],
        ['version other than 1', { ...validData, version: 2 }, "Expecting 'version' parameter to be 1"],
        ['missing year', without(validData, 'year'), "Missing or invalid 'year' parameter"],
        ['invalid year', { ...validData, year: '2023' }, "Missing or invalid 'year' parameter"],
        ['year out of range', { ...validData, year: 1999 }, "Missing or invalid 'year' parameter"],
        ['missing day', without(validData, 'day'), "Missing or invalid 'day' parameter"],
        ['invalid day', { ...validData, day: '13' }, "Missing or invalid 'day' parameter"],
        ['day out of range', { ...validData, day: 26 }, "Missing or invalid 'day' parameter"],
        ['missing part', without(validData, 'part'), "Missing or invalid 'part' parameter"],
        ['invalid part', { ...validData, part: '1' }, "Missing or invalid 'part' parameter"],
        ['part out of range', { ...validData, part: 3 }, "Missing or invalid 'part' parameter"],
        ['missing name', without(validData, 'name'), "Missing or invalid 'name' parameter"],
        ['invalid name', { ...validData, name: 12345 }, "Missing or invalid 'name' parameter"]
    ])('with %s', async (_description, data, details) => {
        await expect(axios.post(url, data)).rejects.toMatchObject({
            response: {
                status: 400,
                data: { details }
=======
    // TODO missing/incorrect each field
    test.each([
        ['missing version', without(validData, 'version')]
    ])('with %s', async (_description, data) => {
        await expect(axios.post(url, data, { headers: { 'Content-Type': 'application/json' } })).rejects.toMatchObject({
            response: {
                status: 400,
                data: {
                    error: 'Bad Request',
                    details: "Expecting 'version' parameter to be 1",
                    usage: expect.any(String)
                }
>>>>>>> Stashed changes
            }
        });
    });

<<<<<<< Updated upstream
    test('with defaults', async () => {
        await expect(axios.post(url, validData)).resolves.toMatchObject({
            status: expect.toBeOneOf(200, 201)
        });
    });

    test('with Content-Type: text/plain', async () => {
        await expect(axios.post(url, validData, { headers: { 'Content-Type': 'text/plain' } })).resolves.toMatchObject({
            status: expect.toBeOneOf(200, 201)
        });
    });

    test('with Content-Type: application/json', async () => {
        await expect(axios.post(url, validData, { headers: { 'Content-Type': 'application/json' } })).resolves.toMatchObject({
            status: expect.toBeOneOf(200, 201)
        });
    });

    const toLowerCaseObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            throw new Error(`Expected an object, received type ${typeof obj}`);
        }

        return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key.toLowerCase(), value.toLowerCase()]));
    };

    test('OPTIONS responds with correct CORS headers', async () => {
        const config = {
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type'
        };
        const response = await axios.options(url, config);

        expect(response.status).toBe(204);
        expect(toLowerCaseObject(response.headers)).toMatchObject({
            'access-control-allow-headers': 'content-type',
            'access-control-allow-methods': 'options,post',
            'access-control-allow-origin': '*'
        });
    });

    test('POST responds with correct CORS headers', async () => {
        const response = await axios.post(url, validData);

        expect(response.status).toBeOneOf(200, 201);
        expect(toLowerCaseObject(response.headers)).toMatchObject({
            'access-control-allow-headers': 'content-type',
            'access-control-allow-methods': 'options,post',
            'access-control-allow-origin': '*'
        });
    });
});
=======
    // correct field (200 or 201)
});

// OPTIONS + CORS
>>>>>>> Stashed changes
