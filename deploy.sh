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

# Update SSM secrets using values from GitHub
if [ -z "$SKIP_SECRETS" ] ; then
    put_secret() {
        local param_name="$1"
        local param_value="$2"

        aws ssm put-parameter \
            --overwrite \
            --region $region \
            --name "/aoc-bot/$param_name" \
            --type SecureString \
            --value "$param_value"
    }

    put_secret "advent-of-code-secret" "$ADVENT_OF_CODE_SECRET"
    put_secret "telegram-secret" "$TELEGRAM_SECRET"
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
