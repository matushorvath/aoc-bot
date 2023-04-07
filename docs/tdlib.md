# Configuration

1. Register the telegram application using https://my.telegram.org/apps.
1. Save the information as GitHub secrets:
    - the API id as TDLIB_API_ID
    - the API hash as TDLIB_API_HASH
1. Save the API id and API hash you receive to credentials.yaml (created from credentials.yaml.template).   
   This file is used to run integration tests locally. It is automatically created when running from CI/CD.
1. Run a tdlib-based Telegram client once, to log in using your phone and one-time key.
1. Generate a long random password:
   Save the password as TDLIB_AES_KEY GitHub secret.
   ```sh
   $ uuidgen -r
   ```
1. Encrypt file _td_database/td.binlog using AES and store it in GitHub:
   ```sh
   $ openssl enc -in _td_database/td.binlog -out integration-tests/td.binlog.aes -e -aes256 -pass "pass:$TDLIB_AES_KEY" -pbkdf2
   ```
   (replace password from previous step for $TDLIB_AES_KEY)
