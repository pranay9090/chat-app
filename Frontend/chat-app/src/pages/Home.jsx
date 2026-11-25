import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { connectSocket, disconnectSocket } from '../socket';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import NewChatModal from '../components/NewChatModal';
import NewGroupModal from '../components/NewGroupModal';
import GroupInfoModal from '../components/GroupInfoModal';
import AddMembersModal from '../components/AddMembersModal';
import MyProfileModal from '../components/MyProfileModal';
import UserProfileModal from '../components/UserProfileModal';
import Toast from '../components/Toast';
import notificationSound from '../assets/text_message.mp3';
import './Home.css';

// Home page component
function Home() {
  const navigate = useNavigate();

  // keep logged-in user profile in state so profile edits re-render UI
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('Failed to parse user profile', err);
      return null;
    }
  });
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // state: conversations list and active conversation
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);

  // state: messages in active conversation and pagination
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);

  // state: online user ids and last seen map
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [lastSeenMap, setLastSeenMap] = useState({});

  // state: typing indicator
  const [typingInfo, setTypingInfo] = useState(null);

  // typing timeout and highlight refs
  const typingTimerRef = useRef(null);
  const highlightTimerRef = useRef(null);
  const messagesRef = useRef(messages);
  const hasMoreRef = useRef(hasMore);
  const loadingOlderRef = useRef(false);

  // modals visibility, toast, and socket connection state
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [myProfileOpen, setMyProfileOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);
  const [socketStatus, setSocketStatus] = useState('connecting');
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // show auto-dismissing toast banner
  const showToast = useCallback((message, type = 'error') => {
    if (!message) return;
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // audio instance for message notifications
  const audioRef = useRef(new Audio(notificationSound));

  // state: notification sound enabled
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('soundOn') !== 'false');
  const soundOnRef = useRef(soundOn);

  // keep soundOn ref synced with state
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  // toggle sound preference
  const handleToggleSound = () => {
    setSoundOn((prev) => {
      const next = !prev;
      localStorage.setItem('soundOn', next.toString());
      soundOnRef.current = next;
      return next;
    });
  };

  // keep conversations, messages, and hasMore refs synced
  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  // request notification permission once on first user click
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'default') return;

    const handleFirstClick = () => {
      Notification.requestPermission();
    };

    document.addEventListener('click', handleFirstClick, { once: true });
    return () => {
      document.removeEventListener('click', handleFirstClick);
    };
  }, []);

  // mutable refs for active conversation and socket instance
  const selectedConversationRef = useRef(selectedConversation);
  const socketRef = useRef(null);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  // update document title with total unread count
  useEffect(() => {
    const totalUnread = conversations.reduce(
      (sum, convo) => sum + (convo.unreadCount || 0),
      0
    );
    document.title = totalUnread > 0 ? `(${totalUnread}) Chat App` : 'Chat App';
  }, [conversations]);

  // fetch user conversations on load
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const response = await api.get('/conversations');
        const list = Array.isArray(response.data) ? response.data : [];
        const seen = new Set();
        const uniqueList = list.filter((c) => {
          const id = (c._id || c.id)?.toString();
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        setConversations(uniqueList);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    };

    fetchConversations();
  }, []);

  // connect socket and listen for real-time events
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = connectSocket(token);
    socketRef.current = socket;

    if (socket.connected) {
      Promise.resolve().then(() => setSocketStatus('online'));
    }

    // socket connection lifecycle status
    socket.on('connect', () => {
      setSocketStatus('online');
    });

    socket.on('disconnect', () => {
      setSocketStatus('offline');
    });

    socket.on('connect_error', () => {
      setSocketStatus('offline');
    });

    // online users update
    socket.on('onlineUsers', (userIds) => {
      setOnlineUserIds(userIds);
    });

    // new conversation event (e.g. newly created groups)
    socket.on('newConversation', (newConversation) => {
      setConversations((prevConversations) => {
        const alreadyExists = prevConversations.some(
          (c) => c._id === newConversation._id
        );
        if (alreadyExists) return prevConversations;

        const groupWithUnread = {
          ...newConversation,
          unreadCount: 0,
        };

        return [groupWithUnread, ...prevConversations];
      });
    });

    // incoming live messages (1-to-1 and groups)
    socket.on('newMessage', (incomingMessage, ack) => {
      // acknowledge delivery to server
      if (typeof ack === 'function') {
        ack({ received: true });
      }

      const activeConvo = selectedConversationRef.current;
      const isCurrentChat = activeConvo && incomingMessage.conversationId === activeConvo._id;

      // System messages: append if open, update lastMessage & move to top, no unread/sound/markAsRead
      if (incomingMessage.isSystem) {
        if (isCurrentChat) {
          setMessages((prevMessages) => {
            const alreadyExists = prevMessages.some(
              (msg) => (msg._id || msg.id) === (incomingMessage._id || incomingMessage.id)
            );
            if (alreadyExists) return prevMessages;
            return [...prevMessages, incomingMessage];
          });
        }

        setConversations((prevConversations) => {
          const targetId = incomingMessage.conversationId;
          const targetConvo = prevConversations.find((c) => c._id === targetId);
          if (!targetConvo) {
            api
              .get('/conversations')
              .then((res) => {
                const list = Array.isArray(res.data) ? res.data : [];
                setConversations(list);
              })
              .catch((err) => console.error('Failed to reload conversations:', err));
            return prevConversations;
          }

          const updatedConvo = {
            ...targetConvo,
            lastMessage: incomingMessage,
            updatedAt: incomingMessage.createdAt || new Date().toISOString(),
          };
          const remaining = prevConversations.filter((c) => c._id !== targetId);
          return [updatedConvo, ...remaining];
        });
        return;
      }

      // if message belongs to currently open chat
      if (isCurrentChat) {
        setMessages((prevMessages) => {
          const alreadyExists = prevMessages.some(
            (msg) => (msg._id || msg.id) === (incomingMessage._id || incomingMessage.id)
          );
          if (alreadyExists) return prevMessages;
          return [...prevMessages, incomingMessage];
        });

        // mark as read via socket
        socket.emit('markAsRead', { conversationId: incomingMessage.conversationId });
      }

      // update sidebar conversation list and unread count
      setConversations((prevConversations) => {
        const targetId = incomingMessage.conversationId;
        const targetConvo = prevConversations.find((c) => c._id === targetId);

        if (targetConvo) {
          const updatedUnreadCount = isCurrentChat
            ? 0
            : (targetConvo.unreadCount || 0) + 1;

          const updatedConvo = {
            ...targetConvo,
            lastMessage: incomingMessage,
            unreadCount: updatedUnreadCount,
            updatedAt: incomingMessage.createdAt || new Date().toISOString(),
          };

          const remaining = prevConversations.filter((c) => c._id !== targetId);
          return [updatedConvo, ...remaining];
        } else {
          api
            .get('/conversations')
            .then((res) => {
              const list = Array.isArray(res.data) ? res.data : [];
              setConversations(list);
            })
            .catch((err) => console.error('Failed to reload conversations:', err));

          return prevConversations;
        }
      });

      // sender check: do not play sound or show notification for messages I sent myself or muted chats
      const myId = currentUser?._id;
      const senderId = (incomingMessage.sender?._id || incomingMessage.sender)?.toString();
      const isMyMessage = Boolean(myId && senderId === myId.toString());
      const targetConvo = conversationsRef.current.find(
        (c) => c._id === incomingMessage.conversationId
      );
      const isMutedChat = Boolean(targetConvo?.isMuted);

      if (!isMyMessage && !isMutedChat) {
        // play notification sound if chat is not open or tab is hidden, and sound is on
        if ((!isCurrentChat || document.hidden) && soundOnRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }

        // browser notification when tab is hidden
        if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const senderName = incomingMessage.sender?.name || 'Someone';
          const isGroup = targetConvo?.isGroup;
          const title = isGroup ? targetConvo.name || 'Group' : senderName;
          const body = isGroup ? `${senderName}: ${incomingMessage.text}` : incomingMessage.text;
          new Notification(title, { body });
        }
      }
    });

    // typing indicator from others
    socket.on('typing', ({ conversationId, name }) => {
      setTypingInfo({ conversationId, name });

      // restart 3 second timer that clears typing indicator
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        setTypingInfo(null);
      }, 3000);
    });

    // stop typing from others
    socket.on('stopTyping', () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      setTypingInfo(null);
    });

    // message delivery confirmation
    socket.on('messageDelivered', ({ messageId, conversationId, userId }) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) => {
          const currentId = msg._id || msg.id;
          if (currentId?.toString() === messageId?.toString()) {
            const existingDelivered = msg.deliveredTo || [];
            const alreadyIn = existingDelivered.some(
              (id) => (id?._id || id)?.toString() === userId.toString()
            );
            if (alreadyIn) return msg;
            return {
              ...msg,
              deliveredTo: [...existingDelivered, userId],
            };
          }
          return msg;
        })
      );
    });

    // update conversation on group rename, member changes, or admin promotion
    socket.on('conversationUpdated', (updatedConvo) => {
      const updatedId = (updatedConvo._id || updatedConvo.id)?.toString();
      setConversations((prev) =>
        prev.map((c) =>
          (c._id || c.id)?.toString() === updatedId
            ? {
                ...updatedConvo,
                unreadCount: c.unreadCount || 0,
                isPinned: c.isPinned ?? false,
                isMuted: c.isMuted ?? false,
              }
            : c
        )
      );

      setSelectedConversation((prev) =>
        prev && (prev._id || prev.id)?.toString() === updatedId
          ? {
              ...updatedConvo,
              unreadCount: prev.unreadCount || 0,
              isPinned: prev.isPinned ?? false,
              isMuted: prev.isMuted ?? false,
            }
          : prev
      );
    });

    // track user last seen timestamp when their last tab disconnects
    socket.on('userLastSeen', ({ userId, lastSeen }) => {
      if (!userId) return;
      setLastSeenMap((prev) => ({ ...prev, [userId.toString()]: lastSeen }));
    });

    // update user name and avatar in conversations, active chat, and own profile
    socket.on('userUpdated', ({ userId, name, avatar }) => {
      const targetId = userId?.toString();
      if (!targetId) return;

      const updateMembers = (convo) => ({
        ...convo,
        members: (convo.members || []).map((m) =>
          (m?._id || m)?.toString() === targetId ? { ...m, name, avatar } : m
        ),
      });

      setConversations((prev) => prev.map(updateMembers));
      setSelectedConversation((prev) => (prev ? updateMembers(prev) : prev));

      if (currentUserRef.current?._id?.toString() === targetId) {
        const updatedMe = { ...currentUserRef.current, name, avatar };
        setCurrentUser(updatedMe);
        localStorage.setItem('user', JSON.stringify(updatedMe));
      }
    });

    // remove group when current user is removed by an admin
    socket.on('removedFromGroup', ({ conversationId }) => {
      const targetId = conversationId?.toString();
      setConversations((prev) =>
        prev.filter((c) => (c._id || c.id)?.toString() !== targetId)
      );

      if (selectedConversationRef.current?._id?.toString() === targetId) {
        setSelectedConversation(null);
        setMessages([]);
        setGroupInfoOpen(false);
        setAddMembersOpen(false);
      }

      showToast('You were removed from the group');
    });

    // update edited message in active chat and sidebar preview
    socket.on('messageEdited', ({ messageId, text }) => {
      const targetId = messageId?.toString();
      setMessages((prev) =>
        prev.map((m) =>
          (m._id || m.id)?.toString() === targetId
            ? { ...m, text, edited: true }
            : m
        )
      );
      setConversations((prev) =>
        prev.map((c) => {
          const lastId = (c.lastMessage?._id || c.lastMessage)?.toString();
          if (lastId && lastId === targetId) {
            return { ...c, lastMessage: { ...c.lastMessage, text, edited: true } };
          }
          return c;
        })
      );
    });

    // mark deleted message in active chat and sidebar preview
    socket.on('messageDeleted', ({ messageId }) => {
      const targetId = messageId?.toString();
      setMessages((prev) =>
        prev.map((m) => {
          if ((m._id || m.id)?.toString() === targetId) {
            return { ...m, isDeleted: true, text: '', reactions: [] };
          }
          if (m.replyTo && (m.replyTo._id || m.replyTo)?.toString() === targetId) {
            return { ...m, replyTo: { ...m.replyTo, isDeleted: true, text: '' } };
          }
          return m;
        })
      );
      setConversations((prev) =>
        prev.map((c) => {
          const lastId = (c.lastMessage?._id || c.lastMessage)?.toString();
          if (lastId && lastId === targetId) {
            return {
              ...c,
              lastMessage: { ...c.lastMessage, isDeleted: true, text: '', reactions: [] },
            };
          }
          return c;
        })
      );
    });

    // update reactions on a message
    socket.on('messageReacted', ({ messageId, reactions }) => {
      const targetId = messageId?.toString();
      setMessages((prev) =>
        prev.map((m) =>
          (m._id || m.id)?.toString() === targetId
            ? { ...m, reactions: reactions || [] }
            : m
        )
      );
    });

    // remove socket listeners on unmount
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('onlineUsers');
      socket.off('newConversation');
      socket.off('newMessage');
      socket.off('typing');
      socket.off('stopTyping');
      socket.off('messageDelivered');
      socket.off('conversationUpdated');
      socket.off('userLastSeen');
      socket.off('userUpdated');
      socket.off('removedFromGroup');
      socket.off('messageEdited');
      socket.off('messageDeleted');
      socket.off('messageReacted');
    };
    }, [showToast]);

  // fetch latest 30 messages and mark as read via socket when conversation is selected
  useEffect(() => {
    if (!selectedConversation?._id) {
      setMessages([]);
      setHasMore(false);
      setLoadingOlder(false);
      return;
    }

    const conversationId = selectedConversation._id;
    let active = true;

    // fetch latest 30 messages over HTTP
    const fetchMessages = async () => {
      try {
        const response = await api.get(`/messages/${conversationId}`);
        if (!active || selectedConversationRef.current?._id !== conversationId) return;
        const list = Array.isArray(response.data) ? response.data : [];
        messagesRef.current = list;
        hasMoreRef.current = list.length === 30;
        loadingOlderRef.current = false;
        setMessages(list);
        setHasMore(list.length === 30);
        setLoadingOlder(false);
      } catch (error) {
        console.error('Failed to load messages:', error);
      }
    };

    fetchMessages();

    // mark messages as read via socket
    socketRef.current?.emit('markAsRead', { conversationId });

    // reset unread count in sidebar
    setConversations((prev) =>
      prev.map((c) => (c._id === conversationId ? { ...c, unreadCount: 0 } : c))
    );

    return () => {
      active = false;
    };
  }, [selectedConversation?._id]);

  // Load 30 older messages before the oldest currently loaded message
  const loadOlderMessages = async () => {
    const activeId = selectedConversationRef.current?._id;
    const currentMsgs = messagesRef.current;
    if (
      loadingOlderRef.current ||
      !hasMoreRef.current ||
      !activeId ||
      currentMsgs.length === 0
    ) {
      return false;
    }

    const before = currentMsgs[0].createdAt;
    loadingOlderRef.current = true;
    setLoadingOlder(true);

    try {
      const response = await api.get(
        `/messages/${activeId}?before=${encodeURIComponent(before)}`
      );
      if (selectedConversationRef.current?._id !== activeId) return false;

      const older = Array.isArray(response.data) ? response.data : [];
      const seen = new Set(messagesRef.current.map((m) => (m._id || m.id)?.toString()));
      const fresh = older.filter((m) => !seen.has((m._id || m.id)?.toString()));
      const nextMessages = [...fresh, ...messagesRef.current];
      messagesRef.current = nextMessages;
      setMessages(nextMessages);

      const more = older.length === 30;
      hasMoreRef.current = more;
      setHasMore(more);
      return more && fresh.length > 0;
    } catch (error) {
      console.error('Failed to load older messages:', error);
      return false;
    } finally {
      loadingOlderRef.current = false;
      if (selectedConversationRef.current?._id === activeId) {
        setLoadingOlder(false);
      }
    }
  };

  // Scroll to a message, loading older pages if needed (max 20 pages)
  const scrollToMessage = async (messageId) => {
    if (!messageId) return;
    const targetId = messageId.toString();
    const activeId = selectedConversationRef.current?._id;
    if (!activeId) return;

    const highlightAndScroll = () => {
      const el = document.getElementById(`msg-${targetId}`);
      if (!el) return false;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(targetId);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedMsgId(null);
      }, 1000);
      return true;
    };

    if (highlightAndScroll()) return;

    for (let page = 0; page < 20; page += 1) {
      if (selectedConversationRef.current?._id !== activeId) return;
      if (!hasMoreRef.current) break;
      const loaded = await loadOlderMessages();
      if (selectedConversationRef.current?._id !== activeId) return;

      const foundInState = messagesRef.current.some(
        (m) => (m._id || m.id)?.toString() === targetId
      );
      if (foundInState) {
        requestAnimationFrame(() => {
          setTimeout(() => highlightAndScroll(), 30);
        });
        return;
      }
      if (!loaded) break;
    }
  };

  // handle selecting or creating a conversation from modals or sidebar
  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);

    const convoId = (conversation._id || conversation.id)?.toString();

    // mark as read via socket
    if (convoId) {
      socketRef.current?.emit('markAsRead', { conversationId: convoId });
    }

    // add to sidebar if not present, otherwise reset unread count and prevent duplicates
    setConversations((prev) => {
      const exists = prev.some(
        (c) => (c._id || c.id)?.toString() === convoId
      );
      if (!exists) {
        return [{ ...conversation, unreadCount: 0 }, ...prev];
      }
      return prev.map((c) =>
        (c._id || c.id)?.toString() === convoId ? { ...c, unreadCount: 0 } : c
      );
    });
  };

  // handle sending message via socket
  const handleSendMessage = (text, replyTo = null) => {
    if (!selectedConversation?._id || !text.trim()) return;

    socketRef.current?.emit(
      'sendMessage',
      {
        conversationId: selectedConversation._id,
        text: text.trim(),
        ...(replyTo ? { replyTo } : {}),
      },
      (response) => {
        if (response?.success) {
          const newMessage = response.message;
          setMessages((prev) => [...prev, newMessage]);

          setConversations((prev) => {
            const targetId = selectedConversation._id;
            const targetConvo =
              prev.find((c) => c._id === targetId) || selectedConversation;

            const updatedConversation = {
              ...targetConvo,
              lastMessage: newMessage,
              unreadCount: 0,
              updatedAt: newMessage.createdAt || new Date().toISOString(),
            };

            const remaining = prev.filter((c) => c._id !== targetId);
            return [updatedConversation, ...remaining];
          });
        } else {
          showToast(response?.message || 'Failed to send message');
        }
      }
    );
  };



  // delete 1-to-1 chat for current user only
  const handleDeleteChat = async (id) => {
    try {
      await api.delete(`/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c._id !== id));
      setSelectedConversation(null);
      setMessages([]);
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete chat');
    }
  };

  // leave current group chat
  const handleLeaveGroup = async (id) => {
    try {
      await api.put(`/conversations/${id}/leave`);
      setConversations((prev) => prev.filter((c) => c._id !== id));
      setSelectedConversation(null);
      setMessages([]);
      setGroupInfoOpen(false);
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to leave group');
    }
  };

  // Open group info modal and sync latest conversation details
  const handleOpenGroupInfo = async () => {
    setGroupInfoOpen(true);
    try {
      const response = await api.get('/conversations');
      const list = Array.isArray(response.data) ? response.data : [];
      setConversations(list);
      const activeId = selectedConversationRef.current?._id?.toString();
      if (activeId) {
        const fresh = list.find((c) => (c._id || c.id)?.toString() === activeId);
        if (fresh) {
          setSelectedConversation((prev) =>
            prev ? { ...fresh, unreadCount: prev.unreadCount || 0 } : fresh
          );
        }
      }
    } catch (error) {
      console.error('Failed to refresh group info:', error);
    }
  };

  // Toggle pin state for a conversation
  const handleTogglePin = async (conversation) => {
    try {
      const response = await api.put(`/conversations/${conversation._id}/pin`);
      const isPinned = Boolean(response.data?.isPinned);
      setConversations((prev) =>
        prev.map((c) => (c._id === conversation._id ? { ...c, isPinned } : c))
      );
      setSelectedConversation((prev) =>
        prev && prev._id === conversation._id ? { ...prev, isPinned } : prev
      );
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to pin chat');
    }
  };

  // Toggle mute state for a conversation
  const handleToggleMute = async (conversation) => {
    try {
      const response = await api.put(`/conversations/${conversation._id}/mute`);
      const isMuted = Boolean(response.data?.isMuted);
      setConversations((prev) =>
        prev.map((c) => (c._id === conversation._id ? { ...c, isMuted } : c))
      );
      setSelectedConversation((prev) =>
        prev && prev._id === conversation._id ? { ...prev, isMuted } : prev
      );
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to mute chat');
    }
  };

  // Update logged-in user state and localStorage after profile edits
  const handleUserChange = (updatedUser) => {
    if (!updatedUser) return;
    setCurrentUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  // Open another user's profile popup (never for current user)
  const handleOpenUserProfile = (userId) => {
    if (!userId || userId.toString() === currentUser?._id?.toString()) return;
    setProfileUserId(userId.toString());
  };

  // Start or open a 1-to-1 chat from UserProfileModal and close popups
  const handleMessageUser = async (userId) => {
    try {
      const response = await api.post('/conversations', { userId });
      handleSelectConversation(response.data);
      setProfileUserId(null);
      setGroupInfoOpen(false);
      setAddMembersOpen(false);
    } catch (error) {
      showToast(error.response?.data?.message || 'Something went wrong');
    }
  };

  // handle user logout
  const handleLogout = () => {
    disconnectSocket();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const profileConversation = profileUserId
    ? conversations.find(
        (c) =>
          !c.isGroup &&
          (c.members || []).some((m) => (m?._id || m)?.toString() === profileUserId)
      ) || null
    : null;

  return (
    <div
      className={`home-chat-layout ${selectedConversation ? 'chat-is-selected' : ''}`}
    >
      {/* Left Sidebar */}
      <div className="home-sidebar-panel">
        <Sidebar
          conversations={conversations}
          selectedConversation={selectedConversation}
          onSelectConversation={handleSelectConversation}
          onOpenNewChat={() => setIsNewChatOpen(true)}
          onOpenNewGroup={() => setIsNewGroupOpen(true)}
          currentUser={currentUser}
          onlineUserIds={onlineUserIds}
          onLogout={handleLogout}
          soundOn={soundOn}
          onToggleSound={handleToggleSound}
          onTogglePin={handleTogglePin}
          onToggleMute={handleToggleMute}
          onOpenMyProfile={() => setMyProfileOpen(true)}
          socketStatus={socketStatus}
        />
      </div>

      {/* Right Chat Window */}
      <div className="home-chat-panel">
        <ChatWindow
          key={selectedConversation?._id || 'empty'}
          selectedConversation={selectedConversation}
          messages={messages}
          currentUser={currentUser}
          onlineUserIds={onlineUserIds}
          lastSeenMap={lastSeenMap}
          onSendMessage={handleSendMessage}
          onBack={() => setSelectedConversation(null)}
          onDeleteChat={handleDeleteChat}
          onOpenGroupInfo={handleOpenGroupInfo}
          onOpenUserProfile={handleOpenUserProfile}
          hasMore={hasMore}
          loadingOlder={loadingOlder}
          onLoadOlder={loadOlderMessages}
          highlightedMsgId={highlightedMsgId}
          onScrollToMessage={scrollToMessage}
          socket={socketRef.current}
          onNotify={showToast}
          typingUser={
            selectedConversation && typingInfo?.conversationId === selectedConversation._id
              ? typingInfo.name
              : null
          }
        />
      </div>

      {/* New 1-to-1 Chat Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onSelectConversation={handleSelectConversation}
        onNotify={showToast}
      />

      {/* New Group Chat Modal */}
      <NewGroupModal
        isOpen={isNewGroupOpen}
        onClose={() => setIsNewGroupOpen(false)}
        onSelectConversation={handleSelectConversation}
      />

      {/* Group Info Modal */}
      {groupInfoOpen && selectedConversation?.isGroup && (
        <GroupInfoModal
          conversation={selectedConversation}
          myId={currentUser?._id}
          onlineUserIds={onlineUserIds}
          onClose={() => setGroupInfoOpen(false)}
          onLeave={() => handleLeaveGroup(selectedConversation._id)}
          onOpenAddMembers={() => setAddMembersOpen(true)}
          onOpenUserProfile={handleOpenUserProfile}
          onNotify={showToast}
        />
      )}

      {/* Add Members Modal */}
      {addMembersOpen && selectedConversation?.isGroup && (
        <AddMembersModal
          isOpen={addMembersOpen}
          conversation={selectedConversation}
          onClose={() => setAddMembersOpen(false)}
          onNotify={showToast}
        />
      )}

      {/* My Profile Modal */}
      {myProfileOpen && currentUser && (
        <MyProfileModal
          user={currentUser}
          onClose={() => setMyProfileOpen(false)}
          onUserChange={handleUserChange}
        />
      )}

      {/* Other User Profile Modal */}
      {profileUserId && profileUserId !== currentUser?._id?.toString() && (
        <UserProfileModal
          userId={profileUserId}
          conversation={profileConversation}
          onlineUserIds={onlineUserIds}
          lastSeenMap={lastSeenMap}
          isMuted={Boolean(profileConversation?.isMuted)}
          onMessage={handleMessageUser}
          onToggleMute={handleToggleMute}
          onClose={() => setProfileUserId(null)}
          onNotify={showToast}
        />
      )}

      {/* Global Toast Banner */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

export default Home;
