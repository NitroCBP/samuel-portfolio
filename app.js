/**
 * Sam Pinkelman World - Main Application
 * Handles navigation, admin authentication, and all app functionality
 */

class App {
    constructor() {
        this.isAdminMode = false;
        this.currentTab = 'photos';
        this.currentAlbum = null;
        this.currentLightboxIndex = 0;
        this.currentPhotos = [];
        
        // Hash the admin password (client-side only - NOT secure for real protection)
        this.adminPasswordHash = null;
        this.initAdminPasswordHash();
    }

    async initAdminPasswordHash() {
        // Hash the password "A21bcW34SamPinkWorld"
        // NOTE: This is NOT real security - just client-side obfuscation
        this.adminPasswordHash = await Utils.hashString('A21bcW34SamPinkWorld');
    }

    async init() {
        try {
            // Initialize database
            await db.init();
            
            // Initialize default videos if none exist
            await db.initializeDefaultVideos();
            
            // Load branding assets
            await this.loadBrandingAssets();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load initial content
            await this.loadCurrentTab();
            
            Utils.showToast('Welcome to Sam Pinkelman World!', 'success');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            Utils.showToast('Failed to initialize application', 'error');
        }
    }

    async loadBrandingAssets() {
        try {
            // Load background image
            const bgAsset = await db.getAsset('backgroundImage');
            if (bgAsset) {
                let bgUrl;
                if (bgAsset.isCloudAsset && bgAsset.downloadURL) {
                    bgUrl = bgAsset.downloadURL;
                } else if (bgAsset.blob) {
                    bgUrl = Utils.createObjectURL(bgAsset.blob);
                }
                
                if (bgUrl) {
                    document.documentElement.style.setProperty('--bg-image', `url(${bgUrl})`);
                }
            }

            // Load header logo
            const logoAsset = await db.getAsset('headerLogo');
            if (logoAsset) {
                let logoUrl;
                if (logoAsset.isCloudAsset && logoAsset.downloadURL) {
                    logoUrl = logoAsset.downloadURL;
                } else if (logoAsset.blob) {
                    logoUrl = Utils.createObjectURL(logoAsset.blob);
                }
                
                if (logoUrl) {
                    const logoImg = document.getElementById('header-logo');
                    logoImg.src = logoUrl;
                    logoImg.style.display = 'block';
                }
            }

            // Load favicon
            const faviconAsset = await db.getAsset('favicon');
            if (faviconAsset) {
                let faviconUrl;
                if (faviconAsset.isCloudAsset && faviconAsset.downloadURL) {
                    faviconUrl = faviconAsset.downloadURL;
                } else if (faviconAsset.blob) {
                    faviconUrl = Utils.createObjectURL(faviconAsset.blob);
                }
                
                if (faviconUrl) {
                    const faviconLink = document.getElementById('favicon');
                    faviconLink.href = faviconUrl;
                }
            }
        } catch (error) {
            console.error('Failed to load branding assets:', error);
        }
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Admin login
        document.getElementById('admin-btn').addEventListener('click', () => {
            if (this.isAdminMode) {
                this.toggleAdminMode(false);
            } else {
                Utils.showModal('admin-modal');
            }
        });

        // Admin form
        document.getElementById('admin-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('admin-password').value;
            const hashedInput = await Utils.hashString(password);
            
            if (hashedInput === this.adminPasswordHash) {
                this.toggleAdminMode(true);
                Utils.hideModal('admin-modal');
                Utils.showToast('Admin mode enabled', 'success');
                document.getElementById('admin-password').value = '';
            } else {
                Utils.showToast('Incorrect password', 'error');
            }
        });

        // Modal close buttons
        document.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.dataset.modal;
                Utils.hideModal(modalId);
            });
        });

        // Modal background click to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });

        // My info button
        document.getElementById('my-info-btn').addEventListener('click', () => {
            Utils.showModal('info-modal');
        });

        // Branding gear button
        document.getElementById('branding-gear').addEventListener('click', () => {
            this.openBrandingPanel();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape to close modals
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal.show');
                if (openModal) {
                    openModal.classList.remove('show');
                }
            }
        });

        // Set up specific tab event listeners
        this.setupPhotosEventListeners();
        this.setupEssaysEventListeners();
        this.setupVideosEventListeners();
        this.setupBrandingEventListeners();
    }

    toggleAdminMode(enabled) {
        this.isAdminMode = enabled;
        document.body.classList.toggle('admin-mode', enabled);
        
        const adminBtn = document.getElementById('admin-btn');
        adminBtn.textContent = enabled ? 'Exit Admin' : 'Admin';
        
        if (enabled) {
            adminBtn.classList.add('danger');
        } else {
            adminBtn.classList.remove('danger');
        }
    }

    async switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        this.currentTab = tabName;
        await this.loadCurrentTab();
    }

    async loadCurrentTab() {
        switch (this.currentTab) {
            case 'photos':
                await this.loadPhotosTab();
                break;
            case 'essays':
                await this.loadEssaysTab();
                break;
            case 'video':
                await this.loadVideosTab();
                break;
        }
    }

    // Photos Tab Implementation
    setupPhotosEventListeners() {
        // Create album
        document.getElementById('create-album-btn').addEventListener('click', () => {
            Utils.showModal('album-modal');
        });

        document.getElementById('album-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const albumName = document.getElementById('album-name').value.trim();
            
            if (albumName) {
                try {
                    await db.createAlbum(albumName);
                    Utils.hideModal('album-modal');
                    document.getElementById('album-name').value = '';
                    await this.loadPhotosTab();
                    Utils.showToast('Album created successfully', 'success');
                } catch (error) {
                    console.error('Failed to create album:', error);
                    Utils.showToast('Failed to create album', 'error');
                }
            }
        });

        // Gallery controls
        document.getElementById('add-photos-btn').addEventListener('click', () => {
            document.getElementById('photos-file-input').click();
        });

        document.getElementById('photos-file-input').addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0 && this.currentAlbum) {
                await this.addPhotosToAlbum(this.currentAlbum.id, files);
                e.target.value = '';
            }
        });

        document.getElementById('rename-album-btn').addEventListener('click', async () => {
            if (!this.currentAlbum) return;
            
            const newName = prompt('Enter new album name:', this.currentAlbum.name);
            if (newName && newName.trim()) {
                try {
                    await db.renameAlbum(this.currentAlbum.id, newName.trim());
                    this.currentAlbum.name = newName.trim();
                    document.getElementById('gallery-title').textContent = newName.trim();
                    await this.loadPhotosTab();
                    Utils.showToast('Album renamed successfully', 'success');
                } catch (error) {
                    console.error('Failed to rename album:', error);
                    Utils.showToast('Failed to rename album', 'error');
                }
            }
        });

        document.getElementById('delete-album-btn').addEventListener('click', async () => {
            if (!this.currentAlbum) return;
            
            const confirmed = await Utils.showConfirm(
                `Are you sure you want to delete "${this.currentAlbum.name}" and all its photos?`,
                'Delete Album'
            );
            
            if (confirmed) {
                try {
                    await db.deleteAlbum(this.currentAlbum.id);
                    Utils.hideModal('gallery-modal');
                    await this.loadPhotosTab();
                    Utils.showToast('Album deleted successfully', 'success');
                } catch (error) {
                    console.error('Failed to delete album:', error);
                    Utils.showToast('Failed to delete album', 'error');
                }
            }
        });

        // Lightbox controls
        document.getElementById('lightbox-prev').addEventListener('click', () => {
            this.showPreviousPhoto();
        });

        document.getElementById('lightbox-next').addEventListener('click', () => {
            this.showNextPhoto();
        });

        // Keyboard navigation for lightbox
        document.addEventListener('keydown', (e) => {
            if (document.getElementById('lightbox-modal').classList.contains('show')) {
                switch (e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        this.showPreviousPhoto();
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        this.showNextPhoto();
                        break;
                }
            }
        });
    }

    async loadPhotosTab() {
        try {
            const albums = await db.getAllAlbums();
            const albumsGrid = document.getElementById('albums-grid');
            
            if (albums.length === 0) {
                albumsGrid.innerHTML = '<p class="empty-state">No albums yet. Create your first album!</p>';
                return;
            }

            albumsGrid.innerHTML = '';
            
            for (const album of albums) {
                const photos = await db.getPhotosByAlbum(album.id);
                const albumCard = await this.createAlbumCard(album, photos);
                albumsGrid.appendChild(albumCard);
            }
        } catch (error) {
            console.error('Failed to load photos tab:', error);
            Utils.showToast('Failed to load albums', 'error');
        }
    }

    async createAlbumCard(album, photos) {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.dataset.id = album.id;
        
        // Get cover photo (deterministic random selection)
        let coverPhotoUrl = '';
        if (photos.length > 0) {
            const coverPhoto = Utils.seededRandomChoice(photos, album.id);
            if (coverPhoto) {
                coverPhotoUrl = Utils.createObjectURL(coverPhoto.blob);
            }
        }
        
        card.innerHTML = `
            ${coverPhotoUrl ? `<img src="${coverPhotoUrl}" alt="${album.name}" class="album-cover">` : ''}
            <div class="album-name">${Utils.escapeHtml(album.name)}</div>
            <div class="album-admin-controls">
                <button class="admin-control-btn" onclick="app.openGallery(${album.id})" title="Edit">✏️</button>
            </div>
        `;
        
        card.addEventListener('click', () => {
            this.openGallery(album.id);
        });
        
        return card;
    }

    async openGallery(albumId) {
        try {
            const albums = await db.getAllAlbums();
            this.currentAlbum = albums.find(a => a.id === albumId);
            
            if (!this.currentAlbum) {
                Utils.showToast('Album not found', 'error');
                return;
            }
            
            document.getElementById('gallery-title').textContent = this.currentAlbum.name;
            
            const photos = await db.getPhotosByAlbum(albumId);
            this.currentPhotos = photos;
            
            const galleryGrid = document.getElementById('gallery-grid');
            
            if (photos.length === 0) {
                galleryGrid.innerHTML = '<p class="empty-state">No photos in this album yet.</p>';
            } else {
                galleryGrid.innerHTML = '';
                
                photos.forEach((photo, index) => {
                    const photoItem = document.createElement('div');
                    photoItem.className = 'gallery-item';
                    
                    const photoUrl = Utils.createObjectURL(photo.blob);
                    photoItem.innerHTML = `
                        <img src="${photoUrl}" alt="Photo ${index + 1}" loading="lazy">
                        ${this.isAdminMode ? `<button class="admin-control-btn" onclick="app.removePhoto(${photo.id})" title="Remove">🗑️</button>` : ''}
                    `;
                    
                    photoItem.addEventListener('click', () => {
                        this.openLightbox(index);
                    });
                    
                    galleryGrid.appendChild(photoItem);
                });
            }
            
            Utils.showModal('gallery-modal');
        } catch (error) {
            console.error('Failed to open gallery:', error);
            Utils.showToast('Failed to open gallery', 'error');
        }
    }

    async addPhotosToAlbum(albumId, files) {
        const validImages = files.filter(file => Utils.isValidImage(file));
        
        if (validImages.length === 0) {
            Utils.showToast('No valid images selected', 'error');
            return;
        }
        
        if (validImages.length !== files.length) {
            Utils.showToast(`${files.length - validImages.length} invalid files skipped`, 'error');
        }
        
        try {
            for (const file of validImages) {
                // Compress image to be under 2MB
                const compressedBlob = await Utils.compressImage(file);
                await db.addPhoto(albumId, compressedBlob);
            }
            
            // Reload gallery if currently viewing this album
            if (this.currentAlbum && this.currentAlbum.id === albumId) {
                await this.openGallery(albumId);
            }
            
            await this.loadPhotosTab();
            Utils.showToast(`${validImages.length} photos added successfully`, 'success');
        } catch (error) {
            console.error('Failed to add photos:', error);
            Utils.showToast('Failed to add photos', 'error');
        }
    }

    async removePhoto(photoId) {
        const confirmed = await Utils.showConfirm('Are you sure you want to remove this photo?');
        
        if (confirmed) {
            try {
                await db.removePhoto(photoId);
                
                // Reload current gallery
                if (this.currentAlbum) {
                    await this.openGallery(this.currentAlbum.id);
                }
                
                Utils.showToast('Photo removed successfully', 'success');
            } catch (error) {
                console.error('Failed to remove photo:', error);
                Utils.showToast('Failed to remove photo', 'error');
            }
        }
    }

    openLightbox(photoIndex) {
        if (!this.currentPhotos || this.currentPhotos.length === 0) return;
        
        this.currentLightboxIndex = photoIndex;
        const photo = this.currentPhotos[photoIndex];
        
        const lightboxImage = document.getElementById('lightbox-image');
        const photoUrl = Utils.createObjectURL(photo.blob);
        lightboxImage.src = photoUrl;
        
        this.updateLightboxNavigation();
        Utils.showModal('lightbox-modal');
    }

    showPreviousPhoto() {
        if (!this.currentPhotos || this.currentPhotos.length === 0) return;
        
        this.currentLightboxIndex = (this.currentLightboxIndex - 1 + this.currentPhotos.length) % this.currentPhotos.length;
        const photo = this.currentPhotos[this.currentLightboxIndex];
        
        const lightboxImage = document.getElementById('lightbox-image');
        const photoUrl = Utils.createObjectURL(photo.blob);
        lightboxImage.src = photoUrl;
        
        this.updateLightboxNavigation();
    }

    showNextPhoto() {
        if (!this.currentPhotos || this.currentPhotos.length === 0) return;
        
        this.currentLightboxIndex = (this.currentLightboxIndex + 1) % this.currentPhotos.length;
        const photo = this.currentPhotos[this.currentLightboxIndex];
        
        const lightboxImage = document.getElementById('lightbox-image');
        const photoUrl = Utils.createObjectURL(photo.blob);
        lightboxImage.src = photoUrl;
        
        this.updateLightboxNavigation();
    }

    updateLightboxNavigation() {
        const counter = document.getElementById('lightbox-counter');
        const prevBtn = document.getElementById('lightbox-prev');
        const nextBtn = document.getElementById('lightbox-next');
        
        counter.textContent = `${this.currentLightboxIndex + 1} of ${this.currentPhotos.length}`;
        
        prevBtn.disabled = this.currentPhotos.length <= 1;
        nextBtn.disabled = this.currentPhotos.length <= 1;
    }

    // Essays Tab Implementation
    setupEssaysEventListeners() {
        document.getElementById('upload-essay-btn').addEventListener('click', () => {
            document.getElementById('essay-file-input').click();
        });

        document.getElementById('essay-file-input').addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                await this.addEssays(files);
                e.target.value = '';
            }
        });
    }

    async loadEssaysTab() {
        try {
            const essays = await db.getAllEssays();
            const essaysGrid = document.getElementById('essays-grid');
            
            if (essays.length === 0) {
                essaysGrid.innerHTML = '<p class="empty-state">No essays yet. Upload your first PDF!</p>';
                return;
            }

            essaysGrid.innerHTML = '';
            
            essays.forEach(essay => {
                const essayCard = this.createEssayCard(essay);
                essaysGrid.appendChild(essayCard);
            });
        } catch (error) {
            console.error('Failed to load essays tab:', error);
            Utils.showToast('Failed to load essays', 'error');
        }
    }

    createEssayCard(essay) {
        const card = document.createElement('div');
        card.className = 'essay-card';
        card.dataset.id = essay.id;
        
        card.innerHTML = `
            <div class="essay-icon">📄</div>
            <h3 class="essay-title">${Utils.escapeHtml(essay.title)}</h3>
            <p class="essay-size">${Utils.formatFileSize(essay.size)}</p>
            <div class="essay-admin-controls">
                <button class="admin-control-btn" onclick="app.renameEssay(${essay.id})" title="Rename">✏️</button>
                <button class="admin-control-btn" onclick="app.deleteEssay(${essay.id})" title="Delete">🗑️</button>
            </div>
        `;
        
        card.addEventListener('click', () => {
            this.openEssay(essay);
        });
        
        return card;
    }

    async addEssays(files) {
        const validPDFs = files.filter(file => Utils.isValidPDF(file));
        
        if (validPDFs.length === 0) {
            Utils.showToast('No valid PDF files selected', 'error');
            return;
        }
        
        if (validPDFs.length !== files.length) {
            Utils.showToast(`${files.length - validPDFs.length} non-PDF files skipped`, 'error');
        }
        
        try {
            for (const file of validPDFs) {
                const title = file.name.replace(/\.pdf$/i, '');
                await db.addEssay(file, title);
            }
            
            await this.loadEssaysTab();
            Utils.showToast(`${validPDFs.length} essays added successfully`, 'success');
        } catch (error) {
            console.error('Failed to add essays:', error);
            Utils.showToast('Failed to add essays', 'error');
        }
    }

    openEssay(essay) {
        const pdfUrl = Utils.createObjectURL(essay.pdfBlob);
        document.getElementById('essay-title').textContent = essay.title;
        document.getElementById('essay-iframe').src = pdfUrl;
        Utils.showModal('essay-reader-modal');
    }

    async renameEssay(essayId) {
        try {
            const essays = await db.getAllEssays();
            const essay = essays.find(e => e.id === essayId);
            
            if (!essay) {
                Utils.showToast('Essay not found', 'error');
                return;
            }
            
            const newTitle = prompt('Enter new essay title:', essay.title);
            if (newTitle && newTitle.trim()) {
                await db.renameEssay(essayId, newTitle.trim());
                await this.loadEssaysTab();
                Utils.showToast('Essay renamed successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to rename essay:', error);
            Utils.showToast('Failed to rename essay', 'error');
        }
    }

    async deleteEssay(essayId) {
        const confirmed = await Utils.showConfirm('Are you sure you want to delete this essay?');
        
        if (confirmed) {
            try {
                await db.deleteEssay(essayId);
                await this.loadEssaysTab();
                Utils.showToast('Essay deleted successfully', 'success');
            } catch (error) {
                console.error('Failed to delete essay:', error);
                Utils.showToast('Failed to delete essay', 'error');
            }
        }
    }

    // Videos Tab Implementation
    setupVideosEventListeners() {
        document.getElementById('add-video-btn').addEventListener('click', () => {
            Utils.showModal('add-video-modal');
        });

        document.getElementById('add-video-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const url = document.getElementById('video-url').value.trim();
            
            if (url) {
                try {
                    await db.addVideo(url);
                    Utils.hideModal('add-video-modal');
                    document.getElementById('video-url').value = '';
                    await this.loadVideosTab();
                    Utils.showToast('Video added successfully', 'success');
                } catch (error) {
                    console.error('Failed to add video:', error);
                    Utils.showToast('Invalid video URL or failed to add video', 'error');
                }
            }
        });
    }

    async loadVideosTab() {
        try {
            const videos = await db.getAllVideos();
            const videosContainer = document.getElementById('videos-container');
            
            if (videos.length === 0) {
                videosContainer.innerHTML = '<p class="empty-state">No videos yet. Add your first video!</p>';
                return;
            }

            videosContainer.innerHTML = '';
            
            videos.forEach(video => {
                const videoCard = this.createVideoCard(video);
                videosContainer.appendChild(videoCard);
            });
        } catch (error) {
            console.error('Failed to load videos tab:', error);
            Utils.showToast('Failed to load videos', 'error');
        }
    }

    createVideoCard(video) {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.dataset.id = video.id;
        
        let embedUrl;
        if (video.provider === 'youtube') {
            embedUrl = `https://www.youtube.com/embed/${video.embedId}`;
        } else if (video.provider === 'vimeo') {
            embedUrl = `https://player.vimeo.com/video/${video.embedId}`;
        }
        
        card.innerHTML = `
            <div class="video-embed">
                <iframe src="${embedUrl}" frameborder="0" allowfullscreen loading="lazy"></iframe>
            </div>
            <div class="video-admin-controls">
                <button class="admin-control-btn" onclick="app.deleteVideo(${video.id})" title="Delete">🗑️</button>
            </div>
        `;
        
        return card;
    }

    async deleteVideo(videoId) {
        const confirmed = await Utils.showConfirm('Are you sure you want to remove this video?');
        
        if (confirmed) {
            try {
                await db.deleteVideo(videoId);
                await this.loadVideosTab();
                Utils.showToast('Video removed successfully', 'success');
            } catch (error) {
                console.error('Failed to delete video:', error);
                Utils.showToast('Failed to remove video', 'error');
            }
        }
    }

    // Branding Panel Implementation
    setupBrandingEventListeners() {
        // Asset uploads
        document.getElementById('bg-upload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && Utils.isValidImage(file)) {
                await this.updateAsset('backgroundImage', file);
            }
        });

        document.getElementById('logo-upload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && Utils.isValidImage(file)) {
                await this.updateAsset('headerLogo', file);
            }
        });

        document.getElementById('favicon-upload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && Utils.isValidImage(file)) {
                await this.updateAsset('favicon', file);
            }
        });

        // Data backup
        document.getElementById('export-data-btn').addEventListener('click', () => {
            this.exportAllData();
        });

        document.getElementById('import-data-btn').addEventListener('click', () => {
            document.getElementById('import-file-input').click();
        });

        document.getElementById('import-file-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.importAllData(file);
                e.target.value = '';
            }
        });
    }

    async openBrandingPanel() {
        // Only allow access in admin mode
        if (!this.isAdminMode) {
            Utils.showToast('Admin access required', 'error');
            return;
        }
        
        // Update asset previews
        await this.updateAssetPreviews();
        Utils.showModal('branding-modal');
    }

    async updateAssetPreviews() {
        const assets = ['backgroundImage', 'headerLogo', 'favicon'];
        const previewIds = ['bg-preview', 'logo-preview', 'favicon-preview'];
        
        for (let i = 0; i < assets.length; i++) {
            const assetKey = assets[i];
            const previewId = previewIds[i];
            const preview = document.getElementById(previewId);
            
            try {
                const asset = await db.getAsset(assetKey);
                if (asset) {
                    const url = Utils.createObjectURL(asset.blob);
                    preview.innerHTML = `<img src="${url}" alt="${assetKey}">`;
                    preview.classList.remove('empty');
                } else {
                    preview.innerHTML = '';
                    preview.classList.add('empty');
                }
            } catch (error) {
                preview.innerHTML = '';
                preview.classList.add('empty');
            }
        }
    }

    async updateAsset(assetKey, file) {
        // Only allow asset updates in admin mode
        if (!this.isAdminMode) {
            Utils.showToast('Admin access required to update assets', 'error');
            return;
        }
        
        try {
            await db.putAsset(assetKey, file);
            await this.loadBrandingAssets();
            await this.updateAssetPreviews();
            
            const assetNames = {
                'backgroundImage': 'Background image',
                'headerLogo': 'Header logo',
                'favicon': 'Favicon'
            };
            
            Utils.showToast(`${assetNames[assetKey]} updated successfully`, 'success');
        } catch (error) {
            console.error(`Failed to update ${assetKey}:`, error);
            Utils.showToast(`Failed to update ${assetKey}`, 'error');
        }
    }

    async exportAllData() {
        // Only allow data export in admin mode
        if (!this.isAdminMode) {
            Utils.showToast('Admin access required to export data', 'error');
            return;
        }
        
        try {
            Utils.showToast('Exporting data...', 'info');
            const data = await db.exportAll();
            const filename = `sam-pinkelman-world-backup-${new Date().toISOString().split('T')[0]}.json`;
            Utils.downloadAsFile(data, filename);
            Utils.showToast('Data exported successfully', 'success');
        } catch (error) {
            console.error('Failed to export data:', error);
            Utils.showToast('Failed to export data', 'error');
        }
    }

    async importAllData(file) {
        // Only allow data import in admin mode
        if (!this.isAdminMode) {
            Utils.showToast('Admin access required to import data', 'error');
            return;
        }
        
        try {
            const text = await Utils.readFileAsText(file);
            const data = JSON.parse(text);
            
            const confirmed = await Utils.showConfirm(
                'This will replace all current data. Are you sure you want to continue?',
                'Import Data'
            );
            
            if (confirmed) {
                Utils.showToast('Importing data...', 'info');
                await db.importAll(data);
                
                // Reload everything
                await this.loadBrandingAssets();
                await this.loadCurrentTab();
                
                Utils.showToast('Data imported successfully', 'success');
                Utils.hideModal('branding-modal');
            }
        } catch (error) {
            console.error('Failed to import data:', error);
            Utils.showToast('Failed to import data. Please check the file format.', 'error');
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    app.init();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    Utils.cleanupObjectURLs();
});