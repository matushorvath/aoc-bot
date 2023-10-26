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

    for (const ifile of files) {
        const ofile = ifile.replace(/^orig./, '');
        if (ifile === ofile) throw new Error('file names are equal');

        const izdata = await fs.readFile(path.join(dir, ifile));
        const idata = await gunzipAsync(izdata);
        const jsons = idata.toString('utf8').trim().split(/\n/).map(line => JSON.parse(line));

        for (const json of jsons) {
            const [id, ...sk] = json.Item.id.S.split(':');
            json.Item.id.S = id;
            json.Item.sk = { S: sk.length > 0 ? sk.join(':') : '0' };
        }

        const odata = Buffer.from(jsons.map(json => JSON.stringify(json)).join('\n'), 'utf8');
        const ozdata = await gzipAsync(odata);
        await fs.writeFile(path.join(dir, ofile), ozdata);
    }
};

main().catch(console.error);
