'use strict';

function toEachPassPredicate(received, predicate) {
    const mismatched = [];

    const pass = Array.isArray(received) && received.every((item) => {
        const matches = predicate(item);
        if (!matches) {
            mismatched.push(item);
        }
        return matches;
    });

    if (pass) {
        return {
            message: () => `expected ${this.utils.printReceived(received)} to not all pass predicate`,
            pass: true
        };
    } else {
        return {
            message: () => `expected array items ${this.utils.printReceived(mismatched)} to pass predicate`,
            pass: false
        };
    }
}

expect.extend({ toEachPassPredicate });
