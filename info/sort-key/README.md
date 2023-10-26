## Key Changes

```js
id: { S: `board:${chat}` }
id: { S: 'board' }, sk: { S: String(chat) }
```

```js
id: { S: `aoc_user:${aocUser}` }
id: { S: 'aoc_user' }, sk: { S: aocUser }
```

```js
id: { S: `chat:${year}:${day}` }
id: { S: 'chat' }, sk: { S: `${year}:${day}` }
```

```js
id: { S: `invite:${telegramUser}:${year}:${day}:${chat}` }
id: { S: 'invite' }, sk: { S: `${telegramUser}:${year}:${day}:${chat}` }
```

```js
id: { S: 'logs' },
id: { S: 'logs' }, sk: { S: '0' }
```

```js
id: { S: `telegram_user:${telegramUser}` }
id: { S: 'telegram_user' }, sk: { S: String(telegramUser) }
```

## Edit Data

```sh
for f in data/*.gz ; do mv $f data/orig.$(basename $f) ; done
node sort-key-bot.js
```

```sh
for f in data/*.gz ; do mv $f data/orig.$(basename $f) ; done
node sort-key-redirect.js
```

## Import Data

Copy data to S3, import just the directory with .json.zip files to a new table.

Copy data to the correct table using this:
```sh
npm i copy-dynamodb-table
code copy.js
AWS_PROFILE=private AWS_REGION=eu-central-1 node copy.js
```

Repeat for both aoc-bot and aoc-redirect imported data.
