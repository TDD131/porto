# Tech Stack & Build System

## Frontend

- **Vanilla HTML/CSS/JS** — no framework, no bundler
- **ES Modules** via `<script type="module">` with CDN imports
- **Firebase SDK v10.8.0** loaded from `https://www.gstatic.com/firebasejs/10.8.0/`
- **Lenis v1.0.42** for smooth scroll (CDN ESM import)
- **Iconify** for icons (CDN script tag)
- **Google Fonts**: Inter (body) + Playfair Display (headings)

## Backend

- **Node.js + Express** — local dev server and API proxy
- **Multer** — file upload handling (memory storage)
- **node-fetch** — server-side HTTP requests
- **Firebase Firestore** — database for all content
- **Firebase Storage** — file storage
- **Firebase Auth** — admin authentication

## External Services

- **Cloudinary** — image hosting (uploaded via server proxy at `/api/upload-cloudinary`)
- **GitHub Releases** — .blend file hosting (uploaded via `/api/upload-github`)
- **Sketchfab** — 3D model embedding
- **Google Gemini API** — AI description generation in admin

## Hosting & Deployment

- **Vercel** — primary hosting (vercel.json for rewrites/redirects)
- **Firebase Hosting** — secondary/legacy (firebase.json)

## Common Commands

```bash
# Start local dev server (Express on port 3000)
npm run dev

# Or use the batch file
Z-StartServer.cmd

# Deploy (Vercel)
vercel --prod

# Firebase deploy (if using Firebase hosting)
npx firebase deploy
```

## Key Conventions

- No build step — files are served as-is
- Firebase SDK imported directly from CDN in browser (no npm firebase package for frontend)
- Server-side dependencies managed via npm (express, multer, node-fetch, form-data)
- `firebase-tools` is a devDependency for CLI operations only
