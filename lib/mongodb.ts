import mongoose from 'mongoose'

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongooseCache: MongooseCache | undefined
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null }
global.mongooseCache = cached

function getMongoUri(): string {
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    throw new Error('Please define the MONGODB_URI environment variable')
  }

  return mongoUri
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(getMongoUri(), { bufferCommands: false })
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
