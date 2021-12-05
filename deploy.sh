#!/bin/sh

set -e

version=$(<package.json jq -re .version)
uuid=$(uuidgen -r | tr -d -)
package=aoc-bot-$version-$uuid.zip
bucket=cf.009116496185.eu-central-1

zip -rq $package $(<package.json jq -re .files[],.deployFiles[])

aws s3 cp \
    --region eu-central-1 \
    $package s3://$bucket/$package

aws cloudformation deploy \
    --region eu-central-1 \
    --capabilities CAPABILITY_IAM \
    --template template.yml --stack-name aoc-bot \
    --parameter-overrides \
        Bucket=$bucket \
        Package=$package \
        Version=$version

rm -f $package
