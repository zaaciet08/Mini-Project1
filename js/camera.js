/**
 * camera.js - Offline Photo Capture & Compression Module
 * Handles camera capture, gallery selection, downsampling/compression via Canvas,
 * and base64 storage for IndexedDB.
 */

const MAX_IMAGE_WIDTH = 1200;
const MAX_IMAGE_HEIGHT = 1200;
const JPEG_QUALITY = 0.82;

/**
 * Compress an image file using an in-memory Canvas
 * Returns Promise<{ dataUrl, blob, width, height, sizeBytes, name }>
 */
export function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('File không phải là định dạng hình ảnh hợp lệ.'));
    }

    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio preserving dimensions
        if (width > MAX_IMAGE_WIDTH || height > MAX_IMAGE_HEIGHT) {
          if (width > height) {
            height = Math.round((height * MAX_IMAGE_WIDTH) / width);
            width = MAX_IMAGE_WIDTH;
          } else {
            width = Math.round((width * MAX_IMAGE_HEIGHT) / height);
            height = MAX_IMAGE_HEIGHT;
          }
        }

        // Draw to offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Optional: Draw subtle watermark timestamp for field audit
        ctx.drawImage(img, 0, 0, width, height);

        // Watermark text in bottom corner
        const timestampStr = new Date().toLocaleString('vi-VN');
        ctx.save();
        ctx.font = 'bold 16px -apple-system, sans-serif';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(10, height - 36, 260, 26);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`VKU Audit: ${timestampStr}`, 18, height - 18);
        ctx.restore();

        // Convert to optimized JPEG dataUrl
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

        // Convert to Blob
        canvas.toBlob((blob) => {
          resolve({
            id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            dataUrl,
            blob,
            width,
            height,
            sizeBytes: blob ? blob.size : file.size,
            name: file.name || `photo_${Date.now()}.jpg`,
            timestamp: new Date().toISOString()
          });
        }, 'image/jpeg', JPEG_QUALITY);
      };

      img.onerror = (err) => reject(err);
      img.src = readerEvent.target.result;
    };

    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Direct Live Video Stream Camera modal (for interactive desktop or web view)
 */
export class LiveCamera {
  constructor(videoElement, canvasElement) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.stream = null;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      if (this.video) {
        this.video.srcObject = this.stream;
        await this.video.play();
      }
      return true;
    } catch (err) {
      console.warn('[Camera] Live stream not available, fallback to file input:', err);
      return false;
    }
  }

  capture() {
    if (!this.video || !this.canvas || !this.stream) return null;
    const width = this.video.videoWidth || 640;
    const height = this.video.videoHeight || 480;

    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0, width, height);

    const dataUrl = this.canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return {
      id: 'photo_' + Date.now(),
      dataUrl,
      timestamp: new Date().toISOString()
    };
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }
}
