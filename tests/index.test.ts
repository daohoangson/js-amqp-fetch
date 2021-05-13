import { describe } from 'mocha'
import { connect } from 'mock-amqplib'
import { expect } from 'chai'

import { main } from '../src'

const fetches: any[] = []
async function fetch (input: any): Promise<{ status: number }> {
  fetches.push(input)
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

    const input = { url: 'yolo' }
    await ch.sendToQueue(queue, Buffer.from(JSON.stringify(input)))

    expect(fetches).deep.equals([input])
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
