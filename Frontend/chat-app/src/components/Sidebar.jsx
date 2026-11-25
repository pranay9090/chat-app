import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  SquarePen,
  UserPlus,
  Pin,
  BellOff,
  MoreHorizontal,
  ChevronDown,
  LogOut,
  Bell,
  MessageCircle,
} from 'lucide-react';
import Avatar from './Avatar';
import ConfirmModal from './ConfirmModal';
import {
  getOtherMember,
  getChatName,
  getChatAvatarName,
  getChatAvatar,
  formatSidebarTime,
} from '../utils/chatHelpers';
import './Sidebar.css';

// Sidebar component showing header, search, conversation list, and user footer
function Sidebar({
  conversations,
  selectedConversation,
  onSelectConversation,
  onOpenNewChat,
  onOpenNewGroup,
  currentUser,
  onlineUserIds,
  onLogout,
  soundOn,
  onToggleSound,
  onTogglePin,
  onToggleMute,
  onOpenMyProfile,
  socketStatus = 'connecting',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [openRowMenuId, setOpenRowMenuId] = useState(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const dropdownRef = useRef(null);

  const myId = currentUser?._id;

  // close profile logout dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // close row action menu on outside click or Escape key
  useEffect(() => {
    if (!openRowMenuId) return;

    const handleOutsideClick = () => {
      setOpenRowMenuId(null);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenRowMenuId(null);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openRowMenuId]);

  // filter by search term and sort pinned chats first while keeping order inside each group
  const sortedConversations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = query
      ? conversations.filter((convo) =>
          getChatName(convo, myId).toLowerCase().includes(query)
        )
      : conversations;

    const pinned = filtered.filter((convo) => convo.isPinned);
    const unpinned = filtered.filter((convo) => !convo.isPinned);
    return [...pinned, ...unpinned];
  }, [conversations, myId, searchTerm]);

  // format last message preview text
  const getPreviewText = (convo) => {
    const last = convo.lastMessage;
    if (!last) return 'No messages yet';
    if (last.isSystem) return last.text || '';

    const senderId = (last.sender?._id || last.sender)?.toString();
    const isMine = Boolean(myId && senderId === myId.toString());
    const body = last.isDeleted ? 'This message was deleted' : last.text || '';

    if (isMine) return `You: ${body}`;
    if (convo.isGroup && last.sender?.name) {
      return `${last.sender.name}: ${body}`;
    }
    return body;
  };

  const statusLabel =
    socketStatus === 'online'
      ? 'Online'
      : socketStatus === 'offline'
        ? 'Offline'
        : 'Connecting...';

  return (
    <aside className="sidebar-container">
      {/* Top Bar */}
      <div className="sidebar-top-bar">
        <div className="sidebar-brand">
          <div className="sidebar-logo-wrap">
            <img src="/logo.webp" alt="Chat App" className="sidebar-logo" />
          </div>
          <h1 className="sidebar-title">Chats</h1>
        </div>

        <div className="sidebar-top-actions">
          <button
            type="button"
            className="sidebar-icon-btn"
            onClick={onOpenNewChat}
            title="New Chat"
            aria-label="New Chat"
          >
            <SquarePen size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="sidebar-icon-btn"
            onClick={onOpenNewGroup}
            title="New Group"
            aria-label="New Group"
          >
            <UserPlus size={18} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="sidebar-search-wrapper">
        <div className="sidebar-search-box">
          <Search size={15} strokeWidth={1.75} className="sidebar-search-icon" />
          <input
            type="text"
            className="sidebar-search-input"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search conversations"
          />
          {searchTerm && (
            <button
              type="button"
              className="sidebar-search-clear"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="sidebar-chat-list">
        {sortedConversations.length === 0 ? (
          <div className="sidebar-empty-state">
            <MessageCircle size={26} strokeWidth={1.75} className="sidebar-empty-icon" />
            <p className="sidebar-empty-text">
              {searchTerm ? 'No chats match your search' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          sortedConversations.map((convo) => {
            const convoId = (convo._id || convo.id)?.toString();
            const isSelected =
              selectedConversation &&
              (selectedConversation._id || selectedConversation.id)?.toString() === convoId;

            const otherUser = !convo.isGroup ? getOtherMember(convo, myId) : null;
            const isOtherOnline = Boolean(
              otherUser &&
                onlineUserIds?.some((id) => id?.toString() === otherUser._id?.toString())
            );
            const chatName = getChatName(convo, myId);
            const avatarName = getChatAvatarName(convo, myId);
            const avatarSrc = getChatAvatar(convo, myId);
            const avatarSeed = convo.isGroup ? convoId : otherUser?._id || chatName;
            const timeLabel = formatSidebarTime(
              convo.lastMessage?.createdAt || convo.updatedAt
            );
            const previewText = getPreviewText(convo);
            const isMenuOpen = openRowMenuId === convoId;

            return (
              <div
                key={convoId}
                className={`sidebar-chat-item ${isSelected ? 'selected' : ''} ${isMenuOpen ? 'menu-open' : ''}`}
                onClick={() => onSelectConversation(convo)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectConversation(convo);
                  }
                }}
              >
                <Avatar
                  name={avatarName}
                  src={avatarSrc}
                  seed={avatarSeed}
                  size={42}
                  isOnline={isOtherOnline}
                  isGroup={convo.isGroup}
                />

                <div className="sidebar-chat-info">
                  <div className="sidebar-chat-top-row">
                    <span className="sidebar-chat-name">{chatName}</span>

                    <div className="sidebar-chat-meta">
                      {convo.isPinned && (
                        <Pin
                          size={12}
                          strokeWidth={1.75}
                          className="sidebar-pin-icon"
                          aria-label="Pinned"
                        />
                      )}
                      {timeLabel && (
                        <span className="sidebar-chat-time">{timeLabel}</span>
                      )}
                      <button
                        type="button"
                        className="sidebar-row-menu-btn"
                        aria-label="Chat options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenRowMenuId((prev) =>
                            prev === convoId ? null : convoId
                          );
                        }}
                      >
                        <MoreHorizontal size={16} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>

                  <div className="sidebar-chat-bottom-row">
                    <span className="sidebar-chat-preview">
                      {convo.isMuted && (
                        <BellOff
                          size={12}
                          strokeWidth={1.75}
                          className="sidebar-mute-icon"
                          aria-label="Muted"
                        />
                      )}
                      <span
                        className={`sidebar-chat-preview-text ${convo.lastMessage?.isDeleted ? 'is-deleted' : ''}`}
                      >
                        {previewText}
                      </span>
                    </span>

                    {convo.unreadCount > 0 && (
                      <span
                        className={`sidebar-unread-badge ${convo.isMuted ? 'badge-muted' : ''}`}
                      >
                        {convo.unreadCount > 99 ? '99+' : convo.unreadCount}
                      </span>
                    )}
                  </div>
                </div>

                {isMenuOpen && (
                  <div
                    className="sidebar-row-dropdown"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="sidebar-row-dropdown-item"
                      onClick={() => {
                        setOpenRowMenuId(null);
                        onTogglePin?.(convo);
                      }}
                    >
                      <Pin size={14} strokeWidth={1.75} />
                      <span>{convo.isPinned ? 'Unpin chat' : 'Pin chat'}</span>
                    </button>
                    <button
                      type="button"
                      className="sidebar-row-dropdown-item"
                      onClick={() => {
                        setOpenRowMenuId(null);
                        onToggleMute?.(convo);
                      }}
                    >
                      <BellOff size={14} strokeWidth={1.75} />
                      <span>{convo.isMuted ? 'Unmute chat' : 'Mute chat'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer User Bar */}
      <div className="sidebar-footer" ref={dropdownRef}>
        <button
          type="button"
          className="sidebar-footer-avatar-btn"
          onClick={onOpenMyProfile}
          title="Edit my profile"
          aria-label="Edit my profile"
        >
          <Avatar
            name={currentUser?.name}
            src={currentUser?.avatar}
            seed={currentUser?._id}
            size={36}
          />
        </button>

        <button
          type="button"
          className="sidebar-footer-profile"
          onClick={() => setDropdownOpen((prev) => !prev)}
          aria-expanded={dropdownOpen}
        >
          <div className="sidebar-footer-user-text">
            <span className="sidebar-footer-name">
              {currentUser?.name || 'My Account'}
            </span>
            <span className="sidebar-footer-status">
              <span className={`sidebar-status-dot status-${socketStatus}`} />
              <span>{statusLabel}</span>
            </span>
          </div>
          <ChevronDown
            size={15}
            strokeWidth={1.75}
            className={`sidebar-footer-chevron ${dropdownOpen ? 'rotated' : ''}`}
          />
        </button>

        <button
          type="button"
          className={`sidebar-sound-btn ${soundOn ? 'sound-on' : ''}`}
          onClick={onToggleSound}
          title={soundOn ? 'Mute notification sounds' : 'Unmute notification sounds'}
          aria-label={soundOn ? 'Mute notification sounds' : 'Unmute notification sounds'}
        >
          {soundOn ? (
            <Bell size={17} strokeWidth={1.75} />
          ) : (
            <BellOff size={17} strokeWidth={1.75} />
          )}
        </button>

        {dropdownOpen && (
          <div className="sidebar-footer-dropdown">
            <button
              type="button"
              className="sidebar-footer-dropdown-item danger"
              onClick={() => {
                setDropdownOpen(false);
                setLogoutConfirmOpen(true);
              }}
            >
              <LogOut size={15} strokeWidth={1.75} />
              <span>Log out</span>
            </button>
          </div>
        )}
      </div>

      {/* Logout confirmation modal */}
      <ConfirmModal
        isOpen={logoutConfirmOpen}
        title="Log out?"
        message="You will be signed out of your account on this device."
        confirmText="Log out"
        variant="danger"
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          onLogout();
        }}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </aside>
  );
}

export default Sidebar;
