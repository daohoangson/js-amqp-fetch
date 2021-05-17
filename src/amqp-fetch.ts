import { Connection, ConsumeMessage } from 'amqplib'

type AmqplibConnect = (url: string) => Promise<Connection>

export type Fetch = (
  url: string,
  init: {
    timeout: number
  }
) => Promise<{ status: number }>

interface Params {
  connect: AmqplibConnect
  connectUrl?: string
  fetch: Fetch
  fetchTimeoutInMs?: string
  queue?: string
  retries?: string
}

const _headerConsumeCount = 'x-consume-count'

function _error (e: any): void {
  console.error(e instanceof Error ? e.message : e)
}

function _parseJson (text: string): any {
  try {
    return JSON.parse(text)
  } catch (e) {
    _error(e)
    return text
  }
}

export async function amqpFetch (params: Params): Promise<() => Promise<void>> {
  const retries = parseInt(params.retries ?? '3', 10)
  const connectUrl = params.connectUrl ?? 'amqp://localhost'
  const timeout = parseInt(params.fetchTimeoutInMs ?? '300000', 10)
  const queue = params.queue ?? 'amqp-fetch'

  const conn = await params.connect(connectUrl)
  const ch = await conn.createChannel()

  const reject = (msg: ConsumeMessage): void => ch.nack(msg, false, false)
  const redeliver = (msg: ConsumeMessage): boolean => {
    let redelivered = false
    const consumeCount = msg.properties.headers[_headerConsumeCount] as number ?? 1
    if (retries === 0 || consumeCount < retries) {
      redelivered = ch.sendToQueue(queue, msg.content, {
        headers: { [_headerConsumeCount]: consumeCount + 1 }
      })
    }

    ch.nack(msg, false, false)

    return redelivered
  }

  const consume = await ch.consume(queue, (msg) => {
    if (msg === null) {
      return
    }

    const str = msg.content.toString()
    const json = _parseJson(str)
    if (typeof json !== 'object') {
      reject(msg)
      console.error('Ignore msg (not JSON object)', str)
      return
    }

    const { url } = json
    if (typeof url !== 'string' || url.length < 1) {
      reject(msg)
      console.error('Ignore msg (no URL)', json)
      return
    }

    const fetchInit = {
      timeout
    }
    const timeStart = process.hrtime()
    params.fetch(url, fetchInit).then(
      (resp) => {
        const status = resp.status
        const timeElapsed = process.hrtime(timeStart)

        if (status >= 200 && status < 300) {
          ch.ack(msg)
          console.log(`${url} -> ${status} in ${timeElapsed[0]}s + ${timeElapsed[1]}ns`)
        } else {
          const redelivered = redeliver(msg)
          console.warn('redeliver (status)', { url, status, timeElapsed, redelivered })
        }
      },
      (e) => {
        _error(e)
        const redelivered = redeliver(msg)
        console.error('redeliver (fetch error)', { url, redelivered })
      }
    )
  })

  console.log('Connected', {
    connectUrl,
    timeout,
    queue
  })

  return async () => {
    await ch.cancel(consume.consumerTag)
    await ch.close()
    await conn.close()
  }
}
