'use strict';

require('./expect-one-of');

jest.setTimeout(30 * 1000);

const url = 'https://7b79gj2si4.execute-api.eu-central-1.amazonaws.com/Prod/start';

describe('POST /start', () => {
    const validPayload = {
        version: 1,
        year: 2000,
        day: 13,
        part: 2,
        name: 'TeSt UsEr'
    };

    test.each(['GET', 'HEAD', 'PUT', 'DELETE', 'PATCH'])('with invalid method %s', async (method) => {
        const response = await fetch(url, { method });
        expect(response.status).toBe(403);
    });

    test('returns correct error response', async () => {
        const response = await fetch(url, { method: 'POST' });
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data).toMatchObject({
            error: 'Bad Request',
            details: 'Missing or invalid request body',
            usage: [
                expect.stringMatching(/POST https:\/\/[\w.-]+\/start/),
                'body: {',
                '    "version": 1,',
                '    "year": 2022,',
                '    "day": 13,',
                '    "part": 1,',
                '    "name": "John Smith"',
                '}'
            ]
        });
    });

    test('with no payload', async () => {
        const response = await fetch(url, { method: 'POST' });
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data).toMatchObject({
            details: 'Missing or invalid request body'
        });
    });

    test('with invalid body', async () => {
        const response = await fetch(url, { method: 'POST', body: '%$@#$' });
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data).toMatchObject({
            details: 'Invalid JSON syntax'
        });
    });

    test('with invalid JSON data', async () => {
        const response = await fetch(url, { method: 'POST', body: JSON.stringify({ uNeXpEcTeD: 42 }), headers: { 'Content-Type': 'application/json' } });
        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data).toMatchObject({
            details: "Expecting 'version' parameter to be 1"
        });
    });

    const without = (object, field) => {
        const copy = { ...object };
        delete copy[field];
        return copy;
    };

    test.each([
        ['missing version', without(validPayload, 'version'), "Expecting 'version' parameter to be 1"],
        ['invalid version', { ...validPayload, version: '1' }, "Expecting 'version' parameter to be 1"],
        ['version other than 1', { ...validPayload, version: 2 }, "Expecting 'version' parameter to be 1"],
        ['missing year', without(validPayload, 'year'), "Missing or invalid 'year' parameter"],
        ['invalid year', { ...validPayload, year: '2023' }, "Missing or invalid 'year' parameter"],
        ['year out of range', { ...validPayload, year: 1999 }, "Missing or invalid 'year' parameter"],
        ['missing day', without(validPayload, 'day'), "Missing or invalid 'day' parameter"],
        ['invalid day', { ...validPayload, day: '13' }, "Missing or invalid 'day' parameter"],
        ['day out of range', { ...validPayload, day: 26 }, "Missing or invalid 'day' parameter"],
        ['missing part', without(validPayload, 'part'), "Missing or invalid 'part' parameter"],
        ['invalid part', { ...validPayload, part: '1' }, "Missing or invalid 'part' parameter"],
        ['part out of range', { ...validPayload, part: 3 }, "Missing or invalid 'part' parameter"],
        ['missing name', without(validPayload, 'name'), "Missing or invalid 'name' parameter"],
        ['invalid name', { ...validPayload, name: 12345 }, "Missing or invalid 'name' parameter"]
    ])('with %s', async (_description, payload, details) => {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();
        expect(response.status).toBe(400);
        expect(data).toMatchObject({ details });
    });

    test('with defaults', async () => {
        const response = await fetch(url, { method: 'POST', body: JSON.stringify(validPayload), headers: { 'Content-Type': 'application/json' } });
        expect(response.status).toEqual(expect.oneOf(200, 201));
    });

    test('with Content-Type: text/plain', async () => {
        const response = await fetch(url, { method: 'POST', body: JSON.stringify(validPayload), headers: { 'Content-Type': 'text/plain' } });
        expect(response.status).toEqual(expect.oneOf(200, 201));
    });

    test('with Content-Type: application/json', async () => {
        const response = await fetch(url, { method: 'POST', body: JSON.stringify(validPayload), headers: { 'Content-Type': 'application/json' } });
        expect(response.status).toEqual(expect.oneOf(200, 201));
    });

    const toLowerCaseObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            throw new Error(`Expected an object, received type ${typeof obj}`);
        }

        return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key.toLowerCase(), value.toLowerCase()]));
    };

    test('OPTIONS responds with correct CORS headers', async () => {
        const response = await fetch(url, {
            method: 'OPTIONS',
            headers: {
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });
        expect(response.status).toBe(204);
        expect(toLowerCaseObject(Object.fromEntries(response.headers))).toMatchObject({
            'access-control-allow-headers': 'content-type',
            'access-control-allow-methods': 'options,post',
            'access-control-allow-origin': '*'
        });
    });

    test('POST responds with correct CORS headers', async () => {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(validPayload),
            headers: { 'Content-Type': 'application/json' }
        });

        expect(response.status).toEqual(expect.oneOf(200, 201));
        expect(toLowerCaseObject(Object.fromEntries(response.headers))).toMatchObject({
            'access-control-allow-headers': 'content-type',
            'access-control-allow-methods': 'options,post',
            'access-control-allow-origin': '*'
        });
    });
});
