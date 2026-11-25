// Message routes
import express from 'express';
import { getMessages, searchMessages } from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Search messages inside a conversation
router.get('/:conversationId/search', protect, searchMessages);

// GET /api/messages/:conversationId
router.get('/:conversationId', protect, getMessages);

export default router;
