// ============================================================================
// Auth Middleware
// Protects routes by verifying JWT tokens in the Authorization header
// ============================================================================

import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Middleware to verify JWT token and attach user to request object
export const protect = async (req, res, next) => {
  try {
    let token;

    // Check if Authorization header exists and follows "Bearer <token>" format
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      // Extract token from string: "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];
    }

    // If no token is provided in the headers
    if (!token) {
      return res.status(401).json({
        message: 'Not authorized, no token provided',
      });
    }

    // Verify the token using secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user by decoded ID, excluding the password field
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        message: 'Not authorized, user not found',
      });
    }

    // Attach user to request object so downstream routes can access it
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    return res.status(401).json({
      message: 'Not authorized, invalid or expired token',
    });
  }
};
