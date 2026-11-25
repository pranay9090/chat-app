// Crop center square and resize image to a base64 JPEG data URL
export const resizeImage = (file, size = 200) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const side = Math.min(image.width, image.height);
        const x = (image.width - side) / 2;
        const y = (image.height - side) / 2;
        canvas.getContext('2d').drawImage(image, x, y, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      image.onerror = () => reject(new Error('Invalid image'));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
};
