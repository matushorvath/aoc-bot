'use strict';

function toBeOneOf(received, ...expected) {
    const pass = expected.includes(received);
    if (pass) {
        return {
            message: () => `expected ${this.utils.printReceived(received)} not to be one of ${this.utils.printExpected(expected)}`,
            pass: true
        };
    } else {
        return {
            message: () => `expected ${this.utils.printReceived(received)} to be one of ${this.utils.printExpected(expected)}`,
            pass: false
        };
    }
}

expect.extend({ toBeOneOf });
