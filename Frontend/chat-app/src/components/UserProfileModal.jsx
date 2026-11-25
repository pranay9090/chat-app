import { useState, useEffect, useRef } from 'react';
import { X, Phone, Mail, Copy, Check, MessageSquare, Bell, BellOff } from 'lucide-react';
import api from '../api/api';
import Avatar from './Avatar';
import { formatLastSeen } from '../utils/chatHelpers';
import './UserProfileModal.css';

// Modal showing another user's public profile, contact info, and quick actions
function UserProfileModal({
  userId,
  conversation,
  onlineUserIds = [],
  lastSeenMap = {},
  isMuted = false,
  onMessage,
  onToggleMute,
  onClose,
  onNotify,
}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState('');
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const copyTimerRef = useRef(null);

  // Fetch user details when modal opens
  useEffect(() => {
    if (!userId) return;

    let active = true;
    const fetchUser = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/users/${userId}`);
        if (active) setProfile(res.data);
      } catch (error) {
        if (active) {
          onNotify?.(error.response?.data?.message || 'Something went wrong');
          onClose?.();
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchUser();
    return () => {
      active = false;
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [userId, onClose, onNotify]);

  // Close photo viewer or modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (photoViewerOpen) {
          setPhotoViewerOpen(false);
        } else {
          onClose?.();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [photoViewerOpen, onClose]);

  if (!userId) return null;

  // Copy value to clipboard and show brief check mark
  const handleCopy = (field, value) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedField(''), 1500);
  };

  const isOnline = onlineUserIds.some((id) => id?.toString() === userId.toString());
  const effectiveMuted = conversation ? Boolean(conversation.isMuted) : isMuted;

  return (
    <div
      className="modal-backdrop modal-backdrop-top"
      onClick={(e) => {
        e.stopPropagation();
        onClose?.();
      }}
    >
      <div
        className="modal-card modal-card-sm user-profile-card-pad"
        role="dialog"
        aria-modal="true"
        aria-label="User Profile"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close-btn user-profile-close-pos"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} strokeWidth={1.75} />
        </button>

        {loading || !profile ? (
          <div className="user-profile-loading">Loading...</div>
        ) : (
          <div className="user-profile-body">
            <div
              className={`profile-avatar-box ${profile.avatar ? 'clickable-photo' : ''}`}
              onClick={() => {
                if (profile.avatar) setPhotoViewerOpen(true);
              }}
            >
              <Avatar
                name={profile.name}
                src={profile.avatar}
                seed={userId || profile.name}
                size={120}
                isOnline={isOnline}
              />
            </div>

            <h3 className="user-profile-name">{profile.name}</h3>
            <span className={isOnline ? 'user-profile-online' : 'user-profile-offline'}>
              {isOnline
                ? 'Online'
                : formatLastSeen(lastSeenMap[userId] || profile.lastSeen)}
            </span>

            <div className="user-profile-info-list">
              <div className="user-profile-info-row">
                <span className="info-row-icon" aria-hidden="true">
                  <Phone size={15} strokeWidth={1.75} />
                </span>
                <span className="info-row-value">{profile.phone || '—'}</span>
                <button
                  type="button"
                  className="info-copy-btn"
                  onClick={() => handleCopy('phone', profile.phone)}
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

              <div className="user-profile-info-row">
                <span className="info-row-icon" aria-hidden="true">
                  <Mail size={15} strokeWidth={1.75} />
                </span>
                <span className="info-row-value">{profile.email || '—'}</span>
                <button
                  type="button"
                  className="info-copy-btn"
                  onClick={() => handleCopy('email', profile.email)}
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

            <div className="user-profile-actions">
              <div className="profile-action-item">
                <button
                  type="button"
                  className="profile-round-btn"
                  onClick={() => onMessage?.(userId)}
                  aria-label="Message"
                >
                  <MessageSquare size={18} strokeWidth={1.75} />
                </button>
                <span className="profile-action-label">Message</span>
              </div>

              {conversation && (
                <div className="profile-action-item">
                  <button
                    type="button"
                    className="profile-round-btn"
                    onClick={() => onToggleMute?.(conversation)}
                    aria-label={effectiveMuted ? 'Unmute' : 'Mute'}
                  >
                    {effectiveMuted ? (
                      <Bell size={18} strokeWidth={1.75} />
                    ) : (
                      <BellOff size={18} strokeWidth={1.75} />
                    )}
                  </button>
                  <span className="profile-action-label">
                    {effectiveMuted ? 'Unmute' : 'Mute'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {photoViewerOpen && profile?.avatar && (
        <div
          className="photo-viewer-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setPhotoViewerOpen(false);
          }}
        >
          <img
            src={profile.avatar}
            alt={profile.name}
            className="photo-viewer-img"
          />
        </div>
      )}
    </div>
  );
}

export default UserProfileModal;
