#!/bin/sh

# TODO add shellcheck for all scripts

set -e

version=$(<package.json jq -re .version)

if [ "$(uname -s)" = "Darwin" ] ; then
    uuid=$(uuidgen | tr "[:upper:]" "[:lower:]" | tr -d -)
else
    uuid=$(uuidgen -r | tr -d -)
fi

package=aoc-bot-$version-$uuid.zip

region=eu-central-1
bucket=cf.009116496185.$region
stack=aoc-bot

# Update SSM secrets using values from GitHub
if [ -z "$SKIP_SECRETS" ] ; then
    put_secret() {
        local param_name="$1"
        local param_value="$2"

        aws ssm put-parameter \
            --overwrite \
            --region $region \
            --name "/$stack/$param_name" \
            --type SecureString \
            --value "$param_value"
    }

    put_secret "advent-of-code-secret" "$ADVENT_OF_CODE_SECRET"
    put_secret "telegram-secret" "$TELEGRAM_SECRET"
    put_secret "webhook-secret" "$WEBHOOK_SECRET"
fi

# Upload and deploy the package
zip -rq $package $(<package.json jq -re .files[],.deployFiles[])

aws s3 cp \
    --region $region \
    $package s3://$bucket/$package

aws cloudformation deploy \
    --region $region \
    --capabilities CAPABILITY_IAM \
    --template template.yml \
    --stack-name $stack \
    --parameter-overrides \
        Bucket=$bucket \
        Package=$package \
        Version=$version

rm -f $package

# Register the Telegram webhook
endpoint=$(aws cloudformation describe-stacks \
    --region $region \
    --stack-name $stack \
    --query "Stacks[0].Outputs[?OutputKey=='Endpoint'].OutputValue" \
    --output text \
)
echo Endpoint: $endpoint

node src/register.js "${endpoint}telegram"
