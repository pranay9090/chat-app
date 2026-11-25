// ============================================================================
// Conversation Model
// Schema for 1-to-1 and group conversations
// ============================================================================

import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    // Indicates if this conversation is a group chat
    isGroup: {
      type: Boolean,
      default: false,
    },

    // Optional name for group conversations
    name: {
      type: String,
      default: '',
    },

    // Group photo base64 data URL
    avatar: {
      type: String,
      default: '',
    },

    // Array of User IDs participating in the conversation
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Array of group admin User IDs
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Reference to the most recent Message in this conversation
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },

    // Track per-user soft deletion timestamps for 1-to-1 chats
    deletedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        deletedAt: Date,
      },
    ],

    // Users who pinned this conversation
    pinnedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Users who muted this conversation
    mutedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    // Automatically manages createdAt and updatedAt
    timestamps: true,
  }
);

// Index for fast conversation list queries
conversationSchema.index({ members: 1, updatedAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
