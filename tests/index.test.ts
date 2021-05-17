import type { Channel } from 'amqplib'

import { describe } from 'mocha'
import { connect } from 'mock-amqplib'
import { expect } from 'chai'

import { Fetch, amqpFetch } from '../src/amqp-fetch'

interface _Fetch {
  url: string
  timeout: number
}
const fetches: _Fetch[] = []
const fetch: Fetch = async (url, init) => {
  fetches.push({ url, ...init })

  const status = url.match(/-status=(\d+)-/)
  if (status !== null) {
    return { status: parseInt(status[1], 10) }
  }

  return { status: 200 }
}

describe('main', () => {
  describe('connects OK', () => {
    const retries = 3
    let ch: Channel
    let queue: string

    beforeEach(async () => {
      fetches.length = 0

      const conn = await connect('')
      ch = await conn.createChannel()

      queue = `queue${Math.random()}`
      await ch.assertQueue(queue)

      await amqpFetch({
        connect,
        fetch,
        queue,
        retries: `${retries}`
      })
    })

    it('fetches with data from msg', async () => {
      const url = `url${Math.random()}`
      await ch.sendToQueue(queue, Buffer.from(JSON.stringify({ url })))
      await ch.close()

      expect(fetches).deep.equals([{ url, timeout: 300000 }])
    })

    it('retries with non-2xx statuses', async () => {
      const url = `url${Math.random()}-status=400-`
      await ch.sendToQueue(queue, Buffer.from(JSON.stringify({ url })))
      await ch.close()

      expect(fetches.length).equals(retries)
    })

    describe('invalid msg', () => {
      it('handles object', async () => {
        await ch.sendToQueue(queue, Buffer.from(JSON.stringify({ foo: 'bar' })))
        await ch.close()

        expect(fetches.length).equals(0)
      })

      it('handles string', async () => {
        await ch.sendToQueue(queue, Buffer.from('yolo'))
        await ch.close()

        expect(fetches.length).equals(0)
      })
    })
  })
})
