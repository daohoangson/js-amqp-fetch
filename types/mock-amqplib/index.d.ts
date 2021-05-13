declare module 'mock-amqplib' {
  import type { Connection } from 'amqplib'

  function connect (url: string): Promise<Connection>
}
