/**
 * Utility functions for Sam Pinkelman World
 * Handles image compression, validation, and UI helpers
 */

class Utils {
    
    /**
     * Compress an image file to be under 2MB while maintaining quality
     * @param {File} file - The image file to compress
     * @param {number} maxSizeMB - Maximum file size in MB (default: 2)
     * @param {number} maxDimension - Maximum width/height in pixels (default: 4096)
     * @returns {Promise<Blob>} - Compressed image blob
     */
    static async compressImage(file, maxSizeMB = 2, maxDimension = 4096) {
        return new Promise((resolve, reject) => {
            // Create image object to get dimensions
            const img = new Image();
            
            img.onload = async () => {
                try {
                    // Calculate new dimensions maintaining aspect ratio
                    let { width, height } = img;
                    const aspectRatio = width / height;
                    
                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            width = maxDimension;
                            height = maxDimension / aspectRatio;
                        } else {
                            height = maxDimension;
                            width = maxDimension * aspectRatio;
                        }
                    }
                    
                    // Create canvas for compression
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // Draw image with high quality
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Start with high quality and reduce until size is acceptable
                    let quality = 0.9;
                    const maxBytes = maxSizeMB * 1024 * 1024;
                    
                    const tryCompress = () => {
                        canvas.toBlob((blob) => {
                            if (!blob) {
                                reject(new Error('Failed to compress image'));
                                return;
                            }
                            
                            if (blob.size <= maxBytes || quality <= 0.1) {
                                resolve(blob);
                            } else {
                                quality -= 0.1;
                                tryCompress();
                            }
                        }, file.type, quality);
                    };
                    
                    tryCompress();
                    
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            
            // Create object URL from file
            img.src = URL.createObjectURL(file);
        });
    }
    
    /**
     * Validate if a file is a valid image
     * @param {File} file - File to validate
     * @returns {boolean} - True if valid image
     */
    static isValidImage(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        return validTypes.includes(file.type.toLowerCase());
    }
    
    /**
     * Validate if a file is a valid PDF
     * @param {File} file - File to validate
     * @returns {boolean} - True if valid PDF
     */
    static isValidPDF(file) {
        return file.type === 'application/pdf';
    }
    
    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} - Formatted file size
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    /**
     * Create a blob URL and track it for cleanup
     * @param {Blob} blob - Blob to create URL for
     * @returns {string} - Object URL
     */
    static createObjectURL(blob) {
        const url = URL.createObjectURL(blob);
        
        // Track URLs for cleanup (store in a Set on the Utils class)
        if (!Utils._objectURLs) {
            Utils._objectURLs = new Set();
        }
        Utils._objectURLs.add(url);
        
        return url;
    }
    
    /**
     * Revoke an object URL
     * @param {string} url - Object URL to revoke
     */
    static revokeObjectURL(url) {
        if (url && Utils._objectURLs && Utils._objectURLs.has(url)) {
            URL.revokeObjectURL(url);
            Utils._objectURLs.delete(url);
        }
    }
    
    /**
     * Clean up all tracked object URLs
     */
    static cleanupObjectURLs() {
        if (Utils._objectURLs) {
            Utils._objectURLs.forEach(url => {
                URL.revokeObjectURL(url);
            });
            Utils._objectURLs.clear();
        }
    }
    
    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type of toast ('success', 'error', 'info')
     * @param {number} duration - Duration in milliseconds (default: 3000)
     */
    static showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Remove toast after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration);
    }
    
    /**
     * Show a confirmation dialog
     * @param {string} message - Confirmation message
     * @param {string} title - Dialog title (optional)
     * @returns {Promise<boolean>} - True if confirmed
     */
    static showConfirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const titleEl = document.getElementById('confirm-title');
            const messageEl = document.getElementById('confirm-message');
            const yesBtn = document.getElementById('confirm-yes');
            const noBtn = document.getElementById('confirm-no');
            
            titleEl.textContent = title;
            messageEl.textContent = message;
            
            const cleanup = () => {
                modal.classList.remove('show');
                yesBtn.onclick = null;
                noBtn.onclick = null;
            };
            
            yesBtn.onclick = () => {
                cleanup();
                resolve(true);
            };
            
            noBtn.onclick = () => {
                cleanup();
                resolve(false);
            };
            
            modal.classList.add('show');
        });
    }
    
    /**
     * Show a modal by ID
     * @param {string} modalId - ID of modal to show
     */
    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            
            // Focus trap for accessibility
            const focusableElements = modal.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            
            if (focusableElements.length > 0) {
                focusableElements[0].focus();
            }
        }
    }
    
    /**
     * Hide a modal by ID
     * @param {string} modalId - ID of modal to hide
     */
    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in milliseconds
     * @returns {Function} - Debounced function
     */
    static debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Generate a seeded random number for consistent album covers
     * @param {number} seed - Seed value
     * @returns {number} - Random number between 0 and 1
     */
    static seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }
    
    /**
     * Select a random item from an array using seeded random
     * @param {Array} array - Array to select from
     * @param {number} seed - Seed for random selection
     * @returns {*} - Selected item
     */
    static seededRandomChoice(array, seed) {
        if (!array || array.length === 0) return null;
        const index = Math.floor(Utils.seededRandom(seed) * array.length);
        return array[index];
    }
    
    /**
     * Download data as a file
     * @param {*} data - Data to download (will be JSON stringified)
     * @param {string} filename - Name of the file
     * @param {string} mimeType - MIME type of the file
     */
    static downloadAsFile(data, filename, mimeType = 'application/json') {
        const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], {
            type: mimeType
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * Read a file as text
     * @param {File} file - File to read
     * @returns {Promise<string>} - File contents as text
     */
    static readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
    /**
     * Hash a string using SHA-256 (for client-side password hashing)
     * Note: This is NOT secure - it's just to avoid storing plain text
     * @param {string} text - Text to hash
     * @returns {Promise<string>} - Hex hash string
     */
    static async hashString(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Set up drag and drop functionality
     * @param {HTMLElement} container - Container element
     * @param {Function} onFilesDropped - Callback when files are dropped
     * @param {Array<string>} acceptedTypes - Array of accepted MIME types
     */
    static setupDragAndDrop(container, onFilesDropped, acceptedTypes = ['image/*']) {
        let dragCounter = 0;
        
        const handleDragEnter = (e) => {
            e.preventDefault();
            dragCounter++;
            container.classList.add('drag-over');
        };
        
        const handleDragLeave = (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                container.classList.remove('drag-over');
            }
        };
        
        const handleDragOver = (e) => {
            e.preventDefault();
        };
        
        const handleDrop = (e) => {
            e.preventDefault();
            dragCounter = 0;
            container.classList.remove('drag-over');
            
            const files = Array.from(e.dataTransfer.files).filter(file => {
                return acceptedTypes.some(type => {
                    if (type.endsWith('/*')) {
                        return file.type.startsWith(type.replace('/*', '/'));
                    }
                    return file.type === type;
                });
            });
            
            if (files.length > 0) {
                onFilesDropped(files);
            }
        };
        
        container.addEventListener('dragenter', handleDragEnter);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);
        
        // Return cleanup function
        return () => {
            container.removeEventListener('dragenter', handleDragEnter);
            container.removeEventListener('dragleave', handleDragLeave);
            container.removeEventListener('dragover', handleDragOver);
            container.removeEventListener('drop', handleDrop);
        };
    }
    
    /**
     * Set up sortable functionality for reordering items
     * @param {HTMLElement} container - Container element
     * @param {Function} onReorder - Callback when items are reordered
     * @param {string} itemSelector - CSS selector for draggable items
     */
    static setupSortable(container, onReorder, itemSelector = '.sortable-item') {
        let draggedElement = null;
        let placeholder = null;
        
        const handleMouseDown = (e) => {
            const item = e.target.closest(itemSelector);
            if (!item) return;
            
            draggedElement = item;
            
            // Create placeholder
            placeholder = document.createElement('div');
            placeholder.className = 'sort-placeholder';
            placeholder.style.height = item.offsetHeight + 'px';
            
            // Set draggable
            item.draggable = true;
            item.classList.add('dragging');
        };
        
        const handleDragStart = (e) => {
            if (!draggedElement) return;
            e.dataTransfer.effectAllowed = 'move';
        };
        
        const handleDragOver = (e) => {
            e.preventDefault();
            if (!draggedElement || !placeholder) return;
            
            const afterElement = getDragAfterElement(container, e.clientY);
            
            if (afterElement == null) {
                container.appendChild(placeholder);
            } else {
                container.insertBefore(placeholder, afterElement);
            }
        };
        
        const handleDrop = (e) => {
            e.preventDefault();
            if (!draggedElement || !placeholder) return;
            
            // Replace placeholder with dragged element
            container.insertBefore(draggedElement, placeholder);
            cleanup();
            
            // Get new order
            const items = Array.from(container.querySelectorAll(itemSelector));
            const newOrder = items.map(item => item.dataset.id).filter(Boolean);
            onReorder(newOrder);
        };
        
        const cleanup = () => {
            if (draggedElement) {
                draggedElement.draggable = false;
                draggedElement.classList.remove('dragging');
                draggedElement = null;
            }
            
            if (placeholder && placeholder.parentNode) {
                placeholder.parentNode.removeChild(placeholder);
                placeholder = null;
            }
        };
        
        const getDragAfterElement = (container, y) => {
            const draggableElements = [...container.querySelectorAll(`${itemSelector}:not(.dragging)`)];
            
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        };
        
        container.addEventListener('mousedown', handleMouseDown);
        container.addEventListener('dragstart', handleDragStart);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);
        container.addEventListener('dragend', cleanup);
        
        // Return cleanup function
        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            container.removeEventListener('dragstart', handleDragStart);
            container.removeEventListener('dragover', handleDragOver);
            container.removeEventListener('drop', handleDrop);
            container.removeEventListener('dragend', cleanup);
        };
    }
    
    /**
     * Set up keyboard navigation for accessibility
     * @param {HTMLElement} container - Container element
     * @param {string} itemSelector - CSS selector for navigable items
     */
    static setupKeyboardNavigation(container, itemSelector) {
        const handleKeyDown = (e) => {
            const items = container.querySelectorAll(itemSelector);
            const currentIndex = Array.from(items).indexOf(document.activeElement);
            
            let newIndex = currentIndex;
            
            switch (e.key) {
                case 'ArrowUp':
                case 'ArrowLeft':
                    e.preventDefault();
                    newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                    break;
                    
                case 'ArrowDown':
                case 'ArrowRight':
                    e.preventDefault();
                    newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                    break;
                    
                case 'Home':
                    e.preventDefault();
                    newIndex = 0;
                    break;
                    
                case 'End':
                    e.preventDefault();
                    newIndex = items.length - 1;
                    break;
                    
                default:
                    return;
            }
            
            if (items[newIndex]) {
                items[newIndex].focus();
            }
        };
        
        container.addEventListener('keydown', handleKeyDown);
        
        return () => {
            container.removeEventListener('keydown', handleKeyDown);
        };
    }
}

// Export Utils for use in other modules
window.Utils = Utils;