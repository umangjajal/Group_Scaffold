# Realtime Group App - Scaffold
This scaffold includes:
- Backend: Node.js + Express + Socket.IO signaling server (offer/answer/candidates) with quota enforcement (demo/in-memory + Mongoose-ready).
- Frontend: Vite + React simple app with CallPreview and InCall WebRTC sample components.

This is a minimal starting point for development. See `.env.example` for configuration.

Run backend:
```bash
cd backend
npm install
# set env vars in .env or .env.local
node server.js
```

Run frontend:
```bash
cd frontend
npm install
npm run dev
```

Files included:
- backend/server.js
- backend/socket/index.js
- backend/models/CallQuota.js
- backend/models/CallSession.js
- backend/.env.example
- frontend (Vite React) with CallPreview and InCall components

Notes:
- TURN/STUN and SFU templates provided in `infra/`.
- The backend includes a **demo in-memory quota** so you can test without MongoDB. For production, set MONGO_URL in env and install mongoose.
