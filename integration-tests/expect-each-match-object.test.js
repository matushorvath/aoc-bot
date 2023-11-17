'use strict';

require('./expect-each-match-object');

describe('expect.toEachMatchObject', () => {
    test('works for positive case', () => {
        expect([{ a: 4 }, { a: 5 }]).toEachMatchObject({
            a: expect.any(Number)
        });
    });

    test('works for negative case for key', () => {
        expect([{ a: 4 }, { b: 5 }]).not.toEachMatchObject({
            a: expect.any(Number)
        });
    });

    test('works for negative case for value', () => {
        expect([{ a: 4 }, { a: 'zzz' }]).not.toEachMatchObject({
            a: expect.any(Number)
        });
    });
});
