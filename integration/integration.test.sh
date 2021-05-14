#!/bin/bash

set -e
cd "$( dirname "${BASH_SOURCE[0]}" )"

if docker-compose ps | grep rabbitmq | grep 5672/tcp; then
  echo 'rabbitmq is already running...' >&2
else
  rm -rf .data
  docker-compose up -d rabbitmq
  sleep 30
fi

exec docker-compose up test
