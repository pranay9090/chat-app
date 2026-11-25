import './Avatar.css';

const AVATAR_TONES = ['indigo', 'emerald', 'amber', 'rose', 'violet'];

// Deterministic hash mapping user id or name to one of the 5 avatar token pairs
export const getAvatarTone = (seed) => {
  const str = (seed || '?').toString().trim();
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  const tone = AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
  return {
    bg: `var(--avatar-${tone}-bg)`,
    fg: `var(--avatar-${tone}-fg)`,
  };
};

// Avatar component with deterministic colors, optional photo src, and online dot
function Avatar({ name, src, seed, size = 40, isOnline = false, isGroup = false }) {
  const initial = name && name.trim().length > 0 ? name.trim().charAt(0).toUpperCase() : '?';
  const label = name || (isGroup ? 'Group' : 'User');
  const tone = getAvatarTone(seed || name);

  return (
    <div
      className="custom-avatar-wrapper"
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={label}
          title={label}
          className="custom-avatar-img"
          style={{
            width: `${size}px`,
            height: `${size}px`,
          }}
        />
      ) : (
        <div
          className={`custom-avatar ${isGroup ? 'group-avatar' : ''}`}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            fontSize: `${Math.round(size * 0.42)}px`,
            backgroundColor: tone.bg,
            color: tone.fg,
          }}
          title={label}
        >
          {initial}
        </div>
      )}

      {!isGroup && isOnline && <span className="avatar-online-badge" />}
    </div>
  );
}

export default Avatar;
