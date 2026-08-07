# Aspen Spas — Service Ticket System

Mobile-first service ticket app. **100% free** — uses only Firebase Firestore (Spark plan, no credit card needed).

## Quick Start (10 minutes)

### Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add Project"** → name it `aspen-spas-tickets` → Create
3. Click the **Web icon** `</>` to add a web app
4. Name it `aspen-tickets` → **Register app**
5. Copy the config values

### Step 2: Enable Firestore

1. Firebase Console → **Build** → **Firestore Database**
2. Click **"Create database"** → **"Start in test mode"** → Next
3. Location: **us-central** → Enable
4. Go to **Rules** tab, paste this, click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tickets/{ticketId} {
      allow read, write: if true;
    }
  }
}
```

**That's it! No Storage needed.** Photos compress and store in Firestore.

### Step 3: Add Your Config

Edit `firebase-config.js` with your Firebase values:

```js
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB...",
  authDomain: "aspen-spas-tickets.firebaseapp.com",
  projectId: "aspen-spas-tickets",
  storageBucket: "aspen-spas-tickets.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
const ADMIN_PIN = "5050";
```

### Step 4: Upload to GitHub + Enable Pages

```bash
git init && git add . && git commit -m "init"
git branch -M main
git remote add origin https://github.com/YOUR_USER/aspen-tickets.git
git push -u origin main
```

Settings → Pages → Branch: main → Save

Your site: `https://YOUR_USER.github.io/aspen-tickets/`

## Free Tier (Spark Plan — no credit card)

- 1 GB Firestore = ~1000+ tickets with photos
- 50K reads/day, 20K writes/day
- Photos compressed to ~50-80KB each
- https://aspen-ai.serviceaspen096.workers.dev CLOUDFLARE

- 
