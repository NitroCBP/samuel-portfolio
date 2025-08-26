/**
 * IndexedDB wrapper for Sam Pinkelman World
 * Handles all data persistence including assets, albums, photos, essays, and videos
 */

class Database {
    constructor() {
        this.dbName = 'sam-pinkelman-world-v1';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Assets store (background, logo, favicon)
                if (!db.objectStoreNames.contains('assets')) {
                    const assetsStore = db.createObjectStore('assets', { keyPath: 'key' });
                }
                
                // Albums store
                if (!db.objectStoreNames.contains('albums')) {
                    const albumsStore = db.createObjectStore('albums', { keyPath: 'id', autoIncrement: true });
                    albumsStore.createIndex('order', 'order', { unique: false });
                }
                
                // Photos store
                if (!db.objectStoreNames.contains('photos')) {
                    const photosStore = db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
                    photosStore.createIndex('albumId', 'albumId', { unique: false });
                    photosStore.createIndex('order', 'order', { unique: false });
                }
                
                // Essays store
                if (!db.objectStoreNames.contains('essays')) {
                    const essaysStore = db.createObjectStore('essays', { keyPath: 'id', autoIncrement: true });
                    essaysStore.createIndex('order', 'order', { unique: false });
                }
                
                // Videos store
                if (!db.objectStoreNames.contains('videos')) {
                    const videosStore = db.createObjectStore('videos', { keyPath: 'id', autoIncrement: true });
                    videosStore.createIndex('order', 'order', { unique: false });
                }
            };
        });
    }

    // Asset operations
    async putAsset(key, file) {
        const transaction = this.db.transaction(['assets'], 'readwrite');
        const store = transaction.objectStore('assets');
        
        const assetData = {
            key,
            blob: file,
            mime: file.type,
            updatedAt: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(assetData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAsset(key) {
        const transaction = this.db.transaction(['assets'], 'readonly');
        const store = transaction.objectStore('assets');
        
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Album operations
    async createAlbum(name) {
        // First get all albums to determine order, then add in a separate transaction
        const albums = await this.getAllAlbums();
        const maxOrder = albums.length > 0 ? Math.max(...albums.map(a => a.order || 0)) : 0;
        
        const albumData = {
            name,
            order: maxOrder + 1,
            createdAt: new Date().toISOString()
        };
        
        // Create a new transaction for the add operation
        const transaction = this.db.transaction(['albums'], 'readwrite');
        const store = transaction.objectStore('albums');
        
        return new Promise((resolve, reject) => {
            const request = store.add(albumData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllAlbums() {
        const transaction = this.db.transaction(['albums'], 'readonly');
        const store = transaction.objectStore('albums');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const albums = request.result.sort((a, b) => (a.order || 0) - (b.order || 0));
                resolve(albums);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async renameAlbum(id, name) {
        const transaction = this.db.transaction(['albums'], 'readwrite');
        const store = transaction.objectStore('albums');
        
        return new Promise(async (resolve, reject) => {
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const album = getRequest.result;
                if (!album) {
                    reject(new Error('Album not found'));
                    return;
                }
                
                album.name = name;
                album.updatedAt = new Date().toISOString();
                
                const putRequest = store.put(album);
                putRequest.onsuccess = () => resolve(putRequest.result);
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async deleteAlbum(id) {
        const transaction = this.db.transaction(['albums', 'photos'], 'readwrite');
        const albumStore = transaction.objectStore('albums');
        const photoStore = transaction.objectStore('photos');
        
        // Delete all photos in the album first
        const photos = await this.getPhotosByAlbum(id);
        for (const photo of photos) {
            await this.removePhoto(photo.id);
        }
        
        return new Promise((resolve, reject) => {
            const request = albumStore.delete(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async reorderAlbums(idsInOrder) {
        const transaction = this.db.transaction(['albums'], 'readwrite');
        const store = transaction.objectStore('albums');
        
        const promises = idsInOrder.map((id, index) => {
            return new Promise((resolve, reject) => {
                const getRequest = store.get(id);
                getRequest.onsuccess = () => {
                    const album = getRequest.result;
                    if (album) {
                        album.order = index;
                        const putRequest = store.put(album);
                        putRequest.onsuccess = () => resolve();
                        putRequest.onerror = () => reject(putRequest.error);
                    } else {
                        resolve();
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        });
        
        return Promise.all(promises);
    }

    // Photo operations
    async addPhoto(albumId, file) {
        // First get existing photos to determine order, then add in a separate transaction
        const photos = await this.getPhotosByAlbum(albumId);
        const maxOrder = photos.length > 0 ? Math.max(...photos.map(p => p.order || 0)) : 0;
        
        const photoData = {
            albumId,
            blob: file,
            mime: file.type,
            size: file.size,
            order: maxOrder + 1,
            createdAt: new Date().toISOString()
        };
        
        // Create a new transaction for the add operation
        const transaction = this.db.transaction(['photos'], 'readwrite');
        const store = transaction.objectStore('photos');
        
        return new Promise((resolve, reject) => {
            const request = store.add(photoData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getPhotosByAlbum(albumId) {
        const transaction = this.db.transaction(['photos'], 'readonly');
        const store = transaction.objectStore('photos');
        const index = store.index('albumId');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(albumId);
            request.onsuccess = () => {
                const photos = request.result.sort((a, b) => (a.order || 0) - (b.order || 0));
                resolve(photos);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async removePhoto(photoId) {
        const transaction = this.db.transaction(['photos'], 'readwrite');
        const store = transaction.objectStore('photos');
        
        return new Promise((resolve, reject) => {
            const request = store.delete(photoId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async reorderPhotos(albumId, idsInOrder) {
        const transaction = this.db.transaction(['photos'], 'readwrite');
        const store = transaction.objectStore('photos');
        
        const promises = idsInOrder.map((id, index) => {
            return new Promise((resolve, reject) => {
                const getRequest = store.get(id);
                getRequest.onsuccess = () => {
                    const photo = getRequest.result;
                    if (photo && photo.albumId === albumId) {
                        photo.order = index;
                        const putRequest = store.put(photo);
                        putRequest.onsuccess = () => resolve();
                        putRequest.onerror = () => reject(putRequest.error);
                    } else {
                        resolve();
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        });
        
        return Promise.all(promises);
    }

    // Essay operations
    async addEssay(file, title) {
        // First get all essays to determine order, then add in a separate transaction
        const essays = await this.getAllEssays();
        const maxOrder = essays.length > 0 ? Math.max(...essays.map(e => e.order || 0)) : 0;
        
        const essayData = {
            title,
            pdfBlob: file,
            mime: 'application/pdf',
            size: file.size,
            order: maxOrder + 1,
            createdAt: new Date().toISOString()
        };
        
        // Create a new transaction for the add operation
        const transaction = this.db.transaction(['essays'], 'readwrite');
        const store = transaction.objectStore('essays');
        
        return new Promise((resolve, reject) => {
            const request = store.add(essayData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllEssays() {
        const transaction = this.db.transaction(['essays'], 'readonly');
        const store = transaction.objectStore('essays');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const essays = request.result.sort((a, b) => (a.order || 0) - (b.order || 0));
                resolve(essays);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async renameEssay(id, title) {
        const transaction = this.db.transaction(['essays'], 'readwrite');
        const store = transaction.objectStore('essays');
        
        return new Promise((resolve, reject) => {
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const essay = getRequest.result;
                if (!essay) {
                    reject(new Error('Essay not found'));
                    return;
                }
                
                essay.title = title;
                essay.updatedAt = new Date().toISOString();
                
                const putRequest = store.put(essay);
                putRequest.onsuccess = () => resolve(putRequest.result);
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async deleteEssay(id) {
        const transaction = this.db.transaction(['essays'], 'readwrite');
        const store = transaction.objectStore('essays');
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async reorderEssays(idsInOrder) {
        const transaction = this.db.transaction(['essays'], 'readwrite');
        const store = transaction.objectStore('essays');
        
        const promises = idsInOrder.map((id, index) => {
            return new Promise((resolve, reject) => {
                const getRequest = store.get(id);
                getRequest.onsuccess = () => {
                    const essay = getRequest.result;
                    if (essay) {
                        essay.order = index;
                        const putRequest = store.put(essay);
                        putRequest.onsuccess = () => resolve();
                        putRequest.onerror = () => reject(putRequest.error);
                    } else {
                        resolve();
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        });
        
        return Promise.all(promises);
    }

    // Video operations
    async addVideo(url) {
        // Parse video URL to get provider and embed ID
        const videoInfo = this.parseVideoUrl(url);
        if (!videoInfo) {
            throw new Error('Invalid video URL');
        }
        
        // First get all videos to determine order, then add in a separate transaction
        const videos = await this.getAllVideos();
        const maxOrder = videos.length > 0 ? Math.max(...videos.map(v => v.order || 0)) : 0;
        
        const videoData = {
            provider: videoInfo.provider,
            url: url,
            embedId: videoInfo.embedId,
            title: videoInfo.title,
            order: maxOrder + 1,
            createdAt: new Date().toISOString()
        };
        
        // Create a new transaction for the add operation
        const transaction = this.db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');
        
        return new Promise((resolve, reject) => {
            const request = store.add(videoData);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    parseVideoUrl(url) {
        // YouTube patterns
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const youtubeMatch = url.match(youtubeRegex);
        
        if (youtubeMatch) {
            return {
                provider: 'youtube',
                embedId: youtubeMatch[1],
                title: null
            };
        }
        
        // Vimeo patterns
        const vimeoRegex = /(?:vimeo\.com\/)([0-9]+)/;
        const vimeoMatch = url.match(vimeoRegex);
        
        if (vimeoMatch) {
            return {
                provider: 'vimeo',
                embedId: vimeoMatch[1],
                title: null
            };
        }
        
        return null;
    }

    async getAllVideos() {
        const transaction = this.db.transaction(['videos'], 'readonly');
        const store = transaction.objectStore('videos');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const videos = request.result.sort((a, b) => (a.order || 0) - (b.order || 0));
                resolve(videos);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteVideo(id) {
        const transaction = this.db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async reorderVideos(idsInOrder) {
        const transaction = this.db.transaction(['videos'], 'readwrite');
        const store = transaction.objectStore('videos');
        
        const promises = idsInOrder.map((id, index) => {
            return new Promise((resolve, reject) => {
                const getRequest = store.get(id);
                getRequest.onsuccess = () => {
                    const video = getRequest.result;
                    if (video) {
                        video.order = index;
                        const putRequest = store.put(video);
                        putRequest.onsuccess = () => resolve();
                        putRequest.onerror = () => reject(putRequest.error);
                    } else {
                        resolve();
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        });
        
        return Promise.all(promises);
    }

    // Data export/import
    async exportAll() {
        const data = {
            version: this.version,
            timestamp: new Date().toISOString(),
            assets: {},
            albums: [],
            photos: [],
            essays: [],
            videos: []
        };
        
        // Export assets
        const assetKeys = ['backgroundImage', 'headerLogo', 'favicon'];
        for (const key of assetKeys) {
            const asset = await this.getAsset(key);
            if (asset) {
                // Convert blob to base64 for JSON export
                const base64 = await this.blobToBase64(asset.blob);
                data.assets[key] = {
                    key: asset.key,
                    data: base64,
                    mime: asset.mime,
                    updatedAt: asset.updatedAt
                };
            }
        }
        
        // Export albums
        data.albums = await this.getAllAlbums();
        
        // Export photos with base64 conversion
        const allAlbums = await this.getAllAlbums();
        for (const album of allAlbums) {
            const photos = await this.getPhotosByAlbum(album.id);
            for (const photo of photos) {
                const base64 = await this.blobToBase64(photo.blob);
                data.photos.push({
                    ...photo,
                    blob: null, // Remove blob from export
                    data: base64 // Add base64 data
                });
            }
        }
        
        // Export essays with base64 conversion
        const essays = await this.getAllEssays();
        for (const essay of essays) {
            const base64 = await this.blobToBase64(essay.pdfBlob);
            data.essays.push({
                ...essay,
                pdfBlob: null, // Remove blob from export
                data: base64 // Add base64 data
            });
        }
        
        // Export videos (no binary data)
        data.videos = await this.getAllVideos();
        
        return data;
    }

    async importAll(data) {
        if (!data.version || data.version !== this.version) {
            throw new Error('Incompatible data version');
        }
        
        // Clear existing data
        await this.clearAllData();
        
        // Import assets
        for (const [key, assetData] of Object.entries(data.assets)) {
            if (assetData.data) {
                const blob = this.base64ToBlob(assetData.data, assetData.mime);
                await this.putAsset(key, blob);
            }
        }
        
        // Import albums
        for (const album of data.albums) {
            const { id, ...albumData } = album;
            await this.createAlbum(albumData.name);
        }
        
        // Get new album IDs after import
        const newAlbums = await this.getAllAlbums();
        const albumIdMap = {};
        data.albums.forEach((oldAlbum, index) => {
            if (newAlbums[index]) {
                albumIdMap[oldAlbum.id] = newAlbums[index].id;
            }
        });
        
        // Import photos
        for (const photo of data.photos) {
            if (photo.data && albumIdMap[photo.albumId]) {
                const blob = this.base64ToBlob(photo.data, photo.mime);
                await this.addPhoto(albumIdMap[photo.albumId], blob);
            }
        }
        
        // Import essays
        for (const essay of data.essays) {
            if (essay.data) {
                const blob = this.base64ToBlob(essay.data, essay.mime);
                await this.addEssay(blob, essay.title);
            }
        }
        
        // Import videos
        for (const video of data.videos) {
            await this.addVideo(video.url);
        }
    }

    async clearAllData() {
        const stores = ['assets', 'albums', 'photos', 'essays', 'videos'];
        const transaction = this.db.transaction(stores, 'readwrite');
        
        const promises = stores.map(storeName => {
            return new Promise((resolve, reject) => {
                const request = transaction.objectStore(storeName).clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        });
        
        return Promise.all(promises);
    }

    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    base64ToBlob(base64, mimeType) {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    // Initialize default videos on first run
    async initializeDefaultVideos() {
        const videos = await this.getAllVideos();
        if (videos.length === 0) {
            const defaultVideos = [
                'https://vimeo.com/897021152',
                'https://youtu.be/6fWYLFodV78?si=faMzDuSLOlI8qURQ',
                'https://youtu.be/5E3XuSymtYQ?si=Sx8vyJ8vfHPEDMcU'
            ];
            
            for (const url of defaultVideos) {
                try {
                    await this.addVideo(url);
                } catch (error) {
                    console.warn('Failed to add default video:', url, error);
                }
            }
        }
    }
}

// Create global database instance
window.db = new Database();