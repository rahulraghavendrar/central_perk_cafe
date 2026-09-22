import dns from 'node:dns'
dns.setServers(['8.8.8.8', '1.1.1.1'])

import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
let clientPromise

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri)
  global._mongoClientPromise = client.connect()
}
clientPromise = global._mongoClientPromise

export default clientPromise