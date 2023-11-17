'use strict';

function toEachMatchObject(received, expected) {
    const mismatched = [];

    const pass = Array.isArray(received) && received.every((item) => {
        const matches = this.equals(item, expect.objectContaining(expected));
        if (!matches) {
            mismatched.push(item);
        }
        return matches;
    });

    if (pass) {
        return {
            message: () => `expected ${this.utils.printReceived(received)} to not only contain ${this.utils.printExpected(expected)}`,
            pass: true
        };
    } else {
        return {
            message: () => `expected array items ${this.utils.printReceived(mismatched)} to match ${this.utils.printExpected(expected)}`,
            pass: false
        };
    }
}

expect.extend({ toEachMatchObject });
