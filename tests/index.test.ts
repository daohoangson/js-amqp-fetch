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
  beforeEach(() => {
    fetches.length = 0
  })

  it('connects', async () => {
    await main({ connect, fetch })
  })

  it('fetches with data from msg', async () => {
    const queue = `queue${Math.random()}`
    await main({ connect, fetch, queue })

    const conn = await connect('')
    const ch = await conn.createChannel()

    const url = `url${Math.random()}`
    await ch.sendToQueue(queue, Buffer.from(JSON.stringify({ url })))

    expect(fetches).deep.equals([{ url, timeout: 300000 }])
  })

  it('handles invalid msg', async () => {
    const queue = `queue${Math.random()}`
    await main({ connect, fetch, queue })

    const conn = await connect('')
    const ch = await conn.createChannel()
    await ch.sendToQueue(queue, Buffer.from('yolo'))

    expect(fetches.length).equals(0)
  })
})
