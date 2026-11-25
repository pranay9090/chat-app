// ============================================================================
// Auth Routes
// Endpoints for authentication and user profile
// ============================================================================

import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes: user registration and login
router.post('/register', register);
router.post('/login', login);

// Protected route: get current logged in user details
router.get('/me', protect, getMe);

export default router;
