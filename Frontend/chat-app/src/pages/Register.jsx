import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import api from '../api/api';
import './Register.css';

/**
 * Register Page Component
 * Allows new users to create an account for the chat app.
 */
function Register() {
  const navigate = useNavigate();

  // --- Form State ---
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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

    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      currentErrors.name = 'Full name is required';
    }

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

    // Validate phone (must be 10 digits)
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      currentErrors.phone = 'Phone number is required';
    } else {
      const phoneDigitsPattern = /^\d{10}$/;
      if (!phoneDigitsPattern.test(trimmedPhone)) {
        currentErrors.phone = 'Phone number must be exactly 10 digits';
      }
    }

    // Validate password (min 6 characters)
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
      // Send registration request to backend
      const response = await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
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
        error.response?.data?.message || 'Registration failed. Please try again.';
      setServerError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-card">
        {/* Header section: Logo, App title, and welcome text */}
        <div className="register-header">
          <div className="auth-logo-wrap">
            <img src="/logo.webp" alt="Chat App Logo" className="register-logo" />
          </div>
          <h2 className="register-app-title">Chat App</h2>
          <h1 className="register-heading">Create your account</h1>
          <p className="register-subheading">Start chatting with friends today</p>
        </div>

        {/* Registration form */}
        <form className="register-form" onSubmit={handleSubmit} noValidate>
          {/* Full Name field */}
          <div className="register-field-group">
            <label htmlFor="register-name" className="register-label">
              Full Name
            </label>
            <input
              id="register-name"
              type="text"
              className={`register-input ${errors.name ? 'input-error' : ''}`}
              placeholder="e.g. Alex Johnson"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) {
                  setErrors({ ...errors, name: '' });
                }
              }}
            />
            {errors.name && (
              <span className="register-error-message">{errors.name}</span>
            )}
          </div>

          {/* Email field */}
          <div className="register-field-group">
            <label htmlFor="register-email" className="register-label">
              Email Address
            </label>
            <input
              id="register-email"
              type="email"
              className={`register-input ${errors.email ? 'input-error' : ''}`}
              placeholder="e.g. alex@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) {
                  setErrors({ ...errors, email: '' });
                }
              }}
            />
            {errors.email && (
              <span className="register-error-message">{errors.email}</span>
            )}
          </div>

          {/* Phone Number field */}
          <div className="register-field-group">
            <label htmlFor="register-phone" className="register-label">
              Phone Number
            </label>
            <input
              id="register-phone"
              type="tel"
              maxLength="10"
              className={`register-input ${errors.phone ? 'input-error' : ''}`}
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => {
                const numericOnly = e.target.value.replace(/\D/g, '');
                setPhone(numericOnly);
                if (errors.phone) {
                  setErrors({ ...errors, phone: '' });
                }
              }}
            />
            {errors.phone && (
              <span className="register-error-message">{errors.phone}</span>
            )}
          </div>

          {/* Password field with show/hide toggle */}
          <div className="register-field-group">
            <label htmlFor="register-password" className="register-label">
              Password
            </label>
            <div className="password-input-container">
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                className={`register-input ${errors.password ? 'input-error' : ''}`}
                placeholder="At least 6 characters"
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
              <span className="register-error-message">{errors.password}</span>
            )}
          </div>

          {/* Backend server error banner */}
          {serverError && (
            <div className="server-error-banner">{serverError}</div>
          )}

          {/* Submit button with loading state */}
          <button
            type="submit"
            className="register-submit-btn"
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        {/* Footer link to Login page */}
        <div className="register-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="register-link">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
