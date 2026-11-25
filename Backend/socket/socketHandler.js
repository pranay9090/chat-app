import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';

// userId -> number of open tabs
const onlineUsers = {};

// Verify message exists and user is a member of its conversation
const getMessageAndConversation = async (messageId, userId) => {
  if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
    return { error: 'Invalid message ID' };
  }
  const message = await Message.findById(messageId);
  if (!message) {
    return { error: 'Message not found' };
  }
  const conversation = await Conversation.findById(message.conversationId);
  if (!conversation) {
    return { error: 'Conversation not found' };
  }
  const isMember = conversation.members.some((id) => id.toString() === userId);
  if (!isMember) {
    return { error: 'You are not a member' };
  }
  return { message, conversation };
};

const initSocket = (io) => {
  // check token when someone connects
  io.use((socket, next) => {
    try {
      const decoded = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log('User Connected', userId);

    // private room for this user
    socket.join(userId);

    onlineUsers[userId] = (onlineUsers[userId] || 0) + 1;
    io.emit('onlineUsers', Object.keys(onlineUsers));

    // delivered catch-up for offline messages
    const markPendingAsDelivered = async () => {
      try {
        const myConversations = await Conversation.find({ members: userId });
        const conversationIds = myConversations.map((c) => c._id);

        const pending = await Message.find({
          conversationId: { $in: conversationIds },
          sender: { $ne: userId },
          deliveredTo: { $ne: userId },
        });

        for (const message of pending) {
          message.deliveredTo.push(userId);
          await message.save();
          io.to(message.sender.toString()).emit('messageDelivered', {
            messageId: message._id,
            conversationId: message.conversationId,
            userId,
          });
        }
      } catch (error) {
        console.log('delivered catch-up error:', error.message);
      }
    };
    markPendingAsDelivered();

    // send a message (works for 1-to-1 and groups)
    socket.on('sendMessage', async (data, callback) => {
      try {
        const { conversationId, text, replyTo } = data || {};

        if (!conversationId || !text || !text.trim()) {
          if (typeof callback === 'function') {
            return callback({ success: false, message: 'Message cannot be empty' });
          }
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          if (typeof callback === 'function') {
            return callback({ success: false, message: 'Conversation not found' });
          }
          return;
        }
        const isMember = conversation.members.some((id) => id.toString() === userId);
        if (!isMember) {
          if (typeof callback === 'function') {
            return callback({ success: false, message: 'You are not a member' });
          }
          return;
        }

        // Validate optional replyTo belongs to this conversation
        let validReplyTo = null;
        if (replyTo && mongoose.Types.ObjectId.isValid(replyTo)) {
          const repliedMsg = await Message.findById(replyTo);
          if (repliedMsg && repliedMsg.conversationId.toString() === conversationId.toString()) {
            validReplyTo = repliedMsg._id;
          }
        }

        // save the message (sender has read and delivered it to themselves)
        const newMessage = await Message.create({
          conversationId,
          sender: userId,
          text: text.trim(),
          replyTo: validReplyTo,
          readBy: [userId],
          deliveredTo: [userId],
        });

        conversation.lastMessage = newMessage._id;
        await conversation.save();

        const populatedMessage = await Message.findById(newMessage._id)
          .populate('sender', 'name')
          .populate({
            path: 'replyTo',
            select: 'text sender isDeleted',
            populate: { path: 'sender', select: 'name' },
          });

        // send to other members; only add to deliveredTo when recipient confirms
        for (const memberId of conversation.members) {
          const memberIdString = memberId.toString();
          if (memberIdString === userId) continue;

          io.to(memberIdString)
            .timeout(5000)
            .emit('newMessage', populatedMessage, async (err) => {
              if (!err) {
                await Message.updateOne(
                  { _id: newMessage._id },
                  { $addToSet: { deliveredTo: memberIdString } }
                );
                io.to(userId).emit('messageDelivered', {
                  messageId: newMessage._id,
                  conversationId,
                  userId: memberIdString,
                });
              }
            });
        }

        if (typeof callback === 'function') {
          callback({ success: true, message: populatedMessage });
        }
      } catch (error) {
        console.log('sendMessage error:', error.message);
        if (typeof callback === 'function') {
          callback({ success: false, message: 'Server error' });
        }
      }
    });

    // typing indicator
    socket.on('typing', async (data) => {
      try {
        const { conversationId, name } = data || {};
        if (!conversationId) return;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;
        const isMember = conversation.members.some((id) => id.toString() === userId);
        if (!isMember) return;
        conversation.members.forEach((memberId) => {
          if (memberId.toString() !== userId) {
            io.to(memberId.toString()).emit('typing', { conversationId, name });
          }
        });
      } catch (error) {
        console.log('typing error:', error.message);
      }
    });

    // stop typing indicator
    socket.on('stopTyping', async (data) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId) return;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;
        const isMember = conversation.members.some((id) => id.toString() === userId);
        if (!isMember) return;
        conversation.members.forEach((memberId) => {
          if (memberId.toString() !== userId) {
            io.to(memberId.toString()).emit('stopTyping', { conversationId });
          }
        });
      } catch (error) {
        console.log('stopTyping error:', error.message);
      }
    });

    // read receipts
    socket.on('markAsRead', async (data) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId) return;
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;
        const isMember = conversation.members.some((id) => id.toString() === userId);
        if (!isMember) return;

        await Message.updateMany(
          { conversationId, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );
      } catch (error) {
        console.log('markAsRead error:', error.message);
      }
    });

    // edit a message within 15 minutes
    socket.on('editMessage', async (data, callback) => {
      try {
        const { messageId, text } = data || {};
        const { message, conversation, error } = await getMessageAndConversation(messageId, userId);
        if (error) {
          return callback?.({ success: false, message: error });
        }

        if (message.isSystem) {
          return callback?.({ success: false, message: 'Not allowed' });
        }

        if (message.sender.toString() !== userId) {
          return callback?.({ success: false, message: 'Only the sender can edit this message' });
        }

        if (message.isDeleted) {
          return callback?.({ success: false, message: 'Deleted messages cannot be edited' });
        }

        if (Date.now() - new Date(message.createdAt).getTime() > 15 * 60 * 1000) {
          return callback?.({ success: false, message: 'You can only edit within 15 minutes' });
        }

        if (!text || !text.trim()) {
          return callback?.({ success: false, message: 'Message cannot be empty' });
        }

        message.text = text.trim();
        message.edited = true;
        await message.save();

        conversation.members.forEach((memberId) => {
          io.to(memberId.toString()).emit('messageEdited', {
            messageId: message._id,
            conversationId: message.conversationId,
            text: message.text,
          });
        });

        callback?.({ success: true });
      } catch (error) {
        console.log('editMessage error:', error.message);
        callback?.({ success: false, message: 'Server error' });
      }
    });

    // delete a message for everyone
    socket.on('deleteMessage', async (data, callback) => {
      try {
        const { messageId } = data || {};
        const { message, conversation, error } = await getMessageAndConversation(messageId, userId);
        if (error) {
          return callback?.({ success: false, message: error });
        }

        if (message.isSystem) {
          return callback?.({ success: false, message: 'Not allowed' });
        }

        if (message.sender.toString() !== userId) {
          return callback?.({ success: false, message: 'Only the sender can delete this message' });
        }

        message.isDeleted = true;
        message.text = '';
        message.reactions = [];
        await message.save();

        conversation.members.forEach((memberId) => {
          io.to(memberId.toString()).emit('messageDeleted', {
            messageId: message._id,
            conversationId: message.conversationId,
          });
        });

        callback?.({ success: true });
      } catch (error) {
        console.log('deleteMessage error:', error.message);
        callback?.({ success: false, message: 'Server error' });
      }
    });

    // toggle or replace emoji reaction on a message
    socket.on('reactToMessage', async (data, callback) => {
      try {
        const { messageId, emoji } = data || {};
        const { message, conversation, error } = await getMessageAndConversation(messageId, userId);
        if (error) {
          return callback?.({ success: false, message: error });
        }

        if (message.isSystem) {
          return callback?.({ success: false, message: 'Not allowed' });
        }

        if (message.isDeleted) {
          return callback?.({ success: false, message: 'Cannot react to a deleted message' });
        }

        if (!emoji) {
          return callback?.({ success: false, message: 'Emoji is required' });
        }

        const existingIndex = message.reactions.findIndex(
          (r) => r.user.toString() === userId
        );

        if (existingIndex !== -1) {
          if (message.reactions[existingIndex].emoji === emoji) {
            message.reactions.splice(existingIndex, 1);
          } else {
            message.reactions[existingIndex].emoji = emoji;
          }
        } else {
          message.reactions.push({ user: userId, emoji });
        }

        await message.save();

        conversation.members.forEach((memberId) => {
          io.to(memberId.toString()).emit('messageReacted', {
            messageId: message._id,
            conversationId: message.conversationId,
            reactions: message.reactions,
          });
        });

        callback?.({ success: true });
      } catch (error) {
        console.log('reactToMessage error:', error.message);
        callback?.({ success: false, message: 'Server error' });
      }
    });

    // handle disconnect
    socket.on('disconnect', async () => {
      console.log('User Disconnected', userId);

      onlineUsers[userId] -= 1;
      if (onlineUsers[userId] === 0) {
        delete onlineUsers[userId];
        try {
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, { lastSeen });
          io.emit('userLastSeen', { userId, lastSeen });
        } catch (error) {
          console.log('lastSeen update error:', error.message);
        }
      }
      io.emit('onlineUsers', Object.keys(onlineUsers));
    });
  });
};

export default initSocket;
