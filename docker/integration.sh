#!/bin/bash

set -e
cd "$( dirname "${BASH_SOURCE[0]}" )"

if ./.services.sh ps | grep rabbitmq | grep 5672/tcp; then
  echo 'rabbitmq is already running...' >&2
else
  rm -rf .data
  ./.services.sh up -d
  sleep 30
fi

exec ./.node.sh run --rm npm-test
