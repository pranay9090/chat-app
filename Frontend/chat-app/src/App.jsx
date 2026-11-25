import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import ProtectedRoute from './components/ProtectedRoute';

/**
 * PublicRoute Component
 * Redirects already authenticated users away from Login/Register to /home.
 */
function PublicRoute({ children }) {
  const token = localStorage.getItem('token');
  if (token) {
    return <Navigate to="/home" replace />;
  }
  return children;
}

/**
 * Main Application Component
 * Configures routes:
 * - /login: Public login page (redirects to /home if already logged in)
 * - /register: Public registration page (redirects to /home if already logged in)
 * - /home: Protected placeholder dashboard
 * - /: Redirects to /home (which then sends logged-out users to /login)
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root URL to /home */}
        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* Public authentication routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        {/* Protected chat home route */}
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        {/* Catch-all route: redirect unknown paths to /home */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
