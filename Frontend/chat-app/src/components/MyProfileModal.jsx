import { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Image as ImageIcon,
  Trash2,
  Pencil,
  Phone,
  Mail,
  Copy,
  Check,
} from 'lucide-react';
import api from '../api/api';
import Avatar from './Avatar';
import ConfirmModal from './ConfirmModal';
import { resizeImage } from '../utils/imageHelpers';
import './MyProfileModal.css';

// Modal for viewing and editing current user's profile
function MyProfileModal({ user, onClose, onUserChange }) {
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [copiedField, setCopiedField] = useState('');
  const fileInputRef = useRef(null);
  const copyTimerRef = useRef(null);

  // Close photo menu, warning, or modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (warningMessage) {
          setWarningMessage('');
        } else if (photoMenuOpen) {
          setPhotoMenuOpen(false);
        } else if (!showRemoveConfirm) {
          onClose?.();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [onClose, photoMenuOpen, showRemoveConfirm, warningMessage]);

  // Close photo dropdown on outside click
  useEffect(() => {
    if (!photoMenuOpen) return;
    const handleDocClick = () => setPhotoMenuOpen(false);
    document.addEventListener('click', handleDocClick, { once: true });
    return () => document.removeEventListener('click', handleDocClick);
  }, [photoMenuOpen]);

  if (!user) return null;

  // Handle photo file selection, size check, resize, and upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setWarningMessage('Image must be 5MB or smaller');
      e.target.value = '';
      return;
    }

    try {
      setSaving(true);
      const avatar = await resizeImage(file);
      const res = await api.put('/users/me/avatar', { avatar });
      onUserChange?.(res.data);
    } catch (error) {
      setWarningMessage(error.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  // Remove profile photo after modal confirmation
  const confirmRemovePhoto = async () => {
    setShowRemoveConfirm(false);
    try {
      setSaving(true);
      const res = await api.put('/users/me/avatar', { avatar: '' });
      onUserChange?.(res.data);
    } catch (error) {
      setWarningMessage(error.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  // Save updated user name
  const handleSaveName = async (e) => {
    e.preventDefault();
    if (!nameInput.trim() || saving) return;

    try {
      setSaving(true);
      const res = await api.put('/users/me', { name: nameInput.trim() });
      onUserChange?.(res.data);
      setEditingName(false);
    } catch (error) {
      setWarningMessage(error.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  // Copy value to clipboard and show brief check mark
  const handleCopy = (field, value) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedField(''), 1500);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card-profile"
        role="dialog"
        aria-modal="true"
        aria-label="My Profile"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">My Profile</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="my-profile-body">
          {/* Big avatar with camera menu button */}
          <div className="my-profile-avatar-wrap">
            <Avatar
              name={user.name}
              src={user.avatar}
              seed={user._id || user.name}
              size={120}
            />
            <button
              type="button"
              className="avatar-camera-btn"
              onClick={(e) => {
                e.stopPropagation();
                setPhotoMenuOpen((prev) => !prev);
              }}
              disabled={saving}
              title="Photo options"
              aria-label="Photo options"
            >
              <Camera size={16} strokeWidth={1.75} />
            </button>

            {photoMenuOpen && (
              <div
                className="photo-menu-dropdown"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="photo-menu-item"
                  onClick={() => {
                    setPhotoMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                >
                  <ImageIcon size={15} strokeWidth={1.75} />
                  <span>{user.avatar ? 'Change profile photo' : 'Add profile photo'}</span>
                </button>

                {user.avatar && (
                  <button
                    type="button"
                    className="photo-menu-item photo-menu-danger"
                    onClick={() => {
                      setPhotoMenuOpen(false);
                      setShowRemoveConfirm(true);
                    }}
                  >
                    <Trash2 size={15} strokeWidth={1.75} />
                    <span>Remove profile photo</span>
                  </button>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              hidden
            />
          </div>

          {saving && <span className="my-profile-saving">Saving...</span>}

          {editingName ? (
            <form className="my-profile-name-form" onSubmit={handleSaveName}>
              <input
                type="text"
                className="modal-input my-profile-name-input"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={40}
                autoFocus
              />
              <button
                type="submit"
                className="modal-btn-primary"
                disabled={!nameInput.trim() || saving}
              >
                Save
              </button>
              <button
                type="button"
                className="modal-btn-secondary"
                onClick={() => setEditingName(false)}
                disabled={saving}
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="my-profile-name-row">
              <span className="my-profile-name">{user.name}</span>
              <button
                type="button"
                className="my-profile-edit-btn"
                onClick={() => {
                  setNameInput(user.name || '');
                  setEditingName(true);
                }}
                disabled={saving}
                title="Edit name"
                aria-label="Edit name"
              >
                <Pencil size={14} strokeWidth={1.75} />
              </button>
            </div>
          )}

          <div className="my-profile-info-list">
            <div className="my-profile-info-row">
              <span className="my-info-icon" aria-hidden="true">
                <Phone size={15} strokeWidth={1.75} />
              </span>
              <span className="my-info-value">{user.phone || '—'}</span>
              <button
                type="button"
                className="my-copy-btn"
                onClick={() => handleCopy('phone', user.phone)}
                title="Copy phone"
                aria-label="Copy phone"
              >
                {copiedField === 'phone' ? (
                  <Check size={15} strokeWidth={2} />
                ) : (
                  <Copy size={15} strokeWidth={1.75} />
                )}
              </button>
            </div>

            <div className="my-profile-info-row">
              <span className="my-info-icon" aria-hidden="true">
                <Mail size={15} strokeWidth={1.75} />
              </span>
              <span className="my-info-value">{user.email || '—'}</span>
              <button
                type="button"
                className="my-copy-btn"
                onClick={() => handleCopy('email', user.email)}
                title="Copy email"
                aria-label="Copy email"
              >
                {copiedField === 'email' ? (
                  <Check size={15} strokeWidth={2} />
                ) : (
                  <Copy size={15} strokeWidth={1.75} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Remove Photo Confirmation Modal */}
      <ConfirmModal
        isOpen={showRemoveConfirm}
        title="Remove photo"
        message="Remove your profile photo?"
        confirmText="Remove"
        onCancel={() => setShowRemoveConfirm(false)}
        onConfirm={confirmRemovePhoto}
      />

      {/* Warning Popup Modal */}
      <ConfirmModal
        isOpen={Boolean(warningMessage)}
        title="Warning"
        message={warningMessage}
        confirmText="OK"
        hideCancel={true}
        variant="primary"
        onCancel={() => setWarningMessage('')}
        onConfirm={() => setWarningMessage('')}
      />
    </div>
  );
}

export default MyProfileModal;
