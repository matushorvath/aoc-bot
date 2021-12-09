#!/bin/sh

set -e

version=$(<package.json jq -re .version)
uuid=$(uuidgen -r | tr -d -)
package=aoc-bot-$version-$uuid.zip

region=eu-central-1
bucket=cf.009116496185.eu-central-1

# Store secrets passed from GitHub Actions
aws ssm put-parameter \
    --region $region \
    --name /aoc-bot/advent-of-code-secret \
    --type SecureString \
    --value "$ADVENT_OF_CODE_SECRET" \
    --overwrite

aws ssm put-parameter \
    --region $region \
    --name /aoc-bot/telegram-secret \
    --type SecureString \
    --value "$TELEGRAM_SECRET" \
    --overwrite

# Upload and deploy the package
zip -rq $package $(<package.json jq -re .files[],.deployFiles[])

aws s3 cp \
    --region $region \
    $package s3://$bucket/$package

aws cloudformation deploy \
    --region $region \
    --capabilities CAPABILITY_IAM \
    --template template.yml --stack-name aoc-bot \
    --parameter-overrides \
        Bucket=$bucket \
        Package=$package \
        Version=$version

rm -f $package
