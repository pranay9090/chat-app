import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import api from '../api/api';
import './Login.css';

/**
 * Login Page Component
 * Allows existing users to sign into their chat account.
 */
function Login() {
  const navigate = useNavigate();

  // --- Form State ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Control visibility of password text
  const [showPassword, setShowPassword] = useState(false);

  // Store client-side field validation errors
  const [errors, setErrors] = useState({});

  // Store backend response error message
  const [serverError, setServerError] = useState('');

  // Loading state during API request
  const [loading, setLoading] = useState(false);

  // --- Validation Logic ---
  const validateForm = () => {
    const currentErrors = {};

    // Validate email
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      currentErrors.email = 'Email is required';
    } else {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(trimmedEmail)) {
        currentErrors.email = 'Please enter a valid email address';
      }
    }

    // Validate password
    if (!password) {
      currentErrors.password = 'Password is required';
    } else if (password.length < 6) {
      currentErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(currentErrors);
    return Object.keys(currentErrors).length === 0;
  };

  // --- Form Submit Handler ---
  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');

    // If client validation fails, don't make backend call
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Send login request to backend
      const response = await api.post('/auth/login', {
        email: email.trim(),
        password: password,
      });

      // Save token and user information to localStorage
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      // Redirect to home page
      navigate('/home');
    } catch (error) {
      // Capture error message from server response or fallback to generic message
      const errorMessage =
        error.response?.data?.message || 'Login failed. Please check your credentials.';
      setServerError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Header section: Logo, App title, and welcome text */}
        <div className="login-header">
          <div className="auth-logo-wrap">
            <img src="/logo.webp" alt="Chat App Logo" className="login-logo" />
          </div>
          <h2 className="login-app-title">Chat App</h2>
          <h1 className="login-heading">Login to your account</h1>
          <p className="login-subheading">Welcome back!</p>
        </div>

        {/* Login form */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {/* Email field */}
          <div className="login-field-group">
            <label htmlFor="login-email" className="login-label">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className={`login-input ${errors.email ? 'input-error' : ''}`}
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors({ ...errors, email: '' });
                }
              }}
            />
            {errors.email && (
              <span className="login-error-message">{errors.email}</span>
            )}
          </div>

          {/* Password field with show/hide toggle */}
          <div className="login-field-group">
            <label htmlFor="login-password" className="login-label">
              Password
            </label>
            <div className="password-input-container">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className={`login-input ${errors.password ? 'input-error' : ''}`}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) {
                    setErrors({ ...errors, password: '' });
                  }
                }}
              />
              <button
                type="button"
                className="password-toggle-button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
              </button>
            </div>
            {errors.password && (
              <span className="login-error-message">{errors.password}</span>
            )}
          </div>

          {/* Backend server error banner */}
          {serverError && (
            <div className="server-error-banner">{serverError}</div>
          )}

          {/* Submit button with loading state */}
          <button
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Footer link to Register page */}
        <div className="login-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/register" className="login-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
