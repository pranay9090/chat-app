// ============================================================================
// Auth Controller
// Handles user registration, login, and profile fetching
// ============================================================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// --- Helper Function ---
// Generates a JSON Web Token (JWT) valid for 7 days
const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing from your .env file');
  }
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

// --- Register Controller ---
// Route: POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};

    // 1. Check if all required fields are provided
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        message: 'Please provide all fields: name, email, phone, and password',
      });
    }

    // Clean inputs
    const formattedEmail = email.toLowerCase().trim();
    const formattedPhone = phone.trim();

    // 2. Check if email is already registered
    const existingEmailUser = await User.findOne({ email: formattedEmail });
    if (existingEmailUser) {
      return res.status(409).json({
        message: 'A user with this email already exists',
      });
    }

    // 3. Check if phone is already registered
    const existingPhoneUser = await User.findOne({ phone: formattedPhone });
    if (existingPhoneUser) {
      return res.status(409).json({
        message: 'A user with this phone number already exists',
      });
    }

    // 4. Hash the password before saving
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. Create and save the new user
    const newUser = await User.create({
      name: name.trim(),
      email: formattedEmail,
      phone: formattedPhone,
      password: hashedPassword,
    });

    // 6. Generate authentication token
    const token = generateToken(newUser._id);

    // 7. Return user data (WITHOUT password) and the token
    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        avatar: newUser.avatar,
        createdAt: newUser.createdAt,
      },
      token: token,
    });
  } catch (error) {
    console.error('Registration error:', error.message);
    return res.status(500).json({
      message: 'Server error occurred during registration',
    });
  }
};

// --- Login Controller ---
// Route: POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // 1. Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        message: 'Please provide both email and password',
      });
    }

    const formattedEmail = email.toLowerCase().trim();

    // 2. Find user by email
    const user = await User.findOne({ email: formattedEmail });
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password',
      });
    }

    // 3. Compare submitted password with hashed password in database
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        message: 'Invalid email or password',
      });
    }

    // 4. Generate authentication token
    const token = generateToken(user._id);

    // 5. Return user data (WITHOUT password) and the token
    return res.status(200).json({
      message: 'Login successful',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      token: token,
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      message: 'Server error occurred during login',
    });
  }
};

// --- Get Me Controller ---
// Route: GET /api/auth/me (Protected)
export const getMe = async (req, res) => {
  try {
    // req.user is set by the authMiddleware protect function
    return res.status(200).json({
      user: req.user,
    });
  } catch (error) {
    console.error('Get profile error:', error.message);
    return res.status(500).json({
      message: 'Server error fetching user profile',
    });
  }
};
