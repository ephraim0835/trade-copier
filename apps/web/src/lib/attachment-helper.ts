/**
 * Attachment processing helper for support messaging
 * Handles fast client-side image optimization, data URL conversion, and size limits.
 */

export interface AttachmentPayload {
  url: string;
  name: string;
  type: string;
  size: number;
}

export async function processFileAttachment(file: File): Promise<AttachmentPayload> {
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('File exceeds maximum size limit of 10MB.');
  }

  // If it's a JPEG or PNG larger than 1MB, optimize via canvas to keep sub-second sync speed
  if (file.type.startsWith('image/') && file.size > 1024 * 1024 && typeof document !== 'undefined') {
    try {
      const optimizedUrl = await compressImage(file, 1920, 1080, 0.85);
      return {
        url: optimizedUrl,
        name: file.name,
        type: file.type || 'image/jpeg',
        size: Math.round(optimizedUrl.length * 0.75),
      };
    } catch {
      // Fallback to standard data URL
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        url: reader.result as string,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
      });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

function compressImage(file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(outputType, quality);
      resolve(dataUrl);
    };
    img.onerror = reject;
  });
}
