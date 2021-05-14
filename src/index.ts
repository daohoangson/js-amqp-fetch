import { connect, Connection } from 'amqplib'
import fetch from 'node-fetch'

type AmqplibConnect = (url: string) => Promise<Connection>

export type Fetch = (
  url: string,
  init: {
    timeout: number
  }
) => Promise<{ status: number }>

interface MainParams {
  connect: AmqplibConnect
  connectUrl?: string
  fetch: Fetch
  fetchTimeoutInMs?: string
  messageTtlInMs?: string
  queue?: string
}

function _error (e: any): void {
  console.error(e instanceof Error ? e.message : e)
}

function _parseJson (text: string): any {
  try {
    return JSON.parse(text)
  } catch (e) {
    _error(e)
    return {}
  }
}

export async function main (params: MainParams): Promise<void> {
  const connectUrl = params.connectUrl ?? 'amqp://localhost'
  const timeout = parseInt(params.fetchTimeoutInMs ?? '300000', 10)
  const messageTtl = parseInt(params.messageTtlInMs ?? '5000', 10)
  const queue = params.queue ?? 'amqp-fetch'

  const conn = await params.connect(connectUrl)
  const ch = await conn.createChannel()
  await ch.assertQueue(queue, {
    messageTtl
  })

  await ch.consume(queue, (msg) => {
    if (msg === null) return

    const str = msg.content.toString()
    const json = _parseJson(str)
    if (typeof json !== 'object') {
      ch.nack(msg, false, false)
      return
    }

    const { url } = json
    if (typeof url !== 'string' || url.length < 1) {
      ch.nack(msg, false, false)
      return
    }

    const fetchInit = {
      timeout
    }
    params.fetch(url, fetchInit).then(
      (resp) => {
        const status = resp.status
        if (status >= 200 && status < 300) {
          ch.ack(msg)
        } else {
          ch.nack(msg)
        }
      },
      (e) => {
        _error(e)
        ch.nack(msg)
      }
    )
  })
}

if (require.main === module) {
  const {
    AMQP_FETCH_CONNECT_URL: connectUrl,
    AMQP_FETCH_FETCH_TIMEOUT_IN_MS: fetchTimeoutInMs,
    AMQP_FETCH_MESSAGE_TTL_IN_MS: messageTtlInMs,
    AMQP_FETCH_QUEUE: queue
  } = process.env

  // eslint-disable-next-line
  main({
    connect,
    connectUrl,
    fetch,
    fetchTimeoutInMs,
    messageTtlInMs,
    queue
  })
}
