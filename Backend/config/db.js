// ============================================================================
// Database Configuration
// Connects to MongoDB database using Mongoose
// ============================================================================

import mongoose from 'mongoose';

// Connect to MongoDB using the URI from environment variables
const connectDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    // Exit process with failure code if database fails to connect
    process.exit(1);
  }
};

export default connectDB;
