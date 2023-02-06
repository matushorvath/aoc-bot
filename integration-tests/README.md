# Configuration

1. Register the telegram application using https://my.telegram.org/apps.
1. Save the API id and API hash you receive to credentials.yaml (created from credentials.yaml.template).
   Save credentials.yaml as INTEGRATION_TESTS_CREDENTIALS GitHub secret.
1. Run a tdlib-based Telegram client once, to log in using your phone and one-time key.
1. Generate a large random password:
   Save the password as INTEGRATION_TESTS_AES_KEY GitHub secret.
   ```sh
   $ uuidgen -r
   ```
1. Encrypt file _td_database/td.binlog using AES and store it in GitHub:
   ```sh
   $ openssl enc -in _td_database/td.binlog -out integration-tests/td.binlog.aes -e -aes256 -pass "pass:$INTEGRATION_TESTS_AES_KEY" -pbkdf2
   ```
   (replace password from previous step for $INTEGRATION_TESTS_AES_KEY)
