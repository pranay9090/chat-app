import { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import api from '../api/api';
import Avatar from './Avatar';
import './NewGroupModal.css';

// Modal to create a new group conversation
function NewGroupModal({ isOpen, onClose, onSelectConversation }) {
  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [serverError, setServerError] = useState('');

  // Fetch users with 300ms debounce when modal is open
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
        console.error('Error fetching users for group:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, isOpen]);

  // Toggle user selection
  const handleToggleUser = (user) => {
    const isSelected = selectedUsers.some((u) => u._id === user._id);
    if (isSelected) {
      setSelectedUsers(selectedUsers.filter((u) => u._id !== user._id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  // Remove selected user chip
  const handleRemoveChip = (userId) => {
    setSelectedUsers(selectedUsers.filter((u) => u._id !== userId));
  };

  // Handle group creation submission
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setServerError('');

    if (!groupName.trim()) {
      setServerError('Please enter a group name');
      return;
    }

    if (selectedUsers.length < 2) {
      setServerError('Please select at least 2 other members');
      return;
    }

    try {
      setCreatingGroup(true);
      const response = await api.post('/conversations/group', {
        name: groupName.trim(),
        memberIds: selectedUsers.map((u) => u._id),
      });

      onSelectConversation(response.data);
      onClose();
    } catch (error) {
      const message =
        error.response?.data?.message || 'Failed to create group. Please try again.';
      setServerError(message);
    } finally {
      setCreatingGroup(false);
    }
  };

  if (!isOpen) return null;

  const isSubmitDisabled =
    !groupName.trim() || selectedUsers.length < 2 || creatingGroup;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card new-group-card-size"
        role="dialog"
        aria-modal="true"
        aria-label="Create Group Chat"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">Create Group Chat</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleCreateGroup} className="new-group-form">
          {serverError && (
            <div className="new-group-error-banner">{serverError}</div>
          )}

          <div className="new-group-field">
            <label htmlFor="group-name-input" className="new-group-label">
              Group Name
            </label>
            <input
              id="group-name-input"
              type="text"
              className="modal-input"
              placeholder="e.g. Weekend Trip, Project Team"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
            />
          </div>

          {selectedUsers.length > 0 && (
            <div className="new-group-chips-wrapper">
              <span className="chips-heading">
                Selected ({selectedUsers.length}):
              </span>
              <div className="new-group-chips-list">
                {selectedUsers.map((user) => (
                  <span key={user._id} className="user-chip">
                    {user.name}
                    <button
                      type="button"
                      className="chip-remove-btn"
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

          <div className="new-group-field">
            <label htmlFor="group-user-search" className="new-group-label">
              Add Members (min 2)
            </label>
            <input
              id="group-user-search"
              type="text"
              className="modal-input"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="new-group-user-list">
            {loading ? (
              <div className="new-group-status">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="new-group-status">No users found</div>
            ) : (
              users.map((user) => {
                const isChecked = selectedUsers.some((u) => u._id === user._id);

                return (
                  <button
                    key={user._id}
                    type="button"
                    className={`new-group-user-item ${isChecked ? 'item-selected' : ''}`}
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
                    <div className="new-group-user-info">
                      <span className="new-group-user-name">{user.name}</span>
                      <span className="new-group-user-email">{user.email}</span>
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
              disabled={isSubmitDisabled}
            >
              {creatingGroup
                ? 'Creating Group...'
                : `Create Group (${selectedUsers.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewGroupModal;
