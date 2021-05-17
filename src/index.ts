import { connect } from 'amqplib'
import fetch from 'node-fetch'

import { amqpFetch } from './amqp-fetch'

const {
  AMQP_FETCH_CONNECT_URL: connectUrl,
  AMQP_FETCH_FETCH_TIMEOUT_IN_MS: fetchTimeoutInMs,
  AMQP_FETCH_QUEUE: queue,
  AMQP_FETCH_RETRIES: retries
} = process.env

// eslint-disable-next-line
amqpFetch({
  connect,
  connectUrl,
  fetch,
  fetchTimeoutInMs,
  queue,
  retries
})
