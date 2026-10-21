import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/uk_rail';

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true);

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  });

  console.log(`MongoDB connected: ${mongoose.connection.name} @ ${mongoose.connection.host}`);
}

export function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}

export { mongoose };
