import mongoose from 'mongoose'

function getMongoUri(): string {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable')
  }
  return uri
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongooseCache: MongooseCache | undefined
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null }
global.mongooseCache = cached

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    const uri = getMongoUri()
    cached.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .catch((error) => {
        cached.promise = null
        throw error
      })
  }

  try {
    cached.conn = await cached.promise
    return cached.conn
  } catch (error) {
    cached.promise = null
    throw error
  }
}
