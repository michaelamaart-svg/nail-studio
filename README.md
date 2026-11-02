# Stylish Tipzz

Stylish Tipzz runs as an installable offline web app and as a Windows desktop app. Preview your five nails on an illustrated hand and use only photos from your own library.

## Windows desktop app

1. Install Node.js.
2. Run `npm install`.
3. Run `npm start` to open the desktop app.
4. Run `npm run dist:win` to create the Windows installer in `dist/`.

The installer is not code-signed, so Windows may show a SmartScreen warning. The desktop app stores uploaded photos and design preferences in its local app storage.

## Installable web app

Serve this folder from a secure origin (HTTPS, or localhost for local testing). Open it in a browser that supports PWAs and select **Install app** when offered. On mobile browsers, use the browser's **Add to Home Screen** option.

The service worker caches the app shell for offline use. Uploaded photos and design settings stay on the device and are not uploaded to a server.
