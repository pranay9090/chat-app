// ============================================================================
// Protected Route Component
// Protects private pages by ensuring a valid JWT token exists in localStorage
// ============================================================================

import { Navigate } from 'react-router-dom';

/**
 * ProtectedRoute Component
 * - If user has a token in localStorage, renders the children components.
 * - If no token exists, redirects the user to /login.
 */
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');

  // If no token is found, redirect to login page
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Token exists, render the protected component
  return children;
}

export default ProtectedRoute;
