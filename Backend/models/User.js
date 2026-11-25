// ============================================================================
// User Model
// Defines schema and structure for users in the database
// ============================================================================

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    // Full name of the user
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },

    // User email (must be unique and converted to lowercase)
    email: {  
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },

    // User phone number (must be unique)
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
    },

    // Hashed password
    password: {
      type: String,
      required: [true, 'Password is required'],
    },

    // Avatar image URL (default is empty string)
    avatar: {
      type: String,
      default: '',
    },

    // Last time user went offline
    lastSeen: {
      type: Date,
      default: null,
    },
  },
  {
    // Automatically creates and manages createdAt and updatedAt fields
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

export default User;
