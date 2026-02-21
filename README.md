# Realtime Group App - Scaffold
This scaffold includes:
- Backend: Node.js + Express + Socket.IO signaling server (P2P call + multi-participant meeting signaling) with quota enforcement.
- Frontend: Vite + React room dashboard with live video grid, chat, and realtime task board.

This is a collaboration-focused scaffold. Copy `.env.example` values into `backend/.env` and `frontend/.env` before running.

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
