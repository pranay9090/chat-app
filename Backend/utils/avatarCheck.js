// Validate avatar base64 data URL or empty string
export const isValidAvatar = (avatar) => {
  if (avatar === '') return true;
  return typeof avatar === 'string' && avatar.startsWith('data:image/') && avatar.length < 100000;
};
