# Realtime Group App - Advanced Collaboration Scaffold

This scaffold now includes:
- **Realtime collaboration core** for documents, code, and spreadsheets.
- **Git-inspired versioning** with snapshots, restore support, and audit logs.
- **Socket.IO collaboration channels** for live patch sync, cursor presence, mentions, and spreadsheet cell updates.
- **Secure code execution endpoint** using Docker sandboxing.

## Architecture additions

### Backend
- `backend/routes/collab.js`
  - File CRUD by group
  - Version history & restore
  - Activity filtering
  - Containerized code run endpoint (`/api/collab/code/run`)
- New models:
  - `CollabFile` (content + comments + permissions)
  - `CollabVersion` (snapshots + branches + restore lineage)
  - `ActivityLog` (audit events)
  - `Notification` (mentions/file change alerts)
- `backend/socket/collab.js`
  - `collab:file:*` realtime file join/patch/cursor/comment flows
  - Spreadsheet lock handling + live updates

### Frontend
- `frontend/src/pages/Collaboration.jsx`
  - Multi-file workspace
  - Document/code live editing surface
  - Spreadsheet live cell editing
  - Version history + restore actions
  - Audit feed + inline comments

## Socket event flow (new)
- `collab:file:join` -> snapshot + presence
- `collab:file:cursor` -> multi-user cursor broadcast
- `collab:file:patch` -> synced updates + version checkpoint
- `collab:file:comment` -> inline comments + mention notifications
- `notification:new` -> user-level push notifications

## Migration notes (basic -> advanced)
1. Run app with latest schema changes (MongoDB auto-creates collections).
2. Add env values from root `.env.example` into:
   - `backend/.env`
   - `frontend/.env`
3. Optional scaling:
   - Provide `REDIS_URL`
   - Set `SOCKET_REDIS_ENABLED=true`
   - Install redis adapter packages and wire adapter (currently scaffold warning).
4. Optional secure code execution:
   - Install Docker on backend host
   - Configure `CODE_RUNNER_*` variables

## Run locally

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Notes
- Current real-time sync uses operation patches with snapshot versioning (interview-friendly baseline).
- For production massive concurrency, evolve to formal CRDT/OT engine and Redis adapter wiring.
