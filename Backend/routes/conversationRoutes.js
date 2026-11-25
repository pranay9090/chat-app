// ============================================================================
// Conversation Routes
// Endpoints for starting 1-to-1 chats, group chats, and listing conversations
// ============================================================================

import express from 'express';
import {
  createOrGetConversation,
  createGroup,
  getMyConversations,
  deleteConversation,
  leaveGroup,
  renameGroup,
  addMembers,
  removeMember,
  makeAdmin,
  togglePin,
  toggleMute,
  changeGroupAvatar,
} from '../controllers/conversationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protected route to create a group chat (placed before root POST)
router.post('/group', protect, createGroup);

// Protected routes for 1-to-1 conversations and fetching user conversations
router.post('/', protect, createOrGetConversation);
router.get('/', protect, getMyConversations);

// Group admin and user pin/mute routes (placed before generic /:id routes)
router.put('/:id/pin', protect, togglePin);
router.put('/:id/mute', protect, toggleMute);
router.put('/:id/avatar', protect, changeGroupAvatar);
router.put('/:id/rename', protect, renameGroup);
router.put('/:id/members', protect, addMembers);
router.delete('/:id/members/:userId', protect, removeMember);
router.put('/:id/admins/:userId', protect, makeAdmin);

// Protected routes to delete a 1-to-1 chat or leave a group
router.delete('/:id', protect, deleteConversation);
router.put('/:id/leave', protect, leaveGroup);

export default router;
