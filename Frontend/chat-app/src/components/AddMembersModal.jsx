import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import api from '../api/api';
import Avatar from './Avatar';
import './AddMembersModal.css';

// Modal to search and add new members to an existing group
function AddMembersModal({ isOpen, conversation, onClose, onNotify }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  // Fetch users with 300ms debounce and exclude existing group members
  useEffect(() => {
    if (!isOpen || !conversation) return;

    const existingIds = new Set(
      (conversation.members || []).map((m) => (m?._id || m)?.toString())
    );

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

        setUsers(list.filter((u) => !existingIds.has(u._id?.toString())));
      } catch (error) {
        console.error('Error fetching users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, isOpen, conversation]);

  // Toggle user selection
  const handleToggleUser = (user) => {
    const isSelected = selectedUsers.some((u) => u._id === user._id);
    if (isSelected) {
      setSelectedUsers(selectedUsers.filter((u) => u._id !== user._id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  // Remove selected chip
  const handleRemoveChip = (userId) => {
    setSelectedUsers(selectedUsers.filter((u) => u._id !== userId));
  };

  // Submit new memberIds to server
  const handleAddMembers = async (e) => {
    e.preventDefault();
    if (selectedUsers.length === 0 || adding || !conversation?._id) return;

    try {
      setAdding(true);
      await api.put(`/conversations/${conversation._id}/members`, {
        memberIds: selectedUsers.map((u) => u._id),
      });
      onClose();
    } catch (error) {
      onNotify?.(error.response?.data?.message || 'Failed to add members');
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen || !conversation) return null;

  return (
    <div className="modal-backdrop modal-backdrop-elevated" onClick={onClose}>
      <div
        className="modal-card add-members-card-size"
        role="dialog"
        aria-modal="true"
        aria-label="Add Members"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">Add Members</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleAddMembers} className="add-members-form">
          {selectedUsers.length > 0 && (
            <div className="add-members-chips-wrapper">
              <span className="add-members-chips-heading">
                Selected ({selectedUsers.length}):
              </span>
              <div className="add-members-chips-list">
                {selectedUsers.map((user) => (
                  <span key={user._id} className="add-members-chip">
                    {user.name}
                    <button
                      type="button"
                      className="add-members-chip-remove"
                      onClick={() => handleRemoveChip(user._id)}
                      aria-label={`Remove ${user.name}`}
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="add-members-field">
            <input
              type="text"
              className="modal-input"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          <div className="add-members-user-list">
            {loading ? (
              <div className="add-members-status">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="add-members-status">No users found</div>
            ) : (
              users.map((user) => {
                const isChecked = selectedUsers.some((u) => u._id === user._id);
                return (
                  <button
                    key={user._id}
                    type="button"
                    className={`add-members-user-item ${isChecked ? 'selected' : ''}`}
                    onClick={() => handleToggleUser(user)}
                  >
                    <span
                      className={`obsidian-checkbox ${isChecked ? 'checked' : ''}`}
                      aria-hidden="true"
                    >
                      {isChecked && <Check size={12} strokeWidth={2.5} />}
                    </span>
                    <Avatar
                      name={user.name}
                      src={user.avatar}
                      seed={user._id || user.name}
                      size={38}
                    />
                    <div className="add-members-user-info">
                      <span className="add-members-user-name">{user.name}</span>
                      <span className="add-members-user-email">{user.email}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="modal-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-btn-primary"
              disabled={selectedUsers.length === 0 || adding}
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddMembersModal;
