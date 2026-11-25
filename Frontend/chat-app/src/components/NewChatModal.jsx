import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import api from '../api/api';
import Avatar from './Avatar';
import './NewChatModal.css';

// Searchable modal listing users to start a 1-to-1 chat
function NewChatModal({ isOpen, onClose, onSelectConversation, onNotify }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);

  // Fetch users with 300ms debounce
  useEffect(() => {
    if (!isOpen) return;

    const debounceTimer = setTimeout(async () => {
      setLoading(true);
      try {
        const trimmed = searchTerm.trim();
        const response = await api.get('/users', {
          params: trimmed ? { search: trimmed } : {},
        });

        const list = Array.isArray(response.data)
          ? response.data
          : response.data?.users || [];

        setUsers(list);
      } catch (error) {
        onNotify?.(error.response?.data?.message || 'Failed to load users');
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, isOpen, onNotify]);

  // Create or open 1-to-1 conversation for clicked user
  const handleUserClick = async (user) => {
    if (creatingChat) return;

    try {
      setCreatingChat(true);
      const response = await api.post('/conversations', { userId: user._id });
      onSelectConversation(response.data);
      onClose();
    } catch (error) {
      onNotify?.(error.response?.data?.message || 'Failed to start conversation');
    } finally {
      setCreatingChat(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="New Conversation"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">New Conversation</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="new-chat-search-wrap">
          <div className="modal-search-field">
            <Search size={16} strokeWidth={1.75} className="modal-search-icon" />
            <input
              type="text"
              className="modal-input modal-search-input"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="new-chat-user-list">
          {loading ? (
            <div className="new-chat-status">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="new-chat-status">No users found</div>
          ) : (
            users.map((user) => (
              <button
                key={user._id}
                type="button"
                className="new-chat-user-item"
                onClick={() => handleUserClick(user)}
              >
                <Avatar
                  name={user.name}
                  src={user.avatar}
                  seed={user._id || user.name}
                  size={40}
                />
                <div className="new-chat-user-info">
                  <span className="new-chat-user-name">{user.name}</span>
                  <span className="new-chat-user-email">{user.email}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default NewChatModal;
