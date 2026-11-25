// ============================================================================
// Conversation Controller
// Manages creating 1-to-1 conversations, group chats, and retrieving chat lists
// ============================================================================

import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { isValidAvatar } from '../utils/avatarCheck.js';

// Create a system message and update conversation lastMessage
const createSystemMessage = async (conversation, actorId, text) => {
  const memberIds = conversation.members.map((member) => member._id || member);
  const systemMessage = await Message.create({
    conversationId: conversation._id,
    sender: actorId,
    text,
    isSystem: true,
    readBy: memberIds,
    deliveredTo: memberIds,
  });
  conversation.lastMessage = systemMessage._id;
  await conversation.save();
  return await systemMessage.populate('sender', 'name');
};

// Send a socket event to a list of user rooms
const emitToUsers = (io, userIds, eventName, data) => {
  userIds.forEach((id) => io.to(id.toString()).emit(eventName, data));
};

// Populate members and lastMessage on a conversation
const populateConversation = (conversation) =>
  conversation.populate([
    { path: 'members', select: 'name email avatar lastSeen' },
    { path: 'lastMessage', populate: { path: 'sender', select: 'name' } },
  ]);

// Validate group exists, user is a member, and user is an admin
const getAdminGroup = async (req, res) => {
  const myId = req.user._id.toString();
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) {
    res.status(404).json({ message: 'Conversation not found' });
    return null;
  }
  if (!conversation.isGroup) {
    res.status(400).json({ message: 'This action is only for group chats' });
    return null;
  }
  const isMember = conversation.members.some((id) => id.toString() === myId);
  if (!isMember) {
    res.status(403).json({ message: 'Access denied: You are not a member' });
    return null;
  }
  const isAdmin = (conversation.admins || []).some((id) => id.toString() === myId);
  if (!isAdmin) {
    res.status(403).json({ message: 'Only admins can do this' });
    return null;
  }
  return conversation;
};

// --- Create or Get 1-to-1 Conversation ---
// Route: POST /api/conversations
// Body: { userId } - The ID of the other user
export const createOrGetConversation = async (req, res) => {
  try {
    const { userId } = req.body;

    // Check if other user ID was provided
    if (!userId) {
      return res.status(400).json({
        message: 'userId is required to start a conversation',
      });
    }

    const currentUserId = req.user._id;

    // Prevent creating a conversation with oneself
    if (userId.toString() === currentUserId.toString()) {
      return res.status(400).json({
        message: 'Cannot create a conversation with yourself',
      });
    }

    // 1. Look for an existing 1-to-1 conversation containing BOTH users
    let conversation = await Conversation.findOne({
      isGroup: false,
      members: { $all: [currentUserId, userId], $size: 2 },
    })
      .populate('members', 'name email avatar lastSeen')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name',
        },
      });

    // 2. If already exists, return it
    if (conversation) {
      const convoObject = conversation.toObject();
      convoObject.unreadCount = 0;
      return res.status(200).json(convoObject);
    }

    // 3. Otherwise, create a new 1-to-1 conversation
    conversation = await Conversation.create({
      isGroup: false,
      members: [currentUserId, userId],
    });

    // Populate user member details (without passwords)
    conversation = await conversation.populate('members', 'name email avatar lastSeen');

    const convoObject = conversation.toObject();
    convoObject.unreadCount = 0;

    return res.status(201).json(convoObject);
  } catch (error) {
    console.error('Error creating or getting conversation:', error.message);
    return res.status(500).json({
      message: 'Server error while processing conversation',
    });
  }
};

// --- Create Group Conversation ---
// Route: POST /api/conversations/group
// Body: { name, memberIds } - Group name and array of other user IDs (minimum 2 other members)
export const createGroup = async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    const currentUserId = req.user._id.toString();

    // 1. Validate group name
    if (!name || !name.trim()) {
      return res.status(400).json({
        message: 'Group name is required',
      });
    }

    // 2. Validate memberIds: must have at least 2 other members (3+ including current user)
    if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 2) {
      return res.status(400).json({
        message: 'A group chat requires at least 2 other members',
      });
    }

    // 3. Combine current user with other member IDs and remove duplicates
    const allMemberIds = Array.from(
      new Set([...memberIds.map((id) => id.toString()), currentUserId])
    );

    // Double check that there are at least 3 distinct participants
    if (allMemberIds.length < 3) {
      return res.status(400).json({
        message: 'A group chat requires at least 2 other distinct members',
      });
    }

    // 4. Create the group conversation with creator as admin
    let groupConversation = await Conversation.create({
      isGroup: true,
      name: name.trim(),
      members: allMemberIds,
      admins: [currentUserId],
    });

    // 5. Create initial system message and populate members + lastMessage
    await createSystemMessage(
      groupConversation,
      currentUserId,
      `${req.user.name} created the group`
    );
    await populateConversation(groupConversation);

    const groupObject = groupConversation.toObject();
    groupObject.unreadCount = 0;

    // 6. Real-time notification: emit "newConversation" to every member's personal room EXCEPT creator
    const io = req.app.get('io');
    if (io) {
      const otherMemberIds = allMemberIds.filter((id) => id !== currentUserId);
      emitToUsers(io, otherMemberIds, 'newConversation', groupObject);
    }

    return res.status(201).json(groupObject);
  } catch (error) {
    console.error('Error creating group conversation:', error.message);
    return res.status(500).json({
      message: 'Server error while creating group conversation',
    });
  }
};

// --- Get My Conversations ---
// Route: GET /api/conversations
// Returns all conversations where the logged-in user is a member, newest first,
// with calculated unreadCount for each conversation.
export const getMyConversations = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // 1. Find all conversations containing current user
    const conversations = await Conversation.find({
      members: currentUserId,
    })
      .populate('members', 'name email avatar lastSeen')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'name',
        },
      })
      .sort({ updatedAt: -1 });

    // 2. Count unread messages for each conversation using a simple loop
    const conversationsWithUnread = [];
    for (const conversation of conversations) {
      // Check if current user deleted this chat
      const myDelete = conversation.deletedBy?.find(
        (d) => d.user.toString() === currentUserId.toString()
      );

      // Skip deleted chat unless a newer message arrived after deletion
      if (
        myDelete &&
        (!conversation.lastMessage ||
          new Date(conversation.lastMessage.createdAt) <= new Date(myDelete.deletedAt))
      ) {
        continue;
      }

      // Unread messages = messages in this conversation where readBy does not contain me
      const unreadQuery = {
        conversationId: conversation._id,
        readBy: { $ne: currentUserId },
      };
      if (myDelete) {
        unreadQuery.createdAt = { $gt: myDelete.deletedAt };
      }
      const unreadCount = await Message.countDocuments(unreadQuery);

      // Convert Mongoose document to plain JavaScript object and attach unread, pin, and mute flags
      const conversationObject = conversation.toObject();
      conversationObject.unreadCount = unreadCount;
      conversationObject.isPinned = (conversation.pinnedBy || []).some(
        (id) => id.toString() === currentUserId.toString()
      );
      conversationObject.isMuted = (conversation.mutedBy || []).some(
        (id) => id.toString() === currentUserId.toString()
      );
      delete conversationObject.pinnedBy;
      delete conversationObject.mutedBy;
      conversationsWithUnread.push(conversationObject);
    }

    return res.status(200).json(conversationsWithUnread);
  } catch (error) {
    console.error('Error fetching conversations:', error.message);
    return res.status(500).json({
      message: 'Server error while fetching conversations',
    });
  }
};

// Delete 1-to-1 conversation for current user only
export const deleteConversation = async (req, res) => {
  try {
    const myId = req.user._id;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isMember = conversation.members.some(
      (id) => id.toString() === myId.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied: You are not a member' });
    }

    if (conversation.isGroup) {
      return res.status(400).json({
        message: 'Groups cannot be deleted, leave the group instead',
      });
    }

    // Update existing deletion timestamp or add a new entry
    const existing = conversation.deletedBy.find(
      (d) => d.user.toString() === myId.toString()
    );
    if (existing) {
      existing.deletedAt = new Date();
    } else {
      conversation.deletedBy.push({ user: myId, deletedAt: new Date() });
    }

    // Remove user from pinnedBy and mutedBy as well
    conversation.pinnedBy = (conversation.pinnedBy || []).filter(
      (id) => id.toString() !== myId.toString()
    );
    conversation.mutedBy = (conversation.mutedBy || []).filter(
      (id) => id.toString() !== myId.toString()
    );
    conversation.markModified('pinnedBy');
    conversation.markModified('mutedBy');

    await conversation.save();
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error.message);
    return res.status(500).json({ message: 'Server error while deleting conversation' });
  }
};

// Leave a group conversation
export const leaveGroup = async (req, res) => {
  try {
    const myId = req.user._id;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isMember = conversation.members.some(
      (id) => id.toString() === myId.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied: You are not a member' });
    }

    if (!conversation.isGroup) {
      return res.status(400).json({ message: 'Only group conversations can be left' });
    }

    // Remove current user from members, admins, pinnedBy, and mutedBy
    conversation.members = conversation.members.filter(
      (id) => id.toString() !== myId.toString()
    );
    conversation.admins = (conversation.admins || []).filter(
      (id) => id.toString() !== myId.toString()
    );
    conversation.pinnedBy = (conversation.pinnedBy || []).filter(
      (id) => id.toString() !== myId.toString()
    );
    conversation.mutedBy = (conversation.mutedBy || []).filter(
      (id) => id.toString() !== myId.toString()
    );
    conversation.markModified('members');
    conversation.markModified('admins');
    conversation.markModified('pinnedBy');
    conversation.markModified('mutedBy');

    // Clean up empty group or promote first member and notify remaining members
    if (conversation.members.length === 0) {
      await conversation.save();
      await Message.deleteMany({ conversationId: conversation._id });
      await Conversation.findByIdAndDelete(conversation._id);
    } else {
      if (conversation.admins.length === 0) {
        conversation.admins = [conversation.members[0]];
        conversation.markModified('admins');
      }
      const sysMsg = await createSystemMessage(
        conversation,
        myId,
        `${req.user.name} left`
      );
      const freshConvo = await Conversation.findById(conversation._id)
        .populate('members', 'name email avatar lastSeen')
        .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name' } });
      const convoObj = freshConvo.toObject();

      const io = req.app.get('io');
      if (io) {
        const remainingIds = freshConvo.members.map((m) => m._id || m);
        emitToUsers(io, remainingIds, 'conversationUpdated', convoObj);
        emitToUsers(io, remainingIds, 'newMessage', sysMsg);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error leaving group:', error.message);
    return res.status(500).json({ message: 'Server error while leaving group' });
  }
};

// Rename a group (admin only)
export const renameGroup = async (req, res) => {
  try {
    const conversation = await getAdminGroup(req, res);
    if (!conversation) return;

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    conversation.name = name.trim();
    const sysMsg = await createSystemMessage(
      conversation,
      req.user._id,
      `${req.user.name} renamed the group to "${conversation.name}"`
    );
    await populateConversation(conversation);
    const convoObj = conversation.toObject();

    const io = req.app.get('io');
    if (io) {
      const allIds = conversation.members.map((m) => m._id || m);
      emitToUsers(io, allIds, 'conversationUpdated', convoObj);
      emitToUsers(io, allIds, 'newMessage', sysMsg);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error renaming group:', error.message);
    return res.status(500).json({ message: 'Server error while renaming group' });
  }
};

// Add new members to a group (admin only)
export const addMembers = async (req, res) => {
  try {
    const conversation = await getAdminGroup(req, res);
    if (!conversation) return;

    const { memberIds } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: 'At least one new member is required' });
    }

    const existingSet = new Set(conversation.members.map((id) => id.toString()));
    const oldMemberIds = [...existingSet];
    const candidateIds = Array.from(
      new Set(
        memberIds
          .map((id) => id?.toString())
          .filter((id) => id && mongoose.Types.ObjectId.isValid(id) && !existingSet.has(id))
      )
    );

    if (candidateIds.length === 0) {
      return res.status(400).json({ message: 'At least one new member is required' });
    }

    const newUsers = await User.find({ _id: { $in: candidateIds } }).select('name');
    if (newUsers.length === 0) {
      return res.status(400).json({ message: 'No valid new members found' });
    }

    const newIds = newUsers.map((u) => u._id);
    conversation.members.push(...newIds);

    // Mark existing messages as read and delivered for newly added members
    await Message.updateMany(
      { conversationId: conversation._id },
      { $addToSet: { readBy: { $each: newIds }, deliveredTo: { $each: newIds } } }
    );

    const addedNames = newUsers.map((u) => u.name).join(', ');
    const sysMsg = await createSystemMessage(
      conversation,
      req.user._id,
      `${req.user.name} added ${addedNames}`
    );
    await populateConversation(conversation);
    const convoObj = conversation.toObject();

    const io = req.app.get('io');
    if (io) {
      emitToUsers(io, newIds, 'newConversation', { ...convoObj, unreadCount: 0 });
      emitToUsers(io, oldMemberIds, 'conversationUpdated', convoObj);
      emitToUsers(io, oldMemberIds, 'newMessage', sysMsg);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error adding members:', error.message);
    return res.status(500).json({ message: 'Server error while adding members' });
  }
};

// Remove a member from a group (admin only)
export const removeMember = async (req, res) => {
  try {
    const conversation = await getAdminGroup(req, res);
    if (!conversation) return;

    const targetUserId = req.params.userId;
    if (targetUserId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot remove yourself, leave the group instead' });
    }

    const isTargetMember = conversation.members.some(
      (id) => id.toString() === targetUserId.toString()
    );
    if (!isTargetMember) {
      return res.status(404).json({ message: 'User is not a member of this group' });
    }

    const targetUser = await User.findById(targetUserId).select('name');
    const targetName = targetUser?.name || 'Member';

    conversation.members = conversation.members.filter(
      (id) => id.toString() !== targetUserId.toString()
    );
    conversation.admins = (conversation.admins || []).filter(
      (id) => id.toString() !== targetUserId.toString()
    );

    const sysMsg = await createSystemMessage(
      conversation,
      req.user._id,
      `${req.user.name} removed ${targetName}`
    );
    await populateConversation(conversation);
    const convoObj = conversation.toObject();

    const io = req.app.get('io');
    if (io) {
      const remainingIds = conversation.members.map((m) => m._id || m);
      emitToUsers(io, remainingIds, 'conversationUpdated', convoObj);
      emitToUsers(io, remainingIds, 'newMessage', sysMsg);
      io.to(targetUserId.toString()).emit('removedFromGroup', {
        conversationId: conversation._id,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error removing member:', error.message);
    return res.status(500).json({ message: 'Server error while removing member' });
  }
};

// Promote a group member to admin (admin only)
export const makeAdmin = async (req, res) => {
  try {
    const conversation = await getAdminGroup(req, res);
    if (!conversation) return;

    const targetUserId = req.params.userId;
    const isTargetMember = conversation.members.some(
      (id) => id.toString() === targetUserId.toString()
    );
    if (!isTargetMember) {
      return res.status(404).json({ message: 'User is not a member of this group' });
    }

    const alreadyAdmin = (conversation.admins || []).some(
      (id) => id.toString() === targetUserId.toString()
    );
    if (alreadyAdmin) {
      return res.status(400).json({ message: 'User is already an admin' });
    }

    conversation.admins.push(targetUserId);
    const targetUser = await User.findById(targetUserId).select('name');
    const targetName = targetUser?.name || 'Member';

    const sysMsg = await createSystemMessage(
      conversation,
      req.user._id,
      `${req.user.name} made ${targetName} an admin`
    );
    await populateConversation(conversation);
    const convoObj = conversation.toObject();

    const io = req.app.get('io');
    if (io) {
      const allIds = conversation.members.map((m) => m._id || m);
      emitToUsers(io, allIds, 'conversationUpdated', convoObj);
      emitToUsers(io, allIds, 'newMessage', sysMsg);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error making admin:', error.message);
    return res.status(500).json({ message: 'Server error while updating admin' });
  }
};

// Pin or unpin a conversation for current user without updating timestamps
export const togglePin = async (req, res) => {
  try {
    const myId = req.user._id;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isMember = conversation.members.some(
      (id) => id.toString() === myId.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied: You are not a member' });
    }

    const currentlyPinned = (conversation.pinnedBy || []).some(
      (id) => id.toString() === myId.toString()
    );

    if (currentlyPinned) {
      await Conversation.updateOne(
        { _id: conversation._id },
        { $pull: { pinnedBy: myId } },
        { timestamps: false }
      );
      return res.status(200).json({ success: true, isPinned: false });
    }

    const pinnedCount = await Conversation.countDocuments({ pinnedBy: myId });
    if (pinnedCount >= 3) {
      return res.status(400).json({ message: 'You can pin up to 3 chats' });
    }

    await Conversation.updateOne(
      { _id: conversation._id },
      { $addToSet: { pinnedBy: myId } },
      { timestamps: false }
    );
    return res.status(200).json({ success: true, isPinned: true });
  } catch (error) {
    console.error('Error toggling pin:', error.message);
    return res.status(500).json({ message: 'Server error while toggling pin' });
  }
};

// Mute or unmute a conversation for current user without updating timestamps
export const toggleMute = async (req, res) => {
  try {
    const myId = req.user._id;
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const isMember = conversation.members.some(
      (id) => id.toString() === myId.toString()
    );
    if (!isMember) {
      return res.status(403).json({ message: 'Access denied: You are not a member' });
    }

    const currentlyMuted = (conversation.mutedBy || []).some(
      (id) => id.toString() === myId.toString()
    );

    if (currentlyMuted) {
      await Conversation.updateOne(
        { _id: conversation._id },
        { $pull: { mutedBy: myId } },
        { timestamps: false }
      );
      return res.status(200).json({ success: true, isMuted: false });
    }

    await Conversation.updateOne(
      { _id: conversation._id },
      { $addToSet: { mutedBy: myId } },
      { timestamps: false }
    );
    return res.status(200).json({ success: true, isMuted: true });
  } catch (error) {
    console.error('Error toggling mute:', error.message);
    return res.status(500).json({ message: 'Server error while toggling mute' });
  }
};

// Change or remove group avatar (admin only)
export const changeGroupAvatar = async (req, res) => {
  try {
    const conversation = await getAdminGroup(req, res);
    if (!conversation) return;

    const { avatar } = req.body;
    if (!isValidAvatar(avatar)) {
      return res.status(400).json({ message: 'Invalid image' });
    }

    conversation.avatar = avatar;
    const text =
      avatar === ''
        ? `${req.user.name} removed the group photo`
        : `${req.user.name} changed the group photo`;
    const sysMsg = await createSystemMessage(conversation, req.user._id, text);
    await populateConversation(conversation);
    const convoObj = conversation.toObject();

    const io = req.app.get('io');
    if (io) {
      const allIds = conversation.members.map((m) => m._id || m);
      emitToUsers(io, allIds, 'conversationUpdated', convoObj);
      emitToUsers(io, allIds, 'newMessage', sysMsg);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error changing group avatar:', error.message);
    return res.status(500).json({ message: 'Server error while updating group photo' });
  }
};
