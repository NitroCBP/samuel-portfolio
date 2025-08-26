# Sam Pinkelman World

A complete single-page web application showcasing Sam Pinkelman's work through photos, essays, and videos. Built with vanilla JavaScript, featuring a liquid glass UI design and offline-first architecture using IndexedDB.

## Features

- **Liquid Glass Design**: Modern frosted glass UI with backdrop blur effects
- **Offline-First**: All assets stored in IndexedDB, no server required
- **Admin Mode**: Password-protected content management system
- **Photo Albums**: Create, manage, and view photo collections with lightbox gallery
- **Essay Reader**: Upload and view PDF documents with built-in reader
- **Video Embeds**: Support for YouTube and Vimeo video embedding
- **Asset Management**: Upload and manage background images, logos, and favicons
- **Data Backup**: Complete export/import functionality for all app data
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Accessibility**: Keyboard navigation and screen reader support

## Quick Start

1. **Open the Application**
   - Navigate to the project folder and open `public/index.html` in any modern web browser
   - Or serve it with a simple HTTP server: `python -m http.server 8000` (then visit `http://localhost:8000/public/`)
   - The app works entirely client-side, no backend required

2. **Initial Setup**
   - The app will load with default video content
   - Click "Admin" in the top-right to enter admin mode
   - Use password: `A21bcW34SamPinkWorld`

## Admin Mode

### Entering Admin Mode

1. Click the "Admin" button in the top-right corner
2. Enter the admin password: `A21bcW34SamPinkWorld`
3. The interface will now show additional controls and edit buttons

**Security Note**: The password protection is client-side only and not secure for protecting sensitive content. It's designed for convenience, not security.

### Exiting Admin Mode

- Click "Exit Admin" button in the top-right corner
- Refresh the page to return to viewer mode

## Managing Content

### Photos

#### Creating Albums
1. Enter Admin mode
2. Go to the Photos tab
3. Click "Create Album"
4. Enter an album name and click "Create"

#### Adding Photos to Albums
1. Click on an album to open the gallery
2. In Admin mode, click "Add Photos"
3. Select one or more image files (JPEG, PNG, GIF, WebP)
4. Images are automatically compressed to be under 2MB each

#### Managing Photos
- **Reorder Photos**: Drag and drop photos within an album (Admin mode)
- **Remove Photos**: Click the trash icon on any photo (Admin mode)
- **Rename Album**: Click "Rename Album" in the gallery view (Admin mode)
- **Delete Album**: Click "Delete Album" to remove album and all photos (Admin mode)

#### Viewing Photos
- Click any album to open the gallery view
- Click any photo to open the lightbox viewer
- Use arrow keys or navigation buttons to browse photos
- Press Escape to close the lightbox

### Essays

#### Adding Essays
1. Enter Admin mode
2. Go to the Essays tab
3. Click "Upload PDF"
4. Select one or more PDF files
5. The filename (without .pdf) becomes the essay title

#### Managing Essays
- **Rename Essay**: Click the edit icon on any essay card (Admin mode)
- **Delete Essay**: Click the trash icon on any essay card (Admin mode)
- **Reorder Essays**: Drag and drop essay cards (Admin mode)

#### Reading Essays
- Click any essay card to open the PDF reader
- The PDF opens in a full-screen modal with built-in browser PDF viewer
- Use browser controls for navigation, zoom, etc.

### Videos

#### Adding Videos
1. Enter Admin mode
2. Go to the Video tab
3. Click "Add Video"
4. Enter a YouTube or Vimeo URL
5. Supported formats:
   - `https://www.youtube.com/watch?v=VIDEO_ID`
   - `https://youtu.be/VIDEO_ID`
   - `https://vimeo.com/VIDEO_ID`

#### Managing Videos
- **Remove Videos**: Click the trash icon on any video card (Admin mode)
- **Reorder Videos**: Drag and drop video cards (Admin mode)

#### Default Videos
The app comes pre-seeded with these videos:
- `https://vimeo.com/897021152`
- `https://youtu.be/6fWYLFodV78?si=faMzDuSLOlI8qURQ`
- `https://youtu.be/5E3XuSymtYQ?si=Sx8vyJ8vfHPEDMcU`

## Branding Assets

### Accessing Branding Panel
1. Enter Admin mode
2. Click the gear icon (⚙️) in the top-left corner
3. The branding panel shows current asset status

### Setting Assets

#### Background Image
- Upload: Click "Upload" in the Background Image section
- Accepts: JPEG, PNG, GIF, WebP
- Effect: Sets the full-screen background image with dark overlay

#### Header Logo
- Upload: Click "Upload" in the Header Logo section
- Accepts: JPEG, PNG, GIF, WebP (PNG recommended for transparency)
- Effect: Displays centered at the top of the page

#### Favicon
- Upload: Click "Upload" in the Favicon section  
- Accepts: JPEG, PNG, GIF, WebP (ICO format recommended but not required)
- Effect: Updates the browser tab icon

### Asset Requirements
- All assets are stored in IndexedDB
- Images are automatically resized if needed
- Assets persist across browser sessions
- Assets are included in data backup/restore

## Data Management

### Exporting Data
1. Enter Admin mode
2. Open the branding panel (gear icon)
3. Click "Export All Data"
4. A JSON file will be downloaded containing:
   - All photos (as base64)
   - All essays/PDFs (as base64)
   - All video URLs
   - All album/essay metadata
   - All branding assets

### Importing Data
1. Enter Admin mode
2. Open the branding panel (gear icon)
3. Click "Import Data"
4. Select a previously exported JSON file
5. Confirm the import (this will replace ALL current data)

### Data Storage
- All data is stored in browser's IndexedDB
- Data persists across browser sessions
- Data is tied to the specific browser and origin
- Clear browser data will remove all app content

## Technical Details

### Browser Compatibility
- **Modern Browsers**: Chrome 76+, Firefox 72+, Safari 13.1+, Edge 79+
- **Required Features**: 
  - IndexedDB
  - File API
  - Canvas API (for image compression)
  - CSS backdrop-filter (graceful fallback included)

### File Size Limits
- **Images**: Automatically compressed to ≤ 2MB each
- **PDFs**: No compression, but browser memory limits apply
- **Total Storage**: Limited by browser's IndexedDB quota (typically 50% of available disk space)

### Performance
- **Image Compression**: Client-side compression maintains quality while reducing file size
- **Lazy Loading**: Images load only when needed
- **Object URL Management**: Automatic cleanup to prevent memory leaks
- **Responsive Images**: CSS handles different screen sizes

### Architecture
- **Frontend Only**: No server-side code or database required
- **Modular Design**: Separate files for database, utilities, and main app logic
- **Event-Driven**: Clean separation of concerns with event listeners
- **Accessibility**: ARIA labels, keyboard navigation, focus management

## File Structure

```
/public
  index.html          # Main HTML structure and modals
  styles.css          # Liquid glass CSS styling and responsive design  
  app.js              # Main application logic and event handling
  db.js               # IndexedDB wrapper and data operations
  utils.js            # Utility functions for compression, UI helpers
  /icons              # SVG brand icons
    gmail.svg         # Email icon
    instagram.svg     # Instagram icon  
    twitter.svg       # X/Twitter icon
    linkedin.svg      # LinkedIn icon
README.md            # This documentation
```

## Contact Information

The app displays Sam's contact information:
- **Email**: sam.pinkelman@gmail.com
- **Instagram**: [@samuelpinkelman](https://www.instagram.com/samuelpinkelman/)
- **X/Twitter**: [@PinkelmanSam](https://x.com/PinkelmanSam)
- **LinkedIn**: [Sam Pinkelman](https://www.linkedin.com/in/sam-pinkelman-9b2a5b254/)

## Troubleshooting

### Common Issues

**App won't load**
- Ensure you're using a modern browser
- Check browser console for errors
- Try opening in incognito/private mode

**Admin password not working**
- Ensure exact password: `A21bcW34SamPinkWorld`
- Check for extra spaces or different characters
- Password is case-sensitive

**Images won't upload**
- Check file format (JPEG, PNG, GIF, WebP only)
- Ensure files aren't corrupted
- Try uploading one file at a time

**Large PDF won't open**
- Browser memory limitations may prevent very large PDFs
- Try splitting large PDFs into smaller files

**Backup/restore not working**
- Ensure JSON file is from this app
- Check file isn't corrupted
- Verify browser has enough storage space

### Storage Issues

**Running out of space**
- Export data before clearing storage
- Remove unused photos/essays
- Consider using external storage for large files

**Data disappeared**
- Check if browser data was cleared
- Look for backup files
- Data is tied to specific browser and domain

### Performance Issues

**App running slowly**
- Close other browser tabs
- Clear browser cache (note: this may remove app data)
- Restart browser
- Consider reducing number of stored images

## Development

### Making Changes
The app uses vanilla JavaScript and can be modified directly:

1. **HTML**: Edit `public/index.html` for structure changes
2. **CSS**: Edit `public/styles.css` for styling changes  
3. **JavaScript**: Edit `public/app.js` for functionality changes
4. **Database**: Edit `public/db.js` for data schema changes
5. **Utilities**: Edit `public/utils.js` for helper functions

### Testing Changes
- Open `public/index.html` in browser
- Use browser developer tools for debugging
- Test in multiple browsers for compatibility

### Adding Features
The modular architecture makes it easy to extend:
- Add new tabs by modifying HTML, CSS, and adding handlers in app.js
- Add new data types by extending the database schema in db.js
- Add new utilities by extending utils.js

## License

This project is created for Sam Pinkelman's personal portfolio. Please respect copyright for any uploaded content.

---

**Built with vanilla JavaScript, CSS, and HTML. No frameworks, no build step, no server required.**