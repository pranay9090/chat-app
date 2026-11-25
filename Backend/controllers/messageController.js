// Message controller
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';

// get message history for a conversation
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user._id;

    // check conversation exists and user is a member
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isMember = conversation.members.some(
      (memberId) => memberId.toString() === currentUserId.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Access denied: You are not a member' });
    }

    // filter by deletedAt and optional before cursor for pagination
    const query = { conversationId };
    const createdAtFilter = {};
    const myDelete = conversation.deletedBy?.find(
      (d) => d.user.toString() === currentUserId.toString()
    );
    if (myDelete) {
      createdAtFilter.$gt = myDelete.deletedAt;
    }
    if (req.query.before) {
      const beforeDate = new Date(req.query.before);
      if (!isNaN(beforeDate.getTime())) {
        createdAtFilter.$lt = beforeDate;
      }
    }
    if (Object.keys(createdAtFilter).length > 0) {
      query.createdAt = createdAtFilter;
    }

    // fetch latest 30 messages newest-first, then reverse to oldest-first
    const messages = await Message.find(query)
      .populate('sender', 'name')
      .populate({
        path: 'replyTo',
        select: 'text sender isDeleted',
        populate: { path: 'sender', select: 'name' },
      })
      .sort({ createdAt: -1 })
      .limit(30);

    messages.reverse();

    return res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error.message);
    return res.status(500).json({ message: 'Server error while fetching messages' });
  }
};

// Escape special regex characters
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// search message history inside a conversation
export const searchMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const currentUserId = req.user._id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isMember = conversation.members.some(
      (memberId) => memberId.toString() === currentUserId.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied: You are not a member' });
    }

    const q = (req.query.q || '').trim();
    if (q.length < 2) {
      return res.status(200).json([]);
    }

    const query = {
      conversationId,
      isDeleted: { $ne: true },
      isSystem: { $ne: true },
      text: { $regex: escapeRegex(q), $options: 'i' },
    };

    const myDelete = conversation.deletedBy?.find(
      (d) => d.user.toString() === currentUserId.toString()
    );
    if (myDelete) {
      query.createdAt = { $gt: myDelete.deletedAt };
    }

    const results = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('sender', 'name');

    return res.status(200).json(results);
  } catch (error) {
    console.error('Error searching messages:', error.message);
    return res.status(500).json({ message: 'Server error while searching messages' });
  }
};
