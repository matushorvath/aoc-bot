'use strict';

const copy = require('copy-dynamodb-table').copy;

copy({
    source: {
        tableName: 'aoc-redirect-import' // required
    },
    destination: {
        tableName: 'aoc-bot' // required
    },
    log: true, // default false
    create : false, // create destination table if not exist
    schemaOnly : false, // if true it will copy schema only -- optional
    continuousBackups: false, // if true will enable point in time backups
    transform: function(item, _index) { return item; } // function to transform data
},
function (err, result) {
    if (err) {
        console.log(err);
    }
    console.log(result);
});
