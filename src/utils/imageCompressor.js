/**
 * Compresses an image file using the HTML Canvas API to reduce storage size.
 *
 * @param {File} file          The image file to compress
 * @param {number} maxWidth    Maximum width of the compressed image (default: 1024)
 * @param {number} maxHeight   Maximum height of the compressed image (default: 1024)
 * @param {number} quality     Compression quality from 0 to 1 (default: 0.7)
 * @returns {Promise<File>}    A promise that resolves with the compressed File object
 */
export async function compressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.7) {
    if (!file || !file.type.startsWith('image/')) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate the new dimensions while preserving aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height *= maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width *= maxHeight / height));
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Re-encode keeping it as JPEG/WebP to ensure size reduction 
                // Using WebP yields better compression where supported, falling back to jpeg
                const mimeType = file.type === 'image/png' ? 'image/png' : 'image/webp';

                canvas.toBlob((blob) => {
                    if (blob) {
                        // Create a new File object from the compressed blob
                        const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + (mimeType === 'image/webp' ? '.webp' : '.png'), {
                            type: mimeType,
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    } else {
                        resolve(file); // Fallback to original if export fails
                    }
                }, mimeType, quality);
            };

            img.onerror = (err) => reject(err);
        };

        reader.onerror = (err) => reject(err);
    });
}
