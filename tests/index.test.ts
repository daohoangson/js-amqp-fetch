import type { Channel } from 'amqplib'

import { describe } from 'mocha'
import { connect } from 'mock-amqplib'
import { expect } from 'chai'

import { Fetch, main } from '../src'

interface _Fetch {
  url: string
  timeout: number
}
const fetches: _Fetch[] = []
const fetch: Fetch = async (url, init) => {
  fetches.push({ url, ...init })
  return { status: 200 }
}

describe('main', () => {
  describe('connects OK', () => {
    let ch: Channel
    let queue: string

    beforeEach(async () => {
      fetches.length = 0

      const conn = await connect('')
      ch = await conn.createChannel()

      queue = `queue${Math.random()}`
      await ch.assertQueue(queue)

      await main({ connect, fetch, queue })
    })

    it('fetches with data from msg', async () => {
      const url = `url${Math.random()}`
      await ch.sendToQueue(queue, Buffer.from(JSON.stringify({ url })))

      expect(fetches).deep.equals([{ url, timeout: 300000 }])
    })

    it('handles invalid msg', async () => {
      await ch.sendToQueue(queue, Buffer.from('yolo'))

      expect(fetches.length).equals(0)
    })
  })
})
