# Deployment Guide

This document provides instructions for setting up and deploying the Realtime Group Application.

## Prerequisites
- Node.js (>= 20.19.0)
- Docker & Docker Compose
- MongoDB & Redis (if running locally without Docker)

## Local Development (with Docker)
1. Clone the repository.
2. Create a `.env` file in the root directory (using `.env.example` as a template).
3. Run the following command:
   ```bash
   docker-compose up --build
   ```
4. Access the frontend at `http://localhost:80` (production-ready build) or `http://localhost:5173` (development server).

## Running Tests
### Backend
```bash
cd backend
npm run test
```
### Frontend
```bash
cd frontend
npm run test
```

## CI/CD Pipeline
This project uses **GitHub Actions** for CI/CD. The pipeline is defined in `.github/workflows/ci.yml` and automatically runs on every push and pull request to the `main` and `develop` branches.
- **Backend Job**: Installs dependencies, builds the project, and runs Vitest.
- **Frontend Job**: Installs dependencies, builds the project, and runs Vitest.

## Production Deployment
The recommended way to deploy is using the provided Dockerfiles.

### Backend
The backend Dockerfile uses a multi-stage build to minimize the image size.
- Stage 1: Build the TypeScript project.
- Stage 2: Serve the compiled JavaScript from the `dist/` directory.

### Frontend
The frontend Dockerfile builds the Vite project and serves the static assets using Nginx.

## Environment Variables
Ensure the following variables are set in your production environment:
- `MONGO_URL`: Connection string for MongoDB.
- `REDIS_URL`: Connection string for Redis.
- `JWT_SECRET`: Secret key for JWT signing.
- `FIREBASE_PROJECT_ID`: (Optional) For Firebase Auth.
- `FRONTEND_URL`: The URL where the frontend is hosted.
