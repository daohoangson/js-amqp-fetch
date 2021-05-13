import { connect } from 'amqplib'

export async function main() {
  const {
    AMQP_FETCH_CONNECT_URL,
    AMQP_FETCH_QUEUE
  } = process.env

  const connectUrl = AMQP_FETCH_CONNECT_URL ?? 'amqp://localhost'
  const queue = AMQP_FETCH_QUEUE ?? 'amqp-fetch'

  const open = await connect(connectUrl)
  const ch = await open.createChannel()
  await ch.assertQueue(queue)
  await ch.consume(queue, (msg) => {
    if (msg === null) return

    console.log(msg.content.toString())
    ch.ack(msg)
  })
}

if (require.main === module) {
  main()
}
