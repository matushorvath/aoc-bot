#!/bin/sh

set -e

version=$(<package.json jq -re .version)

if [[ "$OSTYPE" == "darwin"* ]] ; then
    uuid=$(uuidgen | tr "[:upper:]" "[:lower:]" | tr -d -)
else
    uuid=$(uuidgen -r | tr -d -)
fi

package=aoc-bot-$version-$uuid.zip

region=eu-central-1
bucket=cf.009116496185.$region

# Update SSM secrets using values from GitHub
if [ -z "$SKIP_SECRETS" ] ; then
    aws ssm put-parameter \
        --overwrite \
        --region $region \
        --name /aoc-bot/advent-of-code-secret \
        --type SecureString \
        --value "$ADVENT_OF_CODE_SECRET"

    aws ssm put-parameter \
        --overwrite \
        --region $region \
        --name /aoc-bot/telegram-secret \
        --type SecureString \
        --value "$TELEGRAM_SECRET"
fi

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
