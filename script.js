// IndexedDB Storage Manager
class IndexedDBStorage {
    constructor() {
        this.dbName = 'PortfolioStorage';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object stores
                if (!db.objectStoreNames.contains('albums')) {
                    db.createObjectStore('albums', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('essays')) {
                    db.createObjectStore('essays', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    async save(storeName, data) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put({ id: storeName, data: data });
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async load(storeName) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(storeName);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                resolve(request.result ? request.result.data : null);
            };
        });
    }

    async getStorageSize() {
        if (!this.db) await this.init();
        
        try {
            if (navigator.storage && navigator.storage.estimate) {
                const estimate = await navigator.storage.estimate();
                const usedMB = (estimate.usage / 1024 / 1024).toFixed(2);
                const quotaMB = (estimate.quota / 1024 / 1024).toFixed(2);
                return { used: usedMB, quota: quotaMB, available: quotaMB - usedMB };
            }
        } catch (error) {
            console.log('Storage estimate not available');
        }
        return null;
    }

    async clear() {
        if (!this.db) await this.init();
        
        const storeNames = ['albums', 'essays', 'settings'];
        const promises = storeNames.map(storeName => {
            return new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        });
        
        return Promise.all(promises);
    }
}

class PortfolioApp {
    constructor() {
        this.currentAlbum = null;
        this.currentPhotoIndex = 0;
        this.albums = [];
        this.essays = [];
        this.draggedElement = null;
        this.contextMenuTarget = null;
        this.storage = new IndexedDBStorage();
        this.isInitialized = false;
        this.init();
    }

    async init() {
        try {
            // Setup event listeners first so UI is responsive immediately
            this.setupEventListeners();
            
            // Initialize IndexedDB
            await this.storage.init();
            
            // Load data
            await this.loadData();
            
            // Setup UI
            this.renderAlbums();
            this.renderEssays();
            
            // Mark as initialized
            this.isInitialized = true;
            
            // Log storage info
            const storageInfo = await this.storage.getStorageSize();
            if (storageInfo) {
                console.log(`Storage: ${storageInfo.used}MB used of ${storageInfo.quota}MB (${storageInfo.available}MB available)`);
            }
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            // Fallback to empty state
            this.albums = [];
            this.essays = [];
            this.setupEventListeners();
            this.renderAlbums();
            this.renderEssays();
            this.isInitialized = true;
        }
    }

    async loadData() {
        try {
            const loadedAlbums = await this.storage.load('albums');
            const loadedEssays = await this.storage.load('essays');
            
            this.albums = loadedAlbums || [];
            this.essays = loadedEssays || [];
            
            console.log('Loaded data from IndexedDB');
        } catch (error) {
            console.error('Error loading data:', error);
            this.albums = [];
            this.essays = [];
        }
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.showTab(e.target.dataset.tab);
            });
        });

        // My Info modal
        document.getElementById('my-info-btn').addEventListener('click', () => {
            this.showInfoModal();
        });

        document.getElementById('info-modal-close').addEventListener('click', () => {
            this.hideInfoModal();
        });

        // Album creation
        document.querySelector('.create-album-card').addEventListener('click', () => {
            this.showAlbumNameModal();
        });

        document.getElementById('create-album-btn').addEventListener('click', async () => {
            await this.createAlbum();
        });

        document.getElementById('cancel-album-btn').addEventListener('click', () => {
            this.hideAlbumNameModal();
        });

        // Gallery navigation
        document.getElementById('back-to-albums').addEventListener('click', () => {
            this.showAlbumsView();
        });

        document.getElementById('add-photos-btn').addEventListener('click', () => {
            document.getElementById('photo-upload').click();
        });

        // Photo upload
        document.getElementById('photo-upload').addEventListener('change', (e) => {
            this.handlePhotoUpload(e);
        });

        // Essay upload
        document.querySelector('.add-essay-card').addEventListener('click', () => {
            document.getElementById('essay-upload').click();
        });

        document.getElementById('essay-upload').addEventListener('change', (e) => {
            this.handleEssayUpload(e);
        });

        // Lightbox
        document.getElementById('lightbox-close').addEventListener('click', () => {
            this.hideLightbox();
        });

        document.getElementById('lightbox-prev').addEventListener('click', () => {
            this.showPrevPhoto();
        });

        document.getElementById('lightbox-next').addEventListener('click', () => {
            this.showNextPhoto();
        });

        // Essay reader
        document.getElementById('essay-close-btn').addEventListener('click', () => {
            this.hideEssayReader();
        });

        // Context menu
        document.getElementById('rename-item').addEventListener('click', () => {
            this.handleRename();
        });

        document.getElementById('delete-item').addEventListener('click', () => {
            this.handleDelete();
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            this.handleKeyNavigation(e);
        });

        // Modal click outside to close
        document.getElementById('lightbox-modal').addEventListener('click', (e) => {
            if (e.target.id === 'lightbox-modal') this.hideLightbox();
        });

        document.getElementById('info-modal').addEventListener('click', (e) => {
            if (e.target.id === 'info-modal') this.hideInfoModal();
        });

        document.getElementById('album-name-modal').addEventListener('click', (e) => {
            if (e.target.id === 'album-name-modal') this.hideAlbumNameModal();
        });

        document.getElementById('essay-reader-modal').addEventListener('click', (e) => {
            if (e.target.id === 'essay-reader-modal') this.hideEssayReader();
        });

        // Album name input enter key
        document.getElementById('album-name-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.createAlbum();
        });

        // Context menu handling
        document.addEventListener('click', () => {
            this.hideContextMenu();
        });

        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    showTab(tabName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        // If showing photos tab and not initialized yet, render albums when ready
        if (tabName === 'photos' && !this.isInitialized) {
            const checkInit = () => {
                if (this.isInitialized) {
                    this.renderAlbums();
                } else {
                    setTimeout(checkInit, 100);
                }
            };
            checkInit();
        }
    }

    // Album Management
    renderAlbums() {
        const albumGrid = document.getElementById('album-grid');
        if (!albumGrid) {
            console.error('Album grid element not found');
            return;
        }
        
        const createCard = albumGrid.querySelector('.create-album-card');
        
        // Clear existing albums but keep create card
        albumGrid.innerHTML = '';
        if (createCard) {
            albumGrid.appendChild(createCard);
        }

        // Safety check for albums array
        if (this.albums && Array.isArray(this.albums)) {
            this.albums.forEach((album, index) => {
                const albumCard = this.createAlbumCard(album, index);
                albumGrid.appendChild(albumCard);
            });

            this.setupAlbumDragAndDrop();
        }
    }

    createAlbumCard(album, index) {
        const card = document.createElement('div');
        card.className = 'album-card glass-card';
        card.draggable = true;
        card.dataset.albumIndex = index;

        const coverImage = album.photos.length > 0 
            ? album.photos[0]
            : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjY2NjIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFBob3RvczwvdGV4dD4KICA8L3N2Zz4=';

        card.innerHTML = `
            <img src="${coverImage}" alt="${album.name}" class="album-cover">
            <div class="album-actions">
                <button class="album-rename-btn" title="Rename Album">✏️</button>
                <button class="album-delete-btn" title="Delete Album">🗑️</button>
            </div>
            <div class="album-title">
                <span class="album-name">${album.name}</span>
                <input type="text" class="album-name-edit hidden" value="${album.name}">
            </div>
        `;

        // Event listeners
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.album-actions')) {
                this.openAlbum(index);
            }
        });

        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, 'album', index);
        });

        // Action buttons
        const renameBtn = card.querySelector('.album-rename-btn');
        const deleteBtn = card.querySelector('.album-delete-btn');

        renameBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startRenameAlbum(index);
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteAlbum(index);
        });

        // Rename functionality
        const nameSpan = card.querySelector('.album-name');
        const nameEdit = card.querySelector('.album-name-edit');

        nameSpan.addEventListener('click', (e) => {
            e.stopPropagation();
            this.startRenameAlbum(index);
        });

        nameEdit.addEventListener('blur', () => {
            this.finishRenameAlbum(index, nameEdit.value);
        });

        nameEdit.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') nameEdit.blur();
            if (e.key === 'Escape') this.cancelRenameAlbum(index);
        });

        nameEdit.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        return card;
    }

    setupAlbumDragAndDrop() {
        const albumCards = document.querySelectorAll('.album-card[data-album-index]');
        
        albumCards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                this.draggedElement = card;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.draggedElement = null;
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            card.addEventListener('dragenter', (e) => {
                e.preventDefault();
                card.classList.add('drag-over');
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', async (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                
                if (this.draggedElement && this.draggedElement !== card) {
                    const fromIndex = parseInt(this.draggedElement.dataset.albumIndex);
                    const toIndex = parseInt(card.dataset.albumIndex);
                    
                    if (!isNaN(fromIndex) && !isNaN(toIndex) && typeof this.reorderAlbums === 'function') {
                        try {
                            await this.reorderAlbums(fromIndex, toIndex);
                        } catch (error) {
                            console.error('Error reordering albums:', error);
                        }
                    }
                }
            });
        });
    }

    async reorderAlbums(fromIndex, toIndex) {
        const [movedAlbum] = this.albums.splice(fromIndex, 1);
        this.albums.splice(toIndex, 0, movedAlbum);
        await this.saveToStorage('albums', this.albums);
        this.renderAlbums();
    }

    showAlbumNameModal() {
        document.getElementById('album-name-modal').style.display = 'block';
        document.getElementById('album-name-input').focus();
    }

    hideAlbumNameModal() {
        document.getElementById('album-name-modal').style.display = 'none';
        document.getElementById('album-name-input').value = '';
    }

    async createAlbum() {
        const name = document.getElementById('album-name-input').value.trim();
        if (name) {
            this.albums.push({ 
                id: Date.now().toString(),
                name, 
                photos: [] 
            });
            await this.saveToStorage('albums', this.albums);
            this.renderAlbums();
            this.hideAlbumNameModal();
        }
    }

    startRenameAlbum(index) {
        const albumCard = document.querySelector(`[data-album-index="${index}"]`);
        if (albumCard) {
            const nameSpan = albumCard.querySelector('.album-name');
            const nameEdit = albumCard.querySelector('.album-name-edit');
            
            nameSpan.classList.add('hidden');
            nameEdit.classList.remove('hidden');
            nameEdit.focus();
            nameEdit.select();
        }
    }

    finishRenameAlbum(index, newName) {
        if (newName.trim()) {
            this.albums[index].name = newName.trim();
            this.saveToStorage('albums', this.albums).catch(error => {
                console.error('Failed to save album name:', error);
            });
        }
        
        const albumCard = document.querySelector(`[data-album-index="${index}"]`);
        if (albumCard) {
            const nameSpan = albumCard.querySelector('.album-name');
            const nameEdit = albumCard.querySelector('.album-name-edit');
            
            nameSpan.textContent = this.albums[index].name;
            nameSpan.classList.remove('hidden');
            nameEdit.classList.add('hidden');
        }
    }

    cancelRenameAlbum(index) {
        const albumCard = document.querySelector(`[data-album-index="${index}"]`);
        if (albumCard) {
            const nameSpan = albumCard.querySelector('.album-name');
            const nameEdit = albumCard.querySelector('.album-name-edit');
            
            nameEdit.value = this.albums[index].name;
            nameSpan.classList.remove('hidden');
            nameEdit.classList.add('hidden');
        }
    }

    deleteAlbum(index) {
        const album = this.albums[index];
        const confirmDelete = confirm(`Are you sure you want to delete the album "${album.name}"? This will delete all ${album.photos.length} photos in the album. This action cannot be undone.`);
        
        if (confirmDelete) {
            this.albums.splice(index, 1);
            this.saveToStorage('albums', this.albums).catch(error => {
                console.error('Failed to save after album deletion:', error);
            });
            this.renderAlbums();
            
            if (this.currentAlbum === index) {
                this.showAlbumsView();
            } else if (this.currentAlbum > index) {
                this.currentAlbum--;
            }
        }
    }

    openAlbum(index) {
        this.currentAlbum = index;
        document.getElementById('gallery-title').textContent = this.albums[index].name;
        this.renderPhotos();
        this.showGalleryView();
    }

    showGalleryView() {
        document.querySelector('.photos-view').classList.add('hidden');
        document.getElementById('gallery-view').classList.remove('hidden');
    }

    showAlbumsView() {
        document.querySelector('.photos-view').classList.remove('hidden');
        document.getElementById('gallery-view').classList.add('hidden');
        this.currentAlbum = null;
    }

    // Photo Management
    renderPhotos() {
        const photoGrid = document.getElementById('photo-grid');
        photoGrid.innerHTML = '';

        if (this.currentAlbum !== null) {
            const album = this.albums[this.currentAlbum];
            album.photos.forEach((photo, index) => {
                const photoCard = this.createPhotoCard(photo, index);
                photoGrid.appendChild(photoCard);
            });
            this.setupPhotoDragAndDrop();
        }
    }

    createPhotoCard(photo, index) {
        const card = document.createElement('div');
        card.className = 'photo-card glass-card';
        card.draggable = true;
        card.dataset.photoIndex = index;

        card.innerHTML = `
            <img src="${photo}" alt="Photo ${index + 1}" class="photo-thumbnail">
            <div class="photo-actions">
                <button class="photo-delete-btn" title="Remove Photo">🗑️</button>
            </div>
        `;

        card.addEventListener('click', (e) => {
            if (!e.target.closest('.photo-actions')) {
                this.openLightbox(index);
            }
        });

        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, 'photo', index);
        });

        const deleteBtn = card.querySelector('.photo-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removePhoto(index);
        });

        return card;
    }

    setupPhotoDragAndDrop() {
        const photoCards = document.querySelectorAll('.photo-card[data-photo-index]');
        
        photoCards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                this.draggedElement = card;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.draggedElement = null;
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            card.addEventListener('dragenter', (e) => {
                e.preventDefault();
                card.classList.add('drag-over');
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', async (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                
                if (this.draggedElement && this.draggedElement !== card) {
                    const fromIndex = parseInt(this.draggedElement.dataset.photoIndex);
                    const toIndex = parseInt(card.dataset.photoIndex);
                    
                    if (!isNaN(fromIndex) && !isNaN(toIndex) && typeof this.reorderPhotos === 'function') {
                        try {
                            await this.reorderPhotos(fromIndex, toIndex);
                        } catch (error) {
                            console.error('Error reordering photos:', error);
                        }
                    }
                }
            });
        });
    }

    async reorderPhotos(fromIndex, toIndex) {
        if (this.currentAlbum !== null) {
            const album = this.albums[this.currentAlbum];
            const [movedPhoto] = album.photos.splice(fromIndex, 1);
            album.photos.splice(toIndex, 0, movedPhoto);
            await this.saveToStorage('albums', this.albums);
            this.renderPhotos();
            this.renderAlbums();
        }
    }

    async removePhoto(index) {
        if (this.currentAlbum !== null) {
            const confirmDelete = confirm('Are you sure you want to remove this photo from the album?');
            if (confirmDelete) {
                this.albums[this.currentAlbum].photos.splice(index, 1);
                await this.saveToStorage('albums', this.albums);
                this.renderPhotos();
                this.renderAlbums();
            }
        }
    }

    async handlePhotoUpload(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0 || this.currentAlbum === null) return;

        this.showLoading('Processing photos...');

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                this.updateProgress(((i) / files.length) * 100, `Processing ${i + 1} of ${files.length}...`);
                
                const compressedImage = await this.compressImage(file);
                this.albums[this.currentAlbum].photos.push(compressedImage);
            }

            await this.saveToStorage('albums', this.albums);
            this.renderPhotos();
            this.renderAlbums();
            this.hideLoading();
        } catch (error) {
            console.error('Error uploading photos:', error);
            alert('Error uploading photos. Please try again.');
            this.hideLoading();
        }

        event.target.value = '';
    }

    async compressImage(file, maxSizeMB = 2) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // Calculate dimensions to maintain aspect ratio
                const maxWidth = 1920;
                const maxHeight = 1080;
                let { width, height } = img;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                canvas.width = width;
                canvas.height = height;

                // Draw with high quality settings
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                // Start with high quality and reduce if needed
                let quality = 0.9;
                let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                const targetSize = maxSizeMB * 1024 * 1024;
                
                // Reduce quality until under target size
                while (compressedDataUrl.length > targetSize && quality > 0.3) {
                    quality -= 0.05;
                    compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                }
                
                resolve(compressedDataUrl);
            };

            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = URL.createObjectURL(file);
        });
    }

    // Lightbox
    openLightbox(photoIndex) {
        if (this.currentAlbum !== null) {
            this.currentPhotoIndex = photoIndex;
            const photo = this.albums[this.currentAlbum].photos[photoIndex];
            document.getElementById('lightbox-image').src = photo;
            document.getElementById('lightbox-modal').style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    hideLightbox() {
        document.getElementById('lightbox-modal').style.display = 'none';
        document.body.style.overflow = '';
    }

    showPrevPhoto() {
        if (this.currentAlbum !== null) {
            const album = this.albums[this.currentAlbum];
            this.currentPhotoIndex = (this.currentPhotoIndex - 1 + album.photos.length) % album.photos.length;
            document.getElementById('lightbox-image').src = album.photos[this.currentPhotoIndex];
        }
    }

    showNextPhoto() {
        if (this.currentAlbum !== null) {
            const album = this.albums[this.currentAlbum];
            this.currentPhotoIndex = (this.currentPhotoIndex + 1) % album.photos.length;
            document.getElementById('lightbox-image').src = album.photos[this.currentPhotoIndex];
        }
    }

    // Essays Management
    renderEssays() {
        const essayGrid = document.getElementById('essay-grid');
        if (!essayGrid) {
            console.error('Essay grid element not found');
            return;
        }
        
        const addCard = essayGrid.querySelector('.add-essay-card');
        
        essayGrid.innerHTML = '';
        if (addCard) {
            essayGrid.appendChild(addCard);
        }

        if (this.essays && Array.isArray(this.essays)) {
            this.essays.forEach((essay, index) => {
                const essayCard = this.createEssayCard(essay, index);
                essayGrid.appendChild(essayCard);
            });
        }
    }

    createEssayCard(essay, index) {
        const card = document.createElement('div');
        card.className = 'essay-card glass-card';
        
        card.innerHTML = `
            <div class="essay-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6C4.9 2 4 2.9 4 4v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                </svg>
            </div>
            <div class="essay-title">
                <input type="text" value="${essay.title}" onblur="app.updateEssayTitle(${index}, this.value)" 
                       onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter') this.blur()">
            </div>
        `;

        card.addEventListener('click', () => {
            this.openEssay(index);
        });

        return card;
    }

    async handleEssayUpload(event) {
        const file = event.target.files[0];
        if (!file || file.type !== 'application/pdf') {
            alert('Please select a PDF file.');
            return;
        }

        this.showLoading('Processing essay...');

        try {
            const fileReader = new FileReader();
            fileReader.onload = async (e) => {
                const essay = {
                    id: Date.now().toString(),
                    title: file.name.replace('.pdf', ''),
                    content: e.target.result
                };
                
                this.essays.push(essay);
                await this.saveToStorage('essays', this.essays);
                this.renderEssays();
                this.hideLoading();
            };
            
            fileReader.readAsDataURL(file);
        } catch (error) {
            console.error('Error uploading essay:', error);
            alert('Error uploading essay. Please try again.');
            this.hideLoading();
        }

        event.target.value = '';
    }

    updateEssayTitle(index, title) {
        if (title.trim()) {
            this.essays[index].title = title.trim();
            this.saveToStorage('essays', this.essays).catch(error => {
                console.error('Failed to save essay title:', error);
            });
        }
    }

    openEssay(index) {
        const essay = this.essays[index];
        document.getElementById('essay-pdf-viewer').src = essay.content;
        document.getElementById('essay-reader-modal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    hideEssayReader() {
        document.getElementById('essay-reader-modal').style.display = 'none';
        document.getElementById('essay-pdf-viewer').src = '';
        document.body.style.overflow = '';
    }

    // Context Menu
    showContextMenu(event, type, index) {
        this.contextMenuTarget = { type, index };
        const contextMenu = document.getElementById('context-menu');
        
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.top = `${event.clientY}px`;
    }

    hideContextMenu() {
        document.getElementById('context-menu').style.display = 'none';
        this.contextMenuTarget = null;
    }

    handleRename() {
        if (!this.contextMenuTarget) return;
        
        const { type, index } = this.contextMenuTarget;
        if (type === 'album') {
            this.startRenameAlbum(index);
        }
        this.hideContextMenu();
    }

    handleDelete() {
        if (!this.contextMenuTarget) return;
        
        const { type, index } = this.contextMenuTarget;
        if (type === 'album') {
            this.deleteAlbum(index);
        } else if (type === 'photo') {
            this.removePhoto(index);
        }
        this.hideContextMenu();
    }

    // Info Modal
    showInfoModal() {
        document.getElementById('info-modal').style.display = 'block';
    }

    hideInfoModal() {
        document.getElementById('info-modal').style.display = 'none';
    }

    // Loading and Progress
    showLoading(text = 'Loading...') {
        document.getElementById('loading-overlay').style.display = 'block';
        document.querySelector('.loading-text').textContent = text;
        this.updateProgress(0, text);
    }

    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
        this.updateProgress(0);
    }

    updateProgress(percentage, text = '') {
        document.getElementById('progress-bar').style.width = `${percentage}%`;
        document.getElementById('progress-text').textContent = `${Math.round(percentage)}%`;
        if (text) {
            document.querySelector('.loading-text').textContent = text;
        }
    }

    // Keyboard Navigation
    handleKeyNavigation(event) {
        if (document.getElementById('lightbox-modal').style.display === 'block') {
            switch(event.key) {
                case 'ArrowLeft':
                    event.preventDefault();
                    this.showPrevPhoto();
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    this.showNextPhoto();
                    break;
                case 'Escape':
                    event.preventDefault();
                    this.hideLightbox();
                    break;
            }
        }

        if (event.key === 'Escape') {
            this.hideInfoModal();
            this.hideAlbumNameModal();
            this.hideEssayReader();
            this.hideContextMenu();
        }
    }

    // Storage Management with IndexedDB
    async saveToStorage(key, data) {
        try {
            const dataString = JSON.stringify(data);
            const sizeInMB = (new Blob([dataString]).size / 1024 / 1024).toFixed(2);
            
            await this.storage.save(key, data);
            console.log(`Saved ${key} data: ${sizeInMB}MB to IndexedDB`);
            
            const storageInfo = await this.storage.getStorageSize();
            if (storageInfo) {
                console.log(`Total storage: ${storageInfo.used}MB used of ${storageInfo.quota}MB available`);
            }
            
        } catch (error) {
            console.error('Error saving to IndexedDB:', error);
            
            if (error.name === 'QuotaExceededError') {
                alert('Storage quota exceeded. Please delete some photos or albums to free up space.');
            } else {
                alert('Error saving data. Your changes may not be preserved. Please try refreshing the page.');
            }
        }
    }

    async getStorageInfo() {
        return await this.storage.getStorageSize();
    }

    async clearAllData() {
        if (confirm('This will delete ALL your photos and essays. This action cannot be undone. Are you sure?')) {
            try {
                await this.storage.clear();
                this.albums = [];
                this.essays = [];
                this.renderAlbums();
                this.renderEssays();
                alert('All data has been cleared.');
            } catch (error) {
                console.error('Failed to clear data:', error);
                alert('Failed to clear data. Please try refreshing the page.');
            }
        }
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PortfolioApp();
});

// Handle page visibility for performance
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') {
        if (window.app) {
            try {
                await window.app.saveToStorage('albums', window.app.albums);
                await window.app.saveToStorage('essays', window.app.essays);
            } catch (error) {
                console.warn('Failed to save data on page hide:', error);
            }
        }
    }
});

// Handle beforeunload to save data
window.addEventListener('beforeunload', async (e) => {
    if (window.app) {
        try {
            await Promise.race([
                Promise.all([
                    window.app.saveToStorage('albums', window.app.albums),
                    window.app.saveToStorage('essays', window.app.essays)
                ]),
                new Promise(resolve => setTimeout(resolve, 1000))
            ]);
        } catch (error) {
            console.warn('Failed to save data on page unload:', error);
        }
    }
});