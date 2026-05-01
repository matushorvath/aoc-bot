import yaml from 'yaml';
import fs from 'fs/promises';
import path from 'path';

export const loadTelegramCredentials = async () => {
    try {
        return yaml.parse(await fs.readFile(path.join(__dirname, 'credentials.yaml'), 'utf-8'));
    } catch (e) {
        console.error('You need to create credentials.yaml using credentials.yaml.template');
        throw e;
    }
};
