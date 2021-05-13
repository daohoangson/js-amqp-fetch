import { connect, Connection } from 'amqplib'

type AmqplibConnect = (url: string) => Promise<Connection>

type Fetch = (input: RequestInfo) => Promise<{ status: number }>

interface MainParams {
  connect: AmqplibConnect
  connectUrl?: string
  fetch: Fetch
  queue?: string
}

function _parseJson (text: string): any {
  try {
    return JSON.parse(text)
  } catch (e) {
    console.error(e)
    return {}
  }
}

export async function main (params: MainParams): Promise<void> {
  const connectUrl = params.connectUrl ?? 'amqp://localhost'
  const queue = params.queue ?? 'amqp-fetch'

  const conn = await params.connect(connectUrl)
  const ch = await conn.createChannel()
  await ch.assertQueue(queue)

  await ch.consume(queue, (msg) => {
    if (msg === null) return

    const str = msg.content.toString()
    const json = _parseJson(str)
    if (typeof json !== 'object' || typeof json.url !== 'string') {
      ch.nack(msg, false, false)
      return
    }

    params.fetch(json).then(
      (resp) => {
        const status = resp.status
        if (status >= 200 && status < 300) {
          ch.ack(msg)
        } else {
          ch.nack(msg)
        }
      },
      (e) => {
        console.error(e)
        ch.nack(msg)
      }
    )
  })
}

if (require.main === module) {
  const {
    AMQP_FETCH_CONNECT_URL: connectUrl,
    AMQP_FETCH_QUEUE: queue
  } = process.env

  // eslint-disable-next-line
  main({
    connect,
    connectUrl,
    fetch,
    queue
  })
}
