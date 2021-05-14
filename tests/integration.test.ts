import { describe } from 'mocha'
import { Channel, connect, Connection } from 'amqplib'
import mockServer from 'mockserver-client'
import fetch from 'node-fetch'

import { main } from '../src'
import { MockServerClient } from 'mockserver-client/mockServerClient'
import { expect } from 'chai'

async function sleep (ms: number): Promise<void> {
  return await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

const {
  INTEGRATION_CONNECT_URL,
  INTEGRATION_MOCKSERVER_HOST
} = process.env
const suite = (
  INTEGRATION_CONNECT_URL !== undefined &&
  INTEGRATION_MOCKSERVER_HOST !== undefined
) ? describe : describe.skip

suite('integration', function () {
  const connectUrl = INTEGRATION_CONNECT_URL ?? ''
  const mockserverHost = INTEGRATION_MOCKSERVER_HOST ?? ''
  const mockserverPort = 1080
  const retries = 3
  let ch: Channel
  let conn: Connection
  let mockServerClient: MockServerClient
  let queue: string
  let quit: () => Promise<void>
  let urlPrefix: string

  beforeEach(async () => {
    conn = await connect(connectUrl)
    ch = await conn.createChannel()

    queue = `queue${Math.random()}`
    await ch.assertQueue(queue)

    quit = await main({
      connect,
      connectUrl,
      fetch,
      queue,
      retries: `${retries}`
    })

    mockServerClient = mockServer.mockServerClient(mockserverHost, mockserverPort)
    urlPrefix = `http://${mockserverHost}:${mockserverPort}/${queue}`
    await mockServerClient.mockSimpleResponse(`/${queue}/200`, 'http200', 200)
    await mockServerClient.mockSimpleResponse(`/${queue}/202`, 'http202', 202)
    await mockServerClient.mockAnyResponse({
      httpRequest: {
        path: `/${queue}/301`
      },
      httpResponse: {
        statusCode: 301,
        headers: [
          {
            name: 'Location',
            values: [`${urlPrefix}/200`]
          }
        ]
      }
    })
    await mockServerClient.mockSimpleResponse(`/${queue}/401`, 'http401', 401)
    await mockServerClient.mockSimpleResponse(`/${queue}/403`, 'http403', 403)
    await mockServerClient.mockSimpleResponse(`/${queue}/404`, 'http404', 404)
    await mockServerClient.mockSimpleResponse(`/${queue}/500`, 'http500', 500)
    await mockServerClient.mockSimpleResponse(`/${queue}/502`, 'http502', 502)
  })

  afterEach(async () => {
    const msg = await ch.get(queue)
    expect(msg).equals(false)

    await ch.deleteQueue(queue)
    await ch.close()
    await conn.close()
    await mockServerClient.reset()
    await quit()
  })

  it('handles 200', async () => {
    const url = `${urlPrefix}/200`
    await ch.sendToQueue(queue, Buffer.from(JSON.stringify({ url })))

    await sleep(10)

    await mockServerClient.verify({ path: `/${queue}/200` }, 1)

    const reqs = await mockServerClient.retrieveRecordedRequests({ method: 'GET' })
    expect(reqs.length).equals(1)
  })

  it('handles 202', async () => {
    const url = `${urlPrefix}/202`
    await ch.sendToQueue(queue, Buffer.from(JSON.stringify({ url })))

    await sleep(10)

    await mockServerClient.verify({ path: `/${queue}/202` }, 1)

    const reqs = await mockServerClient.retrieveRecordedRequests({ method: 'GET' })
    expect(reqs.length).equals(1)
  })

  it('handles 301', async () => {
    const url = `${urlPrefix}/301`
    await ch.sendToQueue(queue, Buffer.from(JSON.stringify({ url })))

    await sleep(1000)

    await mockServerClient.verify({ path: `/${queue}/301` }, 1)
    await mockServerClient.verify({ path: `/${queue}/200` }, 1)

    const reqs = await mockServerClient.retrieveRecordedRequests({ method: 'GET' })
    expect(reqs.length).equals(2)
  })

  describe('retries', () => {
    for (const status of [401, 403, 404, 500, 502]) {
      it(`retires ${status}`, async () => {
        const url = `${urlPrefix}/${status}`
        await ch.sendToQueue(queue, Buffer.from(JSON.stringify({ url })))

        await sleep(100)

        await mockServerClient.verify({ path: `/${queue}/${status}` }, retries)

        const reqs = await mockServerClient.retrieveRecordedRequests({ method: 'GET' })
        expect(reqs.length).equals(retries)
      })
    }
  })
})
