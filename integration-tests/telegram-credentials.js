'use strict';

const yaml = require('yaml');
const fs = require('fs/promises');
const path = require('path');

const loadTelegramCredentials = async () => {
    try {
        return yaml.parse(await fs.readFile(path.join(__dirname, 'credentials.yaml'), 'utf-8'));
    } catch (e) {
        console.error('You need to create credentials.yaml using credentials.yaml.template');
        throw e;
    }
};

module.exports = {
    loadTelegramCredentials
};
