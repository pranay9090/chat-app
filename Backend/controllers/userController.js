// ============================================================================
// User Controller
// Handles fetching user lists for chatting
// ============================================================================

import mongoose from 'mongoose';
import User from '../models/User.js';
import { isValidAvatar } from '../utils/avatarCheck.js';

// --- Get All Users ---
// Route: GET /api/users
// Returns all users EXCEPT the currently logged-in user, newest first.
// If ?search=text is provided, filters by name or email (case-insensitive).
export const getAllUsers = async (req, res) => {
  try {
    const { search } = req.query;

    // Filter to exclude current logged-in user (from protect middleware)
    const query = {
      _id: { $ne: req.user._id },
    };

    // If search term is present, perform case-insensitive regex search
    if (search && search.trim() !== '') {
      const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = new RegExp(escapeRegex(search.trim()), "i");
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
      ];
    }

    // Fetch users excluding passwords and sort newest first
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error.message);
    return res.status(500).json({
      message: 'Server error while fetching users',
    });
  }
};

// Get a user's public profile by id
export const getUserById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'User not found' });
    }
    const user = await User.findById(req.params.id).select(
      'name email phone avatar lastSeen'
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error.message);
    return res.status(500).json({ message: 'Server error while fetching user' });
  }
};

// Update logged-in user's display name
export const updateMyName = async (req, res) => {
  try {
    const trimmed = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!trimmed || trimmed.length > 40) {
      return res.status(400).json({ message: 'Name must be between 1 and 40 characters' });
    }

    req.user.name = trimmed;
    await req.user.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('userUpdated', {
        userId: req.user._id,
        name: req.user.name,
        avatar: req.user.avatar,
      });
    }

    return res.status(200).json(req.user);
  } catch (error) {
    console.error('Error updating name:', error.message);
    return res.status(500).json({ message: 'Server error while updating name' });
  }
};

// Update logged-in user's avatar photo
export const updateMyAvatar = async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!isValidAvatar(avatar)) {
      return res.status(400).json({ message: 'Invalid image' });
    }

    req.user.avatar = avatar;
    await req.user.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('userUpdated', {
        userId: req.user._id,
        name: req.user.name,
        avatar: req.user.avatar,
      });
    }

    return res.status(200).json(req.user);
  } catch (error) {
    console.error('Error updating avatar:', error.message);
    return res.status(500).json({ message: 'Server error while updating avatar' });
  }
};
