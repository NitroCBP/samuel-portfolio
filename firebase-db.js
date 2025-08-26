/**
 * Firebase Cloud Database wrapper for Sam Pinkelman World
 * Provides real-time sync across devices while maintaining local IndexedDB backup
 */

class FirebaseDatabase {
    constructor() {
        this.localDb = window.db; // Keep reference to IndexedDB
        this.firestore = null;
        this.storage = null;
        this.isOnline = navigator.onLine;
        this.syncEnabled = false;
        this.listeners = new Map(); // Store real-time listeners
        
        // Setup online/offline detection
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncLocalToCloud();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    async init() {
        // Wait for Firebase to be loaded
        await this.waitForFirebase();
        
        this.firestore = window.firestore;
        this.storage = window.firebaseStorage;
        
        // Initialize local database first
        await this.localDb.init();
        
        // Try to sync with cloud if online
        if (this.isOnline) {
            try {
                await this.enableCloudSync();
                console.log('Firebase sync enabled');
            } catch (error) {
                console.warn('Firebase sync failed, using local storage only:', error);
                this.syncEnabled = false;
            }
        }
        
        return this;
    }

    async waitForFirebase() {
        let attempts = 0;
        while ((!window.firebaseReady || !window.firestore || !window.FirebaseFunctions) && attempts < 100) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.firebaseReady || !window.firestore || !window.FirebaseFunctions) {
            throw new Error('Firebase failed to initialize properly');
        }
    }

    async enableCloudSync() {
        try {
            // Test connection with a simple read
            const testDoc = window.FirebaseFunctions.doc(this.firestore, 'test', 'connection');
            await window.FirebaseFunctions.getDoc(testDoc);
            
            this.syncEnabled = true;
            
            // Sync existing local data to cloud
            await this.syncLocalToCloud();
            
            // Setup real-time listeners
            this.setupRealtimeListeners();
            
        } catch (error) {
            console.warn('Cloud sync disabled:', error);
            this.syncEnabled = false;
        }
    }

    async syncLocalToCloud() {
        if (!this.syncEnabled) return;
        
        try {
            // Sync albums
            const albums = await this.localDb.getAllAlbums();
            for (const album of albums) {
                await this.syncAlbumToCloud(album);
            }
            
            // Sync essays
            const essays = await this.localDb.getAllEssays();
            for (const essay of essays) {
                await this.syncEssayToCloud(essay);
            }
            
            // Sync videos
            const videos = await this.localDb.getAllVideos();
            for (const video of videos) {
                await this.syncVideoToCloud(video);
            }
            
            console.log('Local data synced to cloud');
        } catch (error) {
            console.error('Failed to sync local data to cloud:', error);
        }
    }

    setupRealtimeListeners() {
        // Listen for album changes
        const albumsRef = window.FirebaseFunctions.collection(this.firestore, 'albums');
        const unsubscribeAlbums = window.FirebaseFunctions.onSnapshot(albumsRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                this.handleRealtimeAlbumChange(change);
            });
        });
        this.listeners.set('albums', unsubscribeAlbums);

        // Listen for essay changes
        const essaysRef = window.FirebaseFunctions.collection(this.firestore, 'essays');
        const unsubscribeEssays = window.FirebaseFunctions.onSnapshot(essaysRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                this.handleRealtimeEssayChange(change);
            });
        });
        this.listeners.set('essays', unsubscribeEssays);

        // Listen for video changes
        const videosRef = window.FirebaseFunctions.collection(this.firestore, 'videos');
        const unsubscribeVideos = window.FirebaseFunctions.onSnapshot(videosRef, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                this.handleRealtimeVideoChange(change);
            });
        });
        this.listeners.set('videos', unsubscribeVideos);
    }

    // Asset operations (enhanced with cloud storage)
    async putAsset(key, file) {
        // Always store locally first
        await this.localDb.putAsset(key, file);
        
        if (!this.syncEnabled) return;
        
        try {
            // Upload to Firebase Storage
            const storageRef = window.FirebaseFunctions.ref(this.storage, `assets/${key}`);
            const snapshot = await window.FirebaseFunctions.uploadBytes(storageRef, file);
            const downloadURL = await window.FirebaseFunctions.getDownloadURL(snapshot.ref);
            
            // Store metadata in Firestore
            const assetDoc = window.FirebaseFunctions.doc(this.firestore, 'assets', key);
            await window.FirebaseFunctions.setDoc(assetDoc, {
                key,
                downloadURL,
                mime: file.type,
                size: file.size,
                updatedAt: new Date().toISOString()
            });
            
        } catch (error) {
            console.warn('Failed to sync asset to cloud:', error);
        }
    }

    async getAsset(key) {
        // Try cloud first if online
        if (this.syncEnabled) {
            try {
                const assetDoc = window.FirebaseFunctions.doc(this.firestore, 'assets', key);
                const docSnap = await window.FirebaseFunctions.getDoc(assetDoc);
                
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    // Fetch the actual file from storage
                    const response = await fetch(data.downloadURL);
                    const blob = await response.blob();
                    
                    // Update local cache
                    await this.localDb.putAsset(key, blob);
                    
                    return {
                        key: data.key,
                        blob: blob,
                        mime: data.mime,
                        updatedAt: data.updatedAt
                    };
                }
            } catch (error) {
                console.warn('Failed to get asset from cloud, using local:', error);
            }
        }
        
        // Fallback to local storage
        return await this.localDb.getAsset(key);
    }

    // Album operations (enhanced with cloud sync)
    async createAlbum(name) {
        // Create locally first
        const localId = await this.localDb.createAlbum(name);
        
        if (!this.syncEnabled) return localId;
        
        try {
            // Create in Firestore
            const albumData = {
                name,
                localId,
                order: Date.now(), // Use timestamp for ordering
                createdAt: new Date().toISOString(),
                photos: []
            };
            
            const docRef = await window.FirebaseFunctions.addDoc(
                window.FirebaseFunctions.collection(this.firestore, 'albums'),
                albumData
            );
            
            console.log('Album synced to cloud:', docRef.id);
            return localId;
            
        } catch (error) {
            console.warn('Failed to sync album to cloud:', error);
            return localId;
        }
    }

    async getAllAlbums() {
        // Try cloud first if online
        if (this.syncEnabled) {
            try {
                const albumsRef = window.FirebaseFunctions.collection(this.firestore, 'albums');
                const querySnapshot = await window.FirebaseFunctions.getDocs(albumsRef);
                
                const albums = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    albums.push({
                        id: data.localId || doc.id,
                        cloudId: doc.id,
                        name: data.name,
                        order: data.order,
                        createdAt: data.createdAt
                    });
                });
                
                // Sort by order
                albums.sort((a, b) => (a.order || 0) - (b.order || 0));
                
                return albums;
            } catch (error) {
                console.warn('Failed to get albums from cloud, using local:', error);
            }
        }
        
        // Fallback to local storage
        return await this.localDb.getAllAlbums();
    }

    async deleteAlbum(id) {
        // Delete locally first
        await this.localDb.deleteAlbum(id);
        
        if (!this.syncEnabled) return;
        
        try {
            // Find and delete from Firestore
            const albumsRef = window.FirebaseFunctions.collection(this.firestore, 'albums');
            const q = window.FirebaseFunctions.query(albumsRef, window.FirebaseFunctions.where('localId', '==', id));
            const querySnapshot = await window.FirebaseFunctions.getDocs(q);
            
            querySnapshot.forEach(async (doc) => {
                await window.FirebaseFunctions.deleteDoc(doc.ref);
            });
            
        } catch (error) {
            console.warn('Failed to delete album from cloud:', error);
        }
    }

    // Video operations (enhanced with cloud sync)
    async addVideo(url) {
        // Add locally first
        const localId = await this.localDb.addVideo(url);
        
        if (!this.syncEnabled) return localId;
        
        try {
            // Parse video info
            const videoInfo = this.localDb.parseVideoUrl(url);
            
            // Add to Firestore
            const videoData = {
                localId,
                provider: videoInfo.provider,
                url: url,
                embedId: videoInfo.embedId,
                title: videoInfo.title,
                order: Date.now(),
                createdAt: new Date().toISOString()
            };
            
            await window.FirebaseFunctions.addDoc(
                window.FirebaseFunctions.collection(this.firestore, 'videos'),
                videoData
            );
            
            return localId;
            
        } catch (error) {
            console.warn('Failed to sync video to cloud:', error);
            return localId;
        }
    }

    async getAllVideos() {
        // Try cloud first if online
        if (this.syncEnabled) {
            try {
                const videosRef = window.FirebaseFunctions.collection(this.firestore, 'videos');
                const querySnapshot = await window.FirebaseFunctions.getDocs(videosRef);
                
                const videos = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    videos.push({
                        id: data.localId || doc.id,
                        cloudId: doc.id,
                        provider: data.provider,
                        url: data.url,
                        embedId: data.embedId,
                        title: data.title,
                        order: data.order,
                        createdAt: data.createdAt
                    });
                });
                
                // Sort by order
                videos.sort((a, b) => (a.order || 0) - (b.order || 0));
                
                return videos;
            } catch (error) {
                console.warn('Failed to get videos from cloud, using local:', error);
            }
        }
        
        // Fallback to local storage
        return await this.localDb.getAllVideos();
    }

    async deleteVideo(id) {
        // Delete locally first
        await this.localDb.deleteVideo(id);
        
        if (!this.syncEnabled) return;
        
        try {
            // Find and delete from Firestore
            const videosRef = window.FirebaseFunctions.collection(this.firestore, 'videos');
            const q = window.FirebaseFunctions.query(videosRef, window.FirebaseFunctions.where('localId', '==', id));
            const querySnapshot = await window.FirebaseFunctions.getDocs(q);
            
            querySnapshot.forEach(async (doc) => {
                await window.FirebaseFunctions.deleteDoc(doc.ref);
            });
            
        } catch (error) {
            console.warn('Failed to delete video from cloud:', error);
        }
    }

    // Essay operations (enhanced with cloud sync)
    async addEssay(file, title) {
        // Add locally first
        const localId = await this.localDb.addEssay(file, title);
        
        if (!this.syncEnabled) return localId;
        
        try {
            // Upload PDF to Firebase Storage
            const storageRef = window.FirebaseFunctions.ref(this.storage, `essays/${Date.now()}_${title}.pdf`);
            const snapshot = await window.FirebaseFunctions.uploadBytes(storageRef, file);
            const downloadURL = await window.FirebaseFunctions.getDownloadURL(snapshot.ref);
            
            // Add to Firestore
            const essayData = {
                localId,
                title,
                downloadURL,
                mime: 'application/pdf',
                size: file.size,
                order: Date.now(),
                createdAt: new Date().toISOString()
            };
            
            await window.FirebaseFunctions.addDoc(
                window.FirebaseFunctions.collection(this.firestore, 'essays'),
                essayData
            );
            
            return localId;
            
        } catch (error) {
            console.warn('Failed to sync essay to cloud:', error);
            return localId;
        }
    }

    async getAllEssays() {
        // Try cloud first if online
        if (this.syncEnabled) {
            try {
                const essaysRef = window.FirebaseFunctions.collection(this.firestore, 'essays');
                const querySnapshot = await window.FirebaseFunctions.getDocs(essaysRef);
                
                const essays = [];
                for (const doc of querySnapshot.docs) {
                    const data = doc.data();
                    
                    // Fetch the PDF blob for local compatibility
                    let pdfBlob = null;
                    try {
                        const response = await fetch(data.downloadURL);
                        pdfBlob = await response.blob();
                    } catch (error) {
                        console.warn('Failed to fetch PDF blob:', error);
                    }
                    
                    essays.push({
                        id: data.localId || doc.id,
                        cloudId: doc.id,
                        title: data.title,
                        pdfBlob: pdfBlob,
                        downloadURL: data.downloadURL,
                        mime: data.mime,
                        size: data.size,
                        order: data.order,
                        createdAt: data.createdAt
                    });
                }
                
                // Sort by order
                essays.sort((a, b) => (a.order || 0) - (b.order || 0));
                
                return essays;
            } catch (error) {
                console.warn('Failed to get essays from cloud, using local:', error);
            }
        }
        
        // Fallback to local storage
        return await this.localDb.getAllEssays();
    }

    async deleteEssay(id) {
        // Delete locally first
        await this.localDb.deleteEssay(id);
        
        if (!this.syncEnabled) return;
        
        try {
            // Find and delete from Firestore and Storage
            const essaysRef = window.FirebaseFunctions.collection(this.firestore, 'essays');
            const q = window.FirebaseFunctions.query(essaysRef, window.FirebaseFunctions.where('localId', '==', id));
            const querySnapshot = await window.FirebaseFunctions.getDocs(q);
            
            querySnapshot.forEach(async (doc) => {
                const data = doc.data();
                
                // Delete from Storage
                try {
                    const storageRef = window.FirebaseFunctions.ref(this.storage, data.downloadURL);
                    await window.FirebaseFunctions.deleteObject(storageRef);
                } catch (storageError) {
                    console.warn('Failed to delete essay file from storage:', storageError);
                }
                
                // Delete from Firestore
                await window.FirebaseFunctions.deleteDoc(doc.ref);
            });
            
        } catch (error) {
            console.warn('Failed to delete essay from cloud:', error);
        }
    }

    // Utility methods
    async syncAlbumToCloud(album) {
        try {
            // Check if already exists
            const albumsRef = window.FirebaseFunctions.collection(this.firestore, 'albums');
            const q = window.FirebaseFunctions.query(albumsRef, window.FirebaseFunctions.where('localId', '==', album.id));
            const querySnapshot = await window.FirebaseFunctions.getDocs(q);
            
            if (querySnapshot.empty) {
                // Create new
                await window.FirebaseFunctions.addDoc(albumsRef, {
                    localId: album.id,
                    name: album.name,
                    order: album.order || Date.now(),
                    createdAt: album.createdAt || new Date().toISOString(),
                    photos: []
                });
            }
        } catch (error) {
            console.warn('Failed to sync album to cloud:', error);
        }
    }

    async syncEssayToCloud(essay) {
        try {
            // Check if already exists
            const essaysRef = window.FirebaseFunctions.collection(this.firestore, 'essays');
            const q = window.FirebaseFunctions.query(essaysRef, window.FirebaseFunctions.where('localId', '==', essay.id));
            const querySnapshot = await window.FirebaseFunctions.getDocs(q);
            
            if (querySnapshot.empty && essay.pdfBlob) {
                // Upload PDF and create record
                const storageRef = window.FirebaseFunctions.ref(this.storage, `essays/${Date.now()}_${essay.title}.pdf`);
                const snapshot = await window.FirebaseFunctions.uploadBytes(storageRef, essay.pdfBlob);
                const downloadURL = await window.FirebaseFunctions.getDownloadURL(snapshot.ref);
                
                await window.FirebaseFunctions.addDoc(essaysRef, {
                    localId: essay.id,
                    title: essay.title,
                    downloadURL: downloadURL,
                    mime: essay.mime,
                    size: essay.size,
                    order: essay.order || Date.now(),
                    createdAt: essay.createdAt || new Date().toISOString()
                });
            }
        } catch (error) {
            console.warn('Failed to sync essay to cloud:', error);
        }
    }

    async syncVideoToCloud(video) {
        try {
            // Check if already exists
            const videosRef = window.FirebaseFunctions.collection(this.firestore, 'videos');
            const q = window.FirebaseFunctions.query(videosRef, window.FirebaseFunctions.where('localId', '==', video.id));
            const querySnapshot = await window.FirebaseFunctions.getDocs(q);
            
            if (querySnapshot.empty) {
                // Create new
                await window.FirebaseFunctions.addDoc(videosRef, {
                    localId: video.id,
                    provider: video.provider,
                    url: video.url,
                    embedId: video.embedId,
                    title: video.title,
                    order: video.order || Date.now(),
                    createdAt: video.createdAt || new Date().toISOString()
                });
            }
        } catch (error) {
            console.warn('Failed to sync video to cloud:', error);
        }
    }

    // Real-time change handlers
    handleRealtimeAlbumChange(change) {
        // Handle real-time album updates from other devices
        console.log('Album change detected:', change.type, change.doc.data());
        
        // Trigger UI refresh if needed
        if (window.app && window.app.currentTab === 'photos') {
            window.app.loadPhotosTab();
        }
    }

    handleRealtimeEssayChange(change) {
        // Handle real-time essay updates from other devices
        console.log('Essay change detected:', change.type, change.doc.data());
        
        // Trigger UI refresh if needed
        if (window.app && window.app.currentTab === 'essays') {
            window.app.loadEssaysTab();
        }
    }

    handleRealtimeVideoChange(change) {
        // Handle real-time video updates from other devices
        console.log('Video change detected:', change.type, change.doc.data());
        
        // Trigger UI refresh if needed
        if (window.app && window.app.currentTab === 'video') {
            window.app.loadVideosTab();
        }
    }

    // Status methods
    isCloudSyncEnabled() {
        return this.syncEnabled;
    }

    getConnectionStatus() {
        return {
            online: this.isOnline,
            cloudSync: this.syncEnabled,
            firebase: !!window.firestore
        };
    }

    // Initialize default videos (keep existing behavior)
    async initializeDefaultVideos() {
        return await this.localDb.initializeDefaultVideos();
    }

    // Passthrough methods for compatibility
    async renameAlbum(id, name) {
        return await this.localDb.renameAlbum(id, name);
    }

    async reorderAlbums(idsInOrder) {
        return await this.localDb.reorderAlbums(idsInOrder);
    }

    async addPhoto(albumId, file) {
        return await this.localDb.addPhoto(albumId, file);
    }

    async getPhotosByAlbum(albumId) {
        return await this.localDb.getPhotosByAlbum(albumId);
    }

    async removePhoto(photoId) {
        return await this.localDb.removePhoto(photoId);
    }

    async reorderPhotos(albumId, idsInOrder) {
        return await this.localDb.reorderPhotos(albumId, idsInOrder);
    }

    async renameEssay(id, title) {
        return await this.localDb.renameEssay(id, title);
    }

    async reorderEssays(idsInOrder) {
        return await this.localDb.reorderEssays(idsInOrder);
    }

    async reorderVideos(idsInOrder) {
        return await this.localDb.reorderVideos(idsInOrder);
    }

    async exportAll() {
        return await this.localDb.exportAll();
    }

    async importAll(data) {
        const result = await this.localDb.importAll(data);
        
        // Sync imported data to cloud
        if (this.syncEnabled) {
            await this.syncLocalToCloud();
        }
        
        return result;
    }

    parseVideoUrl(url) {
        return this.localDb.parseVideoUrl(url);
    }
}

// Replace the global database instance with Firebase-enhanced version
window.addEventListener('DOMContentLoaded', async () => {
    // Wait for the original db to be available
    while (!window.db) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Create Firebase-enhanced database
    const firebaseDb = new FirebaseDatabase();
    
    try {
        await firebaseDb.init();
        // Replace the global db instance
        window.db = firebaseDb;
        console.log('Firebase database initialized successfully');
    } catch (error) {
        console.error('Firebase database initialization failed, using local storage only:', error);
    }
});