import './expect-each-pass-predicate.js';
import { describe, expect, test } from 'vitest';

describe('expect.toEachMatchObject', () => {
    test('works for positive case', () => {
        expect([{ a: 4 }, { a: 4 }]).toEachPassPredicate(item => item.a === 4);
    });

    test('works for negative case', () => {
        expect([{ a: 4 }, { a: 5 }]).not.toEachPassPredicate(item => item.a === 2);
    });
});
