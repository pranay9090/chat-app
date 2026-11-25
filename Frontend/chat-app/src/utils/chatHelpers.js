// ============================================================================
// Chat Helper Utilities
// Functions to identify members, format chat titles, and format timestamps
// ============================================================================

/**
 * Identifies the other participant in a 1-to-1 conversation.
 * Since `conversation.members` contains both participants, we pick the user
 * whose `_id` is NOT the currently logged-in user's ID.
 *
 * @param {Object} conversation - The conversation object with populated members
 * @param {string} currentUserId - The ID of the currently logged-in user
 * @returns {Object|null} The other user's member object
 */
export const getOtherMember = (conversation, currentUserId) => {
  if (!conversation || !conversation.members || !Array.isArray(conversation.members)) {
    return null;
  }

  // Find the member whose ID does not match currentUserId
  const otherMember = conversation.members.find(
    (member) => (member?._id || member)?.toString() !== currentUserId?.toString()
  );

  return otherMember || null;
};

/**
 * Returns the display name for a conversation.
 * For group chats, returns the group name.
 * For 1-to-1 chats, returns the other person's name.
 *
 * @param {Object} conversation - The conversation object
 * @param {string} currentUserId - The ID of the currently logged-in user
 * @returns {string} The chat display name
 */
export const getChatName = (conversation, currentUserId) => {
  if (!conversation) return 'Chat';

  // If this is a group chat, return the group's name
  if (conversation.isGroup) {
    return conversation.name || 'Group Chat';
  }

  // For 1-to-1 chats, return the other member's name
  const otherMember = getOtherMember(conversation, currentUserId);
  return otherMember?.name || 'Chat';
};

/**
 * Returns the name used for avatar letter extraction.
 *
 * @param {Object} conversation - The conversation object
 * @param {string} currentUserId - The ID of the currently logged-in user
 * @returns {string} The name for the avatar
 */
export const getChatAvatarName = (conversation, currentUserId) => {
  if (!conversation) return '?';

  if (conversation.isGroup) {
    return conversation.name || 'G';
  }

  const otherMember = getOtherMember(conversation, currentUserId);
  return otherMember?.name || '?';
};

// Return photo URL for a group or the other user in a 1-to-1 chat
export const getChatAvatar = (conversation, currentUserId) => {
  if (!conversation) return '';
  if (conversation.isGroup) return conversation.avatar || '';
  const otherMember = getOtherMember(conversation, currentUserId);
  return otherMember?.avatar || '';
};

/**
 * Formats a Date or ISO timestamp for the sidebar:
 * - "10:42 AM" if from today
 * - "Yesterday" if from yesterday
 * - "Nov 20" for older dates
 *
 * @param {string|Date} dateString - The timestamp to format
 * @returns {string} Formatted sidebar time label
 */
export const formatSidebarTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();

  // Check if today
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Yesterday';
  }

  // Older: short date e.g. "Nov 20"
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Returns a friendly date label for message separators ("Today", "Yesterday", or "Nov 20").
 *
 * @param {string|Date} dateString - The timestamp to format
 * @returns {string} Date separator label
 */
export const getDateSeparatorLabel = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return 'Today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Checks if two timestamps fall on different calendar days.
 *
 * @param {string|Date} date1
 * @param {string|Date} date2
 * @returns {boolean}
 */
export const isDifferentDay = (date1, date2) => {
  if (!date2) return true;
  if (!date1) return false;

  const d1 = new Date(date1);
  const d2 = new Date(date2);

  return (
    d1.getDate() !== d2.getDate() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getFullYear() !== d2.getFullYear()
  );
};

/**
 * Formats a Date or ISO timestamp into a short readable time like "10:42 AM".
 *
 * @param {string|Date} dateString - The timestamp to format
 * @returns {string} Formatted short time
 */
export const formatMessageTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Returns true if user id is in conversation.admins
export const isAdmin = (conversation, myId) => {
  if (!conversation || !myId || !Array.isArray(conversation.admins)) return false;
  return conversation.admins.some(
    (id) => (id?._id || id)?.toString() === myId.toString()
  );
};

// Format user lastSeen timestamp for 1-to-1 chat header
export const formatLastSeen = (dateString) => {
  if (!dateString) return 'Offline';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Offline';

  const timeStr = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return `Last seen today at ${timeStr}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return `Last seen yesterday at ${timeStr}`;

  const dateStr = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  return `Last seen ${dateStr} at ${timeStr}`;
};

// Format date/time for search results
export const formatSearchTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const timeStr = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return timeStr;

  const dateStr = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  return `${dateStr}, ${timeStr}`;
};
