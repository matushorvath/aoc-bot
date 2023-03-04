'use strict';

require('./expect-one-of');

describe('expect.toBeOneOf', () => {
    test('works for positive case', () => {
        expect({ a: 4 }).toMatchObject({
            a: expect.toBeOneOf(1, 2, 3, 4, 5)
        });
    });

    test('works for negative case', () => {
        expect({ a: 13 }).not.toMatchObject({
            a: expect.toBeOneOf(1, 2, 3, 4, 5)
        });
    });
});
