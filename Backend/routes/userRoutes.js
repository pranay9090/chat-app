// ============================================================================
// User Routes
// Endpoints for discovering and listing registered users
// ============================================================================

import express from 'express';
import {
  getAllUsers,
  getUserById,
  updateMyName,
  updateMyAvatar,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/users (Protected with JWT middleware)
router.get('/', protect, getAllUsers);

// Profile update and lookup routes
router.put('/me', protect, updateMyName);
router.put('/me/avatar', protect, updateMyAvatar);
router.get('/:id', protect, getUserById);

export default router;
