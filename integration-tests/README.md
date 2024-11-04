# Configuration

1. Register the telegram application using https://my.telegram.org/apps.
1. Save the information as GitHub secrets:
    - the API id as TDLIB_API_ID
    - the API hash as TDLIB_API_HASH
1. Generate a long random password:
   Save the password as TDLIB_AES_KEY GitHub secret.
   ```sh
   $ uuidgen -r
   ```
1. Save the API id, API hash abd AES key to credentials.yaml (created from credentials.yaml.template).   
   This file is used to run integration tests locally. It is automatically created when running from CI/CD.
1. Run a create-telegram-database.js once, to log in using your phone and a one-time key or two-factor authentication.
   ```sh
   $ node create-telegram-database.js
   ```
   This will update the encrypted telegram database in integration-tests/td.binlog.aes. You should commit td.binlog.aes to git.
