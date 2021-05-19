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

# message without delay
export AMQP_FETCH_QUEUE="e2e-`date +%s`"
./.services.sh exec -T rabbitmq rabbitmqadmin declare queue "name=$AMQP_FETCH_QUEUE" durable=true && sleep 1
./.node.sh up -d ncc && sleep 1
./.services.sh exec -T rabbitmq rabbitmqadmin publish "routing_key=$AMQP_FETCH_QUEUE" 'payload={"url":"https://google.com"}' && sleep 1
if ./.node.sh logs ncc | grep google.com | grep ' -> 200 '; then
  echo OK >/dev/null
else
  echo 'FAILED: expected google.com 200'
  exit 1
fi

# delayed message
export AMQP_FETCH_QUEUE="e2e-delayed-destination-`date +%s`"
_queueDelayed="e2e-delayed-`date +%s`"
./.services.sh exec -T rabbitmq rabbitmqadmin declare queue "name=$_queueDelayed" durable=true \
  "arguments={\"x-dead-letter-exchange\":\"\",\"x-dead-letter-routing-key\":\"$AMQP_FETCH_QUEUE\",\"x-message-ttl\":86400000}" && sleep 1
./.services.sh exec -T rabbitmq rabbitmqadmin declare queue "name=$AMQP_FETCH_QUEUE" durable=true && sleep 1
./.node.sh up -d ncc && sleep 1
./.services.sh exec -T rabbitmq rabbitmqadmin publish "routing_key=$_queueDelayed" 'payload={"url":"https://github.com"}' \
  'properties={"expiration":"5000"}' && sleep 1
if ./.node.sh logs ncc | grep github.com; then
  echo 'FAILED: unexpected github.com'
  exit 1
else
  echo OK >/dev/null
fi

sleep 10
if ./.node.sh logs ncc | grep github.com | grep ' -> 200 '; then
  echo OK >/dev/null
else
  echo 'FAILED: expected github.com 200'
  exit 1
fi

echo OK
