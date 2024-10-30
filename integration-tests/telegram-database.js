'use strict';

const crypto = require ('crypto');
const fs = require('fs/promises');
const path = require('path');
const util = require('util');
const os = require('os');

const pbkdf2Async = util.promisify(crypto.pbkdf2);

const createTelegramDatabase = async () => {
    const tmpDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'aoc-bot-tdlib-'));

    const databaseDirectory = path.join(tmpDirectory, '_td_database');
    await fs.mkdir(databaseDirectory, { recursive: true });

    const filesDirectory = path.join(tmpDirectory, '_td_files');
    await fs.mkdir(filesDirectory, { recursive: true });

    return { databaseDirectory, filesDirectory };
};

const loadTelegramDatabase = async (aesKey) => {
    const { databaseDirectory, filesDirectory } = await createTelegramDatabase();

    const encryptedName = path.join(__dirname, 'td.binlog.aes');
    const decryptedName = path.join(databaseDirectory, 'td.binlog');

    // Create the td.binlog unless it already exists
    let decryptedHandle;
    try {
        decryptedHandle = await fs.open(decryptedName, 'wx', 0o644);
    } catch (error) {
        if (error.code === 'EEXIST') {
            return;
        }
        throw error;
    }

    // Decrypt the file and write it out
    try {
        const encrypted = await fs.readFile(encryptedName);
        const decrypted = await decryptDatabase(encrypted, aesKey);

        await decryptedHandle.writeFile(decrypted);
    } finally {
        await decryptedHandle.close();
    }

    return { databaseDirectory, filesDirectory };
};

const decryptDatabase = async (encrypted, aesKey) => {
    console.log('decryptDatabase: start');

    const salt = encrypted.subarray(8, 16);
    const input = encrypted.subarray(16);

    const info = crypto.getCipherInfo('aes-256-cbc');
    const keyIv = await pbkdf2Async(aesKey, salt, 10000, info.keyLength + info.ivLength, 'sha256');

    const key = keyIv.subarray(0, info.keyLength);
    const iv = keyIv.subarray(info.keyLength);

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(input), decipher.final()]);

    console.log('decryptDatabase: done');

    return decrypted;
};

module.exports = {
    createTelegramDatabase,
    loadTelegramDatabase
};
