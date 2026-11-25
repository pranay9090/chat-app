import { useState, useRef, useEffect, useLayoutEffect, Fragment } from 'react';
import {
  ArrowLeft,
  Search,
  Info,
  Trash2,
  X,
  Smile,
  Reply,
  Pencil,
  ChevronDown,
  Send,
  Check,
  CheckCheck,
  MessageSquare,
} from 'lucide-react';
import api from '../api/api';
import Avatar from './Avatar';
import ConfirmModal from './ConfirmModal';
import emojiList from '../utils/emojiList';
import {
  getOtherMember,
  getChatName,
  getChatAvatarName,
  getChatAvatar,
  formatMessageTime,
  formatLastSeen,
  formatSearchTime,
  getDateSeparatorLabel,
  isDifferentDay,
} from '../utils/chatHelpers';
import './ChatWindow.css';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢'];
const SENDER_TONES = ['indigo', 'emerald', 'amber', 'rose', 'violet'];

// Deterministic tone class for group sender names without inline styles
const getSenderToneClass = (seed) => {
  const str = (seed || '?').toString().trim();
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return `tone-${SENDER_TONES[Math.abs(hash) % SENDER_TONES.length]}`;
};

// Group consecutive non-system messages from the same sender within 5 minutes
const isSameMessageGroup = (a, b) => {
  if (!a || !b || a.isSystem || b.isSystem) return false;
  if (isDifferentDay(a.createdAt, b.createdAt)) return false;
  const senderA = (a.sender?._id || a.sender)?.toString();
  const senderB = (b.sender?._id || b.sender)?.toString();
  if (!senderA || !senderB || senderA !== senderB) return false;
  return Math.abs(new Date(a.createdAt) - new Date(b.createdAt)) <= 5 * 60 * 1000;
};

// Highlight matching search text in bold
const renderSearchMatch = (text, query) => {
  if (!query || query.trim().length < 2) return text;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'ig');
  const parts = text.split(regex);
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <strong key={idx} className="search-match-bold">
        {part}
      </strong>
    ) : (
      part
    )
  );
};

// ChatWindow component
function ChatWindow({
  selectedConversation,
  messages = [],
  currentUser,
  onlineUserIds = [],
  lastSeenMap = {},
  onSendMessage,
  onBack,
  onDeleteChat,
  onOpenGroupInfo,
  onOpenUserProfile,
  hasMore = false,
  loadingOlder = false,
  onLoadOlder,
  highlightedMsgId = null,
  onScrollToMessage,
  socket,
  onNotify,
  typingUser,
}) {
  const [inputText, setInputText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMessageId, setDeleteMessageId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [activeToolbarId, setActiveToolbarId] = useState(null);
  const [openReactionId, setOpenReactionId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const messagesAreaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const savedScrollHeightRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);
  const prevFirstMsgIdRef = useRef(null);
  const prevLastMsgIdRef = useRef(null);

  // typing status and timer refs
  const isTypingRef = useRef(false);
  const typingTimerRef = useRef(null);

  // Resize textarea to fit content up to 120px
  const resizeComposer = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  // Keep current time updated for 15-minute edit window check
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle initial instant scroll, prepend scroll preservation, and new message scroll
  useLayoutEffect(() => {
    const el = messagesAreaRef.current;
    if (!el) return;

    if (messages.length === 0) {
      prevFirstMsgIdRef.current = null;
      prevLastMsgIdRef.current = null;
      return;
    }

    const firstMsgId = (messages[0]._id || messages[0].id)?.toString();
    const lastMsg = messages[messages.length - 1];
    const lastMsgId = (lastMsg._id || lastMsg.id)?.toString();

    // Preserve scroll position when older messages are prepended
    if (savedScrollHeightRef.current !== null) {
      if (firstMsgId !== prevFirstMsgIdRef.current) {
        el.scrollTop = el.scrollHeight - savedScrollHeightRef.current;
        savedScrollHeightRef.current = null;
        prevFirstMsgIdRef.current = firstMsgId;
        prevLastMsgIdRef.current = lastMsgId;
        return;
      }
      if (!loadingOlder) {
        savedScrollHeightRef.current = null;
      }
    }

    // Jump to bottom instantly when chat first loads
    if (!initialScrollDoneRef.current) {
      el.scrollTop = el.scrollHeight;
      initialScrollDoneRef.current = true;
      isNearBottomRef.current = true;
      prevFirstMsgIdRef.current = firstMsgId;
      prevLastMsgIdRef.current = lastMsgId;
      return;
    }

    // Handle a newly appended message at the end
    if (lastMsgId !== prevLastMsgIdRef.current) {
      const senderId = (lastMsg.sender?._id || lastMsg.sender)?.toString();
      const isMine = Boolean(currentUser?._id && senderId === currentUser._id.toString());

      if (isMine || isNearBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else if (!lastMsg.isSystem) {
        setNewMessagesCount((prev) => prev + 1);
      }

      prevFirstMsgIdRef.current = firstMsgId;
      prevLastMsgIdRef.current = lastMsgId;
    }
  }, [messages, loadingOlder, currentUser?._id]);

  // Track scroll position and load older messages near top
  const handleMessagesScroll = () => {
    const el = messagesAreaRef.current;
    if (!el) return;

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    isNearBottomRef.current = nearBottom;
    setIsNearBottom(nearBottom);

    if (nearBottom) {
      setNewMessagesCount(0);
    }

    if (el.scrollTop < 80 && hasMore && !loadingOlder && savedScrollHeightRef.current === null) {
      savedScrollHeightRef.current = el.scrollHeight;
      onLoadOlder?.();
    }
  };

  // Smooth scroll to bottom and reset unread pill count
  const handleScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMessagesCount(0);
    isNearBottomRef.current = true;
    setIsNearBottom(true);
  };

  // stop typing if switching chats or unmounting
  useEffect(() => {
    return () => {
      if (isTypingRef.current && selectedConversation?._id) {
        socket?.emit('stopTyping', { conversationId: selectedConversation._id });
        isTypingRef.current = false;
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [selectedConversation?._id, socket]);

  // Close search bar on Escape
  useEffect(() => {
    if (!searchOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  // Debounced server search inside the current chat
  useEffect(() => {
    if (!searchOpen || !selectedConversation?._id) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) return;

    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(
          `/messages/${selectedConversation._id}/search?q=${encodeURIComponent(trimmed)}`
        );
        if (!active) return;
        setSearchResults(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error('Failed to search messages:', error);
        if (active) setSearchResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, searchOpen, selectedConversation?._id]);

  // Close emoji picker on outside click or Escape
  useEffect(() => {
    if (!emojiPickerOpen) return;

    const handleDocClick = () => setEmojiPickerOpen(false);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setEmojiPickerOpen(false);
    };

    document.addEventListener('click', handleDocClick, { once: true });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleDocClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [emojiPickerOpen]);

  // Cancel editing on Escape
  useEffect(() => {
    if (!editingMessage) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setEditingMessage(null);
        setInputText('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingMessage]);

  // handle typing keystrokes and resize composer
  const handleInputChange = (event) => {
    const value = event.target.value;
    setInputText(value);
    resizeComposer();

    if (!selectedConversation?._id || !socket) return;

    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const myName = currentUser?.name || storedUser?.name || 'Someone';

    // emit typing event on first keystroke
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing', {
        conversationId: selectedConversation._id,
        name: myName,
      });
    }

    // restart 1.5s timer
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('stopTyping', {
        conversationId: selectedConversation._id,
      });
    }, 1500);
  };

  // Emit reaction toggle for a message
  const handleReact = (messageId, emoji) => {
    socket?.emit('reactToMessage', { messageId, emoji }, (res) => {
      if (res && !res.success) {
        onNotify?.(res.message || 'Failed to react');
      }
    });
    setOpenReactionId(null);
    setActiveToolbarId(null);
  };

  // Open confirmation modal before deleting a message
  const handleDeleteMessage = (messageId) => {
    setDeleteMessageId(messageId);
    setActiveToolbarId(null);
    setOpenReactionId(null);
  };

  // Emit delete for a message after modal confirmation
  const confirmDeleteMessage = () => {
    if (!deleteMessageId) return;
    socket?.emit('deleteMessage', { messageId: deleteMessageId }, (res) => {
      if (res && !res.success) {
        onNotify?.(res.message || 'Failed to delete message');
      }
    });
    setDeleteMessageId(null);
  };

  // Jump to message using Home scrollToMessage helper
  const handleJumpToMessage = (targetId) => {
    onScrollToMessage?.(targetId);
  };

  // handle message submission (new message or edit)
  const handleSubmit = (event) => {
    event?.preventDefault();
    if (!inputText.trim()) return;

    // stop typing immediately when sending
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (isTypingRef.current && selectedConversation?._id) {
      isTypingRef.current = false;
      socket?.emit('stopTyping', { conversationId: selectedConversation._id });
    }

    if (editingMessage) {
      socket?.emit(
        'editMessage',
        { messageId: editingMessage._id, text: inputText.trim() },
        (response) => {
          if (response?.success) {
            setInputText('');
            setEditingMessage(null);
            if (inputRef.current) inputRef.current.style.height = 'auto';
          } else {
            onNotify?.(response?.message || 'Failed to edit message');
          }
        }
      );
      return;
    }

    onSendMessage(inputText.trim(), replyingTo?._id || null);
    setInputText('');
    setReplyingTo(null);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  // Submit on Enter, insert newline on Shift+Enter
  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  // empty selection state
  if (!selectedConversation) {
    return (
      <main className="chatwindow-container chatwindow-empty">
        <div className="empty-chat-hero">
          <div className="empty-hero-badge">
            <img src="/logo.webp" alt="Chat App Logo" className="empty-hero-logo" />
          </div>
          <h2 className="empty-hero-title">Select a chat to start messaging</h2>
          <p className="empty-hero-subtitle">
            Choose an existing conversation from the sidebar or start a new chat or group from the top actions.
          </p>
        </div>
      </main>
    );
  }

  // chat display details
  const chatName = getChatName(selectedConversation, currentUser?._id);
  const avatarName = getChatAvatarName(selectedConversation, currentUser?._id);

  // online status for 1-to-1 chats
  const otherUser = getOtherMember(selectedConversation, currentUser?._id);
  const isOnline =
    !selectedConversation.isGroup && otherUser?._id
      ? onlineUserIds.some((id) => id?.toString() === otherUser._id.toString())
      : false;

  const handleHeaderProfileClick = () => {
    if (selectedConversation.isGroup) {
      onOpenGroupInfo?.();
    } else if (otherUser?._id) {
      onOpenUserProfile?.(otherUser._id);
    }
  };

  return (
    <main
      className="chatwindow-container"
      onClick={() => {
        setActiveToolbarId(null);
        setOpenReactionId(null);
      }}
    >
      {/* Top Header */}
      <header className="chatwindow-header">
        <div className="header-left">
          <button
            type="button"
            className="mobile-back-btn"
            onClick={onBack}
            aria-label="Back to chat list"
          >
            <ArrowLeft size={19} strokeWidth={1.75} />
          </button>

          <button
            type="button"
            className="header-avatar-btn"
            onClick={handleHeaderProfileClick}
            aria-label="View profile"
          >
            <Avatar
              name={avatarName}
              src={getChatAvatar(selectedConversation, currentUser?._id)}
              seed={
                selectedConversation.isGroup
                  ? selectedConversation._id
                  : otherUser?._id
              }
              size={40}
              isOnline={isOnline}
              isGroup={selectedConversation.isGroup}
            />
          </button>

          <div className="header-user-info">
            <h3
              className="header-user-name header-group-name"
              onClick={handleHeaderProfileClick}
            >
              {chatName}
            </h3>
            <div className="header-status-indicator">
              {typingUser ? (
                <span className="header-typing-text">
                  {selectedConversation.isGroup
                    ? `${typingUser} is typing...`
                    : 'typing...'}
                </span>
              ) : selectedConversation.isGroup ? (
                <span className="group-members-count">
                  {selectedConversation.members?.length || 0} members
                </span>
              ) : isOnline ? (
                <>
                  <span className="online-dot" />
                  <span className="online-text">Online</span>
                </>
              ) : (
                <span className="offline-text">
                  {formatLastSeen(lastSeenMap[otherUser?._id] || otherUser?.lastSeen)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right header actions */}
        <div className="header-actions">
          <button
            type="button"
            className={`header-action-btn ${searchOpen ? 'is-active' : ''}`}
            onClick={() => {
              if (searchOpen) {
                setSearchOpen(false);
                setSearchQuery('');
                setSearchResults([]);
              } else {
                setSearchOpen(true);
              }
            }}
            title="Search in chat"
            aria-label="Search in chat"
          >
            <Search size={17} strokeWidth={1.75} />
          </button>

          {selectedConversation.isGroup ? (
            <button
              type="button"
              className="header-action-btn"
              onClick={onOpenGroupInfo}
              title="Group info"
              aria-label="Group info"
            >
              <Info size={17} strokeWidth={1.75} />
            </button>
          ) : (
            <button
              type="button"
              className="header-action-btn header-delete-btn"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete chat"
              aria-label="Delete chat"
            >
              <Trash2 size={17} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </header>

      {/* In-chat Search Bar & Results Panel */}
      {searchOpen && (
        <div className="chat-search-section">
          <div className="chat-search-bar">
            <Search size={15} strokeWidth={1.75} className="chat-search-icon" />
            <input
              type="text"
              className="chat-search-input"
              placeholder="Search in this chat..."
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (val.trim().length < 2) {
                  setSearchResults([]);
                  setSearching(false);
                } else {
                  setSearching(true);
                }
              }}
              autoFocus
            />
            <button
              type="button"
              className="chat-search-close-btn"
              onClick={() => {
                setSearchOpen(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              aria-label="Close search"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          {searchQuery.trim().length >= 2 && (
            <div className="chat-search-results">
              {searching ? (
                <div className="chat-search-status">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="chat-search-status">No messages found</div>
              ) : (
                searchResults.map((resMsg) => {
                  const resSenderId = (resMsg.sender?._id || resMsg.sender)?.toString();
                  const isMyRes =
                    currentUser?._id && resSenderId === currentUser._id.toString();
                  const resSenderName = isMyRes
                    ? 'You'
                    : resMsg.sender?.name || 'Member';

                  return (
                    <div
                      key={resMsg._id}
                      className="search-result-row"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery('');
                        setSearchResults([]);
                        onScrollToMessage?.(resMsg._id);
                      }}
                    >
                      <div className="search-result-top">
                        <span className="search-result-sender">{resSenderName}</span>
                        <span className="search-result-time">
                          {formatSearchTime(resMsg.createdAt)}
                        </span>
                      </div>
                      <p className="search-result-text">
                        {renderSearchMatch(resMsg.text, searchQuery)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages Scrollable Area */}
      <div className="messages-area-wrapper">
        <section
          ref={messagesAreaRef}
          className="chatwindow-messages-area"
          onScroll={handleMessagesScroll}
        >
          {loadingOlder && (
            <div className="loading-older-indicator">Loading older messages...</div>
          )}

          {messages.length === 0 && !typingUser ? (
            <div className="chat-empty-conversation">
              <div className="chat-empty-icon-wrap">
                <MessageSquare size={24} strokeWidth={1.75} />
              </div>
              <p className="chat-empty-text">No messages yet. Start the conversation below.</p>
            </div>
          ) : (
            <div className="messages-stream">
              {messages.map((message, index) => {
                const messageId = (message._id || message.id || index).toString();
                const previousMessage = index > 0 ? messages[index - 1] : null;
                const nextMessage =
                  index < messages.length - 1 ? messages[index + 1] : null;

                const showDateSeparator = isDifferentDay(
                  message.createdAt,
                  previousMessage?.createdAt
                );
                const dateLabel = getDateSeparatorLabel(message.createdAt);

                // System message row without bubble, ticks, toolbar, or reactions
                if (message.isSystem) {
                  return (
                    <Fragment key={messageId}>
                      {showDateSeparator && dateLabel && (
                        <div className="chat-date-separator">
                          <span className="date-separator-pill">{dateLabel}</span>
                        </div>
                      )}
                      <div id={`msg-${messageId}`} className="system-message-row">
                        <span className="system-message-pill">{message.text}</span>
                      </div>
                    </Fragment>
                  );
                }

                const groupedWithPrev =
                  !showDateSeparator && isSameMessageGroup(previousMessage, message);
                const groupedWithNext =
                  Boolean(nextMessage) &&
                  !isDifferentDay(nextMessage.createdAt, message.createdAt) &&
                  isSameMessageGroup(message, nextMessage);

                const isFirstInGroup = !groupedWithPrev;
                const isLastInGroup = !groupedWithNext;
                const groupPosClass =
                  isFirstInGroup && isLastInGroup
                    ? 'msg-group-single'
                    : isFirstInGroup
                      ? 'msg-group-first'
                      : isLastInGroup
                        ? 'msg-group-last'
                        : 'msg-group-middle';

                const senderId = message.sender?._id || message.sender;
                const isMe = senderId?.toString() === currentUser?._id?.toString();
                const senderName = message.sender?.name || 'Member';
                const senderToneClass = getSenderToneClass(senderId || senderName);
                const canEdit =
                  isMe &&
                  !message.isDeleted &&
                  now - new Date(message.createdAt).getTime() < 15 * 60 * 1000;

                // check if message is delivered to all members
                const deliveredCount = message.deliveredTo?.length || 0;
                const totalMembers = selectedConversation.members?.length || 2;
                const isDeliveredToAll = deliveredCount >= totalMembers;

                // Group reactions by emoji
                const groupedReactions = {};
                if (!message.isDeleted && Array.isArray(message.reactions)) {
                  message.reactions.forEach((r) => {
                    if (!r?.emoji) return;
                    if (!groupedReactions[r.emoji]) {
                      groupedReactions[r.emoji] = { count: 0, hasMine: false };
                    }
                    groupedReactions[r.emoji].count += 1;
                    const reactorId = (r.user?._id || r.user)?.toString();
                    if (currentUser?._id && reactorId === currentUser._id.toString()) {
                      groupedReactions[r.emoji].hasMine = true;
                    }
                  });
                }
                const reactionEntries = Object.entries(groupedReactions);

                // Quoted reply details
                const replyObj = message.replyTo;
                const replyId = replyObj?._id || replyObj;
                const replySenderId = (replyObj?.sender?._id || replyObj?.sender)?.toString();
                const replySenderName =
                  currentUser?._id && replySenderId === currentUser._id.toString()
                    ? 'You'
                    : replyObj?.sender?.name || 'Member';

                const isToolbarActive = activeToolbarId === messageId;
                const isReactionOpen = openReactionId === messageId;
                const isHighlighted = highlightedMsgId === messageId;

                return (
                  <Fragment key={messageId}>
                    {showDateSeparator && dateLabel && (
                      <div className="chat-date-separator">
                        <span className="date-separator-pill">{dateLabel}</span>
                      </div>
                    )}

                    <div
                      id={`msg-${messageId}`}
                      className={`message-wrapper ${isMe ? 'message-sent' : 'message-received'} ${groupPosClass} ${isToolbarActive || isReactionOpen ? 'toolbar-active' : ''} ${isHighlighted ? 'message-highlighted' : ''}`}
                    >
                      {selectedConversation.isGroup && !isMe && isFirstInGroup && (
                        <span className={`message-sender-name ${senderToneClass}`}>
                          {senderName}
                        </span>
                      )}

                      <div className="message-bubble-row">
                        <div
                          className="message-bubble"
                          onClick={(e) => {
                            if (message.isDeleted) return;
                            e.stopPropagation();
                            setActiveToolbarId((prev) =>
                              prev === messageId ? null : messageId
                            );
                            setOpenReactionId(null);
                          }}
                        >
                          {!message.isDeleted && replyObj && (
                            <div
                              className="quoted-message-block"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJumpToMessage(replyId);
                              }}
                            >
                              <span className="quoted-sender-name">{replySenderName}</span>
                              <span
                                className={`quoted-message-text ${replyObj.isDeleted ? 'quoted-deleted' : ''}`}
                              >
                                {replyObj.isDeleted
                                  ? 'This message was deleted'
                                  : replyObj.text}
                              </span>
                            </div>
                          )}

                          {message.isDeleted ? (
                            <p className="message-deleted-text">This message was deleted</p>
                          ) : (
                            <p className="message-text">{message.text}</p>
                          )}
                        </div>

                        {!message.isDeleted && (
                          <div
                            className={`message-toolbar ${isReactionOpen ? 'is-open' : ''}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="toolbar-icon-btn"
                              title="React"
                              aria-label="React"
                              onClick={() =>
                                setOpenReactionId((prev) =>
                                  prev === messageId ? null : messageId
                                )
                              }
                            >
                              <Smile size={15} strokeWidth={1.75} />
                            </button>

                            <button
                              type="button"
                              className="toolbar-icon-btn"
                              title="Reply"
                              aria-label="Reply"
                              onClick={() => {
                                setReplyingTo(message);
                                setEditingMessage(null);
                                setOpenReactionId(null);
                                setActiveToolbarId(null);
                                inputRef.current?.focus();
                              }}
                            >
                              <Reply size={15} strokeWidth={1.75} />
                            </button>

                            {canEdit && (
                              <button
                                type="button"
                                className="toolbar-icon-btn"
                                title="Edit"
                                aria-label="Edit"
                                onClick={() => {
                                  setEditingMessage(message);
                                  setReplyingTo(null);
                                  setInputText(message.text || '');
                                  setOpenReactionId(null);
                                  setActiveToolbarId(null);
                                  requestAnimationFrame(() => {
                                    resizeComposer();
                                    inputRef.current?.focus();
                                  });
                                }}
                              >
                                <Pencil size={15} strokeWidth={1.75} />
                              </button>
                            )}

                            {isMe && (
                              <button
                                type="button"
                                className="toolbar-icon-btn toolbar-delete-btn"
                                title="Delete message"
                                aria-label="Delete message"
                                onClick={() => handleDeleteMessage(message._id)}
                              >
                                <Trash2 size={15} strokeWidth={1.75} />
                              </button>
                            )}

                            {isReactionOpen && (
                              <div className="quick-reactions-row">
                                {QUICK_REACTIONS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="quick-reaction-btn"
                                    onClick={() => handleReact(message._id, emoji)}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {!message.isDeleted && reactionEntries.length > 0 && (
                        <div className="message-reactions-row">
                          {reactionEntries.map(([emoji, info]) => (
                            <button
                              key={emoji}
                              type="button"
                              className={`reaction-pill ${info.hasMine ? 'reaction-mine' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReact(message._id, emoji);
                              }}
                            >
                              {emoji} {info.count}
                            </button>
                          ))}
                        </div>
                      )}

                      {isLastInGroup && (
                        <span className="message-timestamp">
                          {formatMessageTime(message.createdAt)}
                          {!message.isDeleted && message.edited && (
                            <span className="message-edited-tag">edited</span>
                          )}
                          {isMe && !message.isDeleted && (
                            <span
                              className={`delivery-tick ${isDeliveredToAll ? 'delivered-all' : ''}`}
                              aria-label={isDeliveredToAll ? 'Delivered' : 'Sent'}
                            >
                              {isDeliveredToAll ? (
                                <CheckCheck size={14} strokeWidth={1.75} />
                              ) : (
                                <Check size={14} strokeWidth={1.75} />
                              )}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </Fragment>
                );
              })}

              {/* Live animated typing bubble */}
              {typingUser && (
                <div className="message-wrapper message-received msg-group-single typing-indicator-row">
                  {selectedConversation.isGroup && (
                    <span
                      className={`message-sender-name ${getSenderToneClass(typingUser)}`}
                    >
                      {typingUser}
                    </span>
                  )}
                  <div
                    className="message-bubble typing-bubble"
                    aria-label={`${typingUser} is typing`}
                  >
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </section>

        {/* New messages pill when scrolled up */}
        {newMessagesCount > 0 && !isNearBottom && (
          <button
            type="button"
            className="new-messages-pill"
            onClick={handleScrollToBottom}
          >
            <span>
              {newMessagesCount === 1
                ? '1 new message'
                : `${newMessagesCount} new messages`}
            </span>
            <ChevronDown size={14} strokeWidth={1.75} />
          </button>
        )}

        {/* Round scroll-to-bottom button */}
        {!isNearBottom && (
          <button
            type="button"
            className="scroll-to-bottom-btn"
            onClick={handleScrollToBottom}
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
          >
            <ChevronDown size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Floating Glassmorphic Composer */}
      <footer className="chatwindow-input-bar">
        <div className="composer-shell">
          {(editingMessage || replyingTo) && (
            <div className="reply-edit-bar">
              <div className="reply-edit-content">
                <span className="reply-edit-label">
                  {editingMessage
                    ? 'Editing message'
                    : (replyingTo.sender?._id || replyingTo.sender)?.toString() ===
                        currentUser?._id?.toString()
                      ? 'Replying to You'
                      : `Replying to ${replyingTo.sender?.name || 'Member'}`}
                </span>
                <span className="reply-edit-text">
                  {editingMessage
                    ? editingMessage.text
                    : replyingTo.isDeleted
                      ? 'This message was deleted'
                      : replyingTo.text}
                </span>
              </div>
              <button
                type="button"
                className="reply-edit-cancel-btn"
                onClick={() => {
                  if (editingMessage) {
                    setEditingMessage(null);
                    setInputText('');
                    if (inputRef.current) inputRef.current.style.height = 'auto';
                  } else {
                    setReplyingTo(null);
                  }
                }}
                aria-label="Cancel"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
          )}

          <form className="message-input-form" onSubmit={handleSubmit}>
            <div className="message-input-wrapper">
              {emojiPickerOpen && (
                <div
                  className="emoji-picker-popup"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="emoji-picker-grid">
                    {emojiList.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="emoji-picker-item"
                        onClick={() => {
                          setInputText((prev) => prev + emoji);
                          requestAnimationFrame(() => {
                            resizeComposer();
                            inputRef.current?.focus();
                          });
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                className={`emoji-picker-btn ${emojiPickerOpen ? 'is-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setEmojiPickerOpen((prev) => !prev);
                }}
                title="Emoji"
                aria-label="Emoji picker"
              >
                <Smile size={19} strokeWidth={1.75} />
              </button>

              <textarea
                ref={inputRef}
                rows={1}
                className="message-text-input"
                placeholder="Type a message..."
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleComposerKeyDown}
              />

              <button
                type="submit"
                className="message-send-btn"
                disabled={!inputText.trim()}
                aria-label="Send message"
              >
                <Send size={17} strokeWidth={1.75} />
              </button>
            </div>
          </form>
        </div>
      </footer>

      {/* Delete Chat Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Delete chat"
        message="Delete this chat? It will only be removed for you."
        confirmText="Delete"
        variant="danger"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDeleteChat?.(selectedConversation._id);
        }}
      />

      {/* Delete Message Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteMessageId)}
        title="Delete message"
        message="Delete this message for everyone?"
        confirmText="Delete"
        variant="danger"
        onCancel={() => setDeleteMessageId(null)}
        onConfirm={confirmDeleteMessage}
      />
    </main>
  );
}

export default ChatWindow;
