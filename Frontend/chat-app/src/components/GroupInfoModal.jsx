import { useState, useRef, useEffect } from 'react';
import {
  X,
  Camera,
  Image as ImageIcon,
  Trash2,
  Pencil,
  UserPlus,
  Star,
} from 'lucide-react';
import api from '../api/api';
import Avatar from './Avatar';
import ConfirmModal from './ConfirmModal';
import { isAdmin } from '../utils/chatHelpers';
import { resizeImage } from '../utils/imageHelpers';
import './GroupInfoModal.css';

// Group info modal showing members list, admin controls, and leave group button
function GroupInfoModal({
  conversation,
  myId,
  onlineUserIds = [],
  onClose,
  onLeave,
  onOpenAddMembers,
  onOpenUserProfile,
  onNotify,
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [showRemovePhotoConfirm, setShowRemovePhotoConfirm] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const fileInputRef = useRef(null);

  // Close group photo menu on outside click
  useEffect(() => {
    if (!photoMenuOpen) return;
    const handleDocClick = () => setPhotoMenuOpen(false);
    document.addEventListener('click', handleDocClick, { once: true });
    return () => document.removeEventListener('click', handleDocClick);
  }, [photoMenuOpen]);

  // Close modals/photo viewer on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (photoViewerOpen) {
        setPhotoViewerOpen(false);
      } else if (photoMenuOpen) {
        setPhotoMenuOpen(false);
      } else if (!showLeaveConfirm && !showRemovePhotoConfirm && !memberToRemove) {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    photoViewerOpen,
    photoMenuOpen,
    showLeaveConfirm,
    showRemovePhotoConfirm,
    memberToRemove,
    onClose,
  ]);

  if (!conversation) return null;

  const members = conversation.members || [];
  const amIAdmin = isAdmin(conversation, myId);

  // Show current user first, then other members
  const sortedMembers = [...members].sort((a, b) => {
    const aIsMe = (a?._id || a)?.toString() === myId?.toString();
    const bIsMe = (b?._id || b)?.toString() === myId?.toString();
    if (aIsMe && !bIsMe) return -1;
    if (!aIsMe && bIsMe) return 1;
    return 0;
  });

  // Save renamed group title
  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!editedName.trim() || savingName) return;

    try {
      setSavingName(true);
      await api.put(`/conversations/${conversation._id}/rename`, {
        name: editedName.trim(),
      });
      setIsEditingName(false);
    } catch (error) {
      onNotify?.(error.response?.data?.message || 'Failed to rename group');
    } finally {
      setSavingName(false);
    }
  };

  // Upload a new group avatar photo
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onNotify?.('Image must be 5MB or smaller');
      e.target.value = '';
      return;
    }

    try {
      setSavingPhoto(true);
      const avatar = await resizeImage(file);
      await api.put(`/conversations/${conversation._id}/avatar`, { avatar });
    } catch (error) {
      onNotify?.(error.response?.data?.message || 'Something went wrong');
    } finally {
      setSavingPhoto(false);
      e.target.value = '';
    }
  };

  // Remove group avatar photo after modal confirmation
  const confirmRemoveGroupPhoto = async () => {
    setShowRemovePhotoConfirm(false);
    try {
      setSavingPhoto(true);
      await api.put(`/conversations/${conversation._id}/avatar`, { avatar: '' });
    } catch (error) {
      onNotify?.(error.response?.data?.message || 'Something went wrong');
    } finally {
      setSavingPhoto(false);
    }
  };

  // Promote a member to admin
  const handleMakeAdmin = async (memberId) => {
    try {
      await api.put(`/conversations/${conversation._id}/admins/${memberId}`);
    } catch (error) {
      onNotify?.(error.response?.data?.message || 'Failed to make admin');
    }
  };

  // Remove member after modal confirmation
  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    const memberId = (memberToRemove._id || memberToRemove)?.toString();
    setMemberToRemove(null);

    try {
      await api.delete(`/conversations/${conversation._id}/members/${memberId}`);
    } catch (error) {
      onNotify?.(error.response?.data?.message || 'Failed to remove member');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card group-info-card-override"
        role="dialog"
        aria-modal="true"
        aria-label="Group Info"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">Group Info</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Group Summary */}
        <div className="group-info-summary">
          <div
            className={`group-info-avatar-wrap ${conversation.avatar ? 'clickable-photo' : ''}`}
            onClick={() => {
              if (conversation.avatar) setPhotoViewerOpen(true);
            }}
          >
            <Avatar
              name={conversation.name || 'G'}
              src={conversation.avatar}
              seed={conversation._id || conversation.name}
              size={84}
              isGroup={true}
            />
            {amIAdmin && (
              <>
                <button
                  type="button"
                  className="group-avatar-camera-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoMenuOpen((prev) => !prev);
                  }}
                  disabled={savingPhoto}
                  title="Group photo options"
                  aria-label="Group photo options"
                >
                  <Camera size={15} strokeWidth={1.75} />
                </button>

                {photoMenuOpen && (
                  <div
                    className="group-photo-menu-dropdown"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="group-photo-menu-item"
                      onClick={() => {
                        setPhotoMenuOpen(false);
                        fileInputRef.current?.click();
                      }}
                    >
                      <ImageIcon size={15} strokeWidth={1.75} />
                      <span>
                        {conversation.avatar ? 'Change group photo' : 'Add group photo'}
                      </span>
                    </button>

                    {conversation.avatar && (
                      <button
                        type="button"
                        className="group-photo-menu-item group-photo-menu-danger"
                        onClick={() => {
                          setPhotoMenuOpen(false);
                          setShowRemovePhotoConfirm(true);
                        }}
                      >
                        <Trash2 size={15} strokeWidth={1.75} />
                        <span>Remove group photo</span>
                      </button>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handlePhotoChange}
                  hidden
                />
              </>
            )}
          </div>

          {savingPhoto && <span className="group-info-saving">Saving...</span>}

          {isEditingName ? (
            <form className="group-rename-form" onSubmit={handleRenameSubmit}>
              <input
                type="text"
                className="modal-input group-rename-input"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="modal-btn-primary"
                disabled={!editedName.trim() || savingName}
              >
                Save
              </button>
              <button
                type="button"
                className="modal-btn-secondary"
                onClick={() => setIsEditingName(false)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <div className="group-info-name-row">
              <h4 className="group-info-name">{conversation.name || 'Group Chat'}</h4>
              {amIAdmin && (
                <button
                  type="button"
                  className="group-edit-name-btn"
                  title="Rename group"
                  aria-label="Rename group"
                  onClick={() => {
                    setEditedName(conversation.name || '');
                    setIsEditingName(true);
                  }}
                >
                  <Pencil size={14} strokeWidth={1.75} />
                </button>
              )}
            </div>
          )}

          <span className="group-info-count">{members.length} members</span>

          {amIAdmin && (
            <button
              type="button"
              className="group-add-members-btn"
              onClick={onOpenAddMembers}
            >
              <UserPlus size={14} strokeWidth={1.75} />
              <span>Add members</span>
            </button>
          )}
        </div>

        {/* Scrollable Members List */}
        <div className="group-info-members-list">
          {sortedMembers.map((member) => {
            const memberId = (member?._id || member)?.toString();
            const isMe = Boolean(myId && memberId === myId.toString());
            const memberIsAdmin = isAdmin(conversation, memberId);
            const isOnline = Boolean(
              memberId && onlineUserIds.some((id) => id?.toString() === memberId)
            );

            return (
              <div
                key={memberId}
                className={`group-info-member-row ${!isMe ? 'member-row-clickable' : ''}`}
                role={!isMe ? 'button' : undefined}
                tabIndex={!isMe ? 0 : undefined}
                onClick={() => {
                  if (!isMe) onOpenUserProfile?.(memberId);
                }}
                onKeyDown={(e) => {
                  if (!isMe && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onOpenUserProfile?.(memberId);
                  }
                }}
              >
                <Avatar
                  name={member.name}
                  src={member.avatar}
                  seed={memberId || member.name}
                  size={40}
                  isOnline={isOnline}
                />
                <div className="group-info-member-info">
                  <div className="group-info-member-top">
                    <span className="group-info-member-name">{member.name}</span>
                    {isMe && <span className="group-info-you-tag">You</span>}
                    {memberIsAdmin && <span className="group-info-admin-tag">Admin</span>}
                  </div>
                  <span className="group-info-member-email">{member.email}</span>
                </div>

                {amIAdmin && !isMe && (
                  <div className="group-member-actions">
                    {!memberIsAdmin && (
                      <button
                        type="button"
                        className="group-member-action-btn"
                        title="Make admin"
                        aria-label="Make admin"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMakeAdmin(memberId);
                        }}
                      >
                        <Star size={14} strokeWidth={1.75} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="group-member-action-btn group-member-remove-btn"
                      title="Remove from group"
                      aria-label="Remove from group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMemberToRemove(member);
                      }}
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Leave Group Footer */}
        <div className="modal-footer group-info-footer">
          <button
            type="button"
            className="group-info-leave-btn"
            onClick={() => setShowLeaveConfirm(true)}
          >
            Leave group
          </button>
        </div>
      </div>

      {/* Leave Group Confirmation Modal */}
      <ConfirmModal
        isOpen={showLeaveConfirm}
        title="Leave group"
        message="Leave this group?"
        confirmText="Leave"
        onCancel={() => setShowLeaveConfirm(false)}
        onConfirm={() => {
          setShowLeaveConfirm(false);
          onLeave?.();
        }}
      />

      {/* Remove Member Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(memberToRemove)}
        title="Remove member"
        message={`Remove ${memberToRemove?.name || 'this member'} from the group?`}
        confirmText="Remove"
        onCancel={() => setMemberToRemove(null)}
        onConfirm={confirmRemoveMember}
      />

      {/* Remove Group Photo Confirmation Modal */}
      <ConfirmModal
        isOpen={showRemovePhotoConfirm}
        title="Remove photo"
        message="Remove the group photo?"
        confirmText="Remove"
        onCancel={() => setShowRemovePhotoConfirm(false)}
        onConfirm={confirmRemoveGroupPhoto}
      />

      {/* Full-screen group photo viewer */}
      {photoViewerOpen && conversation.avatar && (
        <div
          className="photo-viewer-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setPhotoViewerOpen(false);
          }}
        >
          <img
            src={conversation.avatar}
            alt={conversation.name || 'Group'}
            className="photo-viewer-img"
          />
        </div>
      )}
    </div>
  );
}

export default GroupInfoModal;
