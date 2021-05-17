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

./.node.sh build ncc

export AMQP_FETCH_QUEUE="e2e-`date +%s`"

./.services.sh exec -T rabbitmq rabbitmqadmin declare queue "name=$AMQP_FETCH_QUEUE" durable=true
sleep 1

./.node.sh up -d ncc
sleep 1

./.services.sh exec -T rabbitmq rabbitmqadmin publish "routing_key=$AMQP_FETCH_QUEUE" 'payload={"url":"https://google.com"}'
if ./.node.sh logs ncc | grep " -> 200 "; then
  echo 'OK'
else
  echo 'FAILED'
  exit 1
fi
