'use strict';

const fs = require('fs/promises');
const zlib = require('zlib');
const util = require('util');
const path = require('path');

const gzipAsync = util.promisify(zlib.gzip);
const gunzipAsync = util.promisify(zlib.gunzip);

const main = async () => {
    const dir = path.join('.', 'data');

    const allFiles = await fs.readdir(dir);
    const files = allFiles.filter(file => /^orig\..*\.json\.gz$/.test(file));

    const records = {};

    for (const ifile of files) {
        const izdata = await fs.readFile(path.join(dir, ifile));
        const idata = await gunzipAsync(izdata);
        const ijsons = idata.toString('utf8').trim().split(/\n/).map(line => JSON.parse(line));

        for (const json of ijsons) {
            const yrecord = records[json.Item.year.N] ?? (records[json.Item.year.N] = {});
            const drecord = yrecord[json.Item.day.N] ?? (yrecord[json.Item.day.N] = {});
            const precord = drecord[json.Item.part.N] ?? (drecord[json.Item.part.N] = {});

            if (!precord[json.Item.name.S] || precord[json.Item.name.S] > json.Item.ts.N) {
                precord[json.Item.name.S] = json.Item.ts.N;
            }
        }
    }

    const ojsons = [];

    for (const [year, yrecords] of Object.entries(records)) {
        for (const [day, drecords] of Object.entries(yrecords)) {
            for (const [part, precords] of Object.entries(drecords)) {
                for (const [name, ts] of Object.entries(precords)) {
                    ojsons.push({
                        Item: {
                            id: { S: 'start_time' },
                            sk: { S: `${year}:${day}:${part}:${name}` },
                            year: { N: String(year) },
                            day: { N: String(day) },
                            part: { N: String(part) },
                            name: { S: name },
                            ts: { N: String(ts) }
                        }
                    });
                }
            }
        }
    }

    const odata = Buffer.from(ojsons.map(json => JSON.stringify(json)).join('\n'), 'utf8');
    const ozdata = await gzipAsync(odata);
    await fs.writeFile(path.join(dir, 'import.json.gz'), ozdata);
};

main().catch(console.error);
