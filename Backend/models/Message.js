// Message model
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    // Conversation reference
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },

    // Message sender
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Message text
    text: {
      type: String,
      default: '',
      trim: true,
    },

    // Optional reference to the message being replied to
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },

    // Whether the message has been edited
    edited: {
      type: Boolean,
      default: false,
    },

    // Whether the message has been deleted for everyone
    isDeleted: {
      type: Boolean,
      default: false,
    },

    // Emoji reactions on this message
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        emoji: String,
      },
    ],

    // Whether the message is a system event message
    isSystem: {
      type: Boolean,
      default: false,
    },

    // Users who have read this message
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],

    // Users who have received this message
    deliveredTo: [
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

// Index for fast conversation history queries
messageSchema.index({ conversationId: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);

export default Message;
