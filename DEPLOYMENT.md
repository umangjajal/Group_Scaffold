# Deployment Guide

## Backend Deployment (Render)

**Status:** ✅ Deployed at `https://group-scaffold.onrender.com`

### Environment Variables on Render:
Copy all variables from `backend/.env` to Render's environment variables:
- `PORT=4000`
- `CORS_ORIGIN=http://localhost:5173,https://your-vercel-url.vercel.app`
- `JWT_SECRET=aV5#z$L8!t@G7n*pQ2rS9u&w%C4FhJkM`
- `EMAIL_FROM=umangjajal@gmail.com`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_USER=umangjajal@gmail.com`
- `SMTP_PASS=lhfq juyn znob xhyr`
- `NODE_ENV=production`
- `MONGO_URL=mongodb+srv://Group_Scaffold:Scaffold999@cluster0.3ipcuzl.mongodb.net/?appName=Cluster0`
- `USE_MONGO=true`

---

## Frontend Deployment (Vercel)

### Steps to Deploy on Vercel:

1. **Connect your GitHub repo to Vercel**
   - Go to https://vercel.com
   - Click "New Project"
   - Import your GitHub repository

2. **Set Environment Variables on Vercel:**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add the following variables:
     ```
     VITE_API_URL=https://group-scaffold.onrender.com
     VITE_API_WS_URL=wss://group-scaffold.onrender.com
     ```

3. **Configure Build Settings:**
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Root Directory: `./frontend` (if Vercel doesn't auto-detect)

4. **Deploy:**
   - Vercel will automatically deploy on push to main branch
   - Your app will be available at `https://your-project.vercel.app`

---

## Update Backend CORS After Getting Vercel URL

Once you have your Vercel URL (e.g., `https://my-app.vercel.app`):

1. **Update Render backend CORS:**
   - Go to Render dashboard
   - Find your service
   - Edit environment variables
   - Update `CORS_ORIGIN` to include your Vercel URL:
     ```
     http://localhost:5173,https://my-app.vercel.app
     ```
   - Save and redeploy

2. **Update backend/.env locally:**
   - Change `CORS_ORIGIN=http://localhost:5173,https://my-app.vercel.app`

---

## Testing Deployment

After everything is deployed:

1. **Test Backend API:**
   ```
   curl https://group-scaffold.onrender.com/health
   ```
   Should return: `{"status":"healthy","timestamp":"..."}`

2. **Test Frontend:**
   - Open your Vercel URL in browser
   - Test login, create accounts, join rooms
   - Check browser console for any errors

3. **Test Socket.io:**
   - Open room in two different browsers
   - Send messages - should appear in real-time

---

## Troubleshooting

### CORS Errors
- Make sure Vercel URL is added to `CORS_ORIGIN` on Render

### WebSocket Connection Fails
- Ensure frontend uses `wss://` (secure WebSocket) for production
- Check Network tab in browser DevTools

### Email Not Sending in Production
- Verify SMTP credentials are correct in Render environment
- Check Render logs: `Render logs` tab in dashboard

### Socket.io Connection Issues
- Check browser console for connection errors
- Verify `VITE_API_WS_URL` is set correctly
- Look for CORS + WebSocket policy issues

---

## Frontend URLs Reference

| Environment | URL |
|-------------|-----|
| Local Dev | http://localhost:5173 |
| Vercel Production | https://your-project.vercel.app |
| Backend API | https://group-scaffold.onrender.com |
| Backend WebSocket | wss://group-scaffold.onrender.com |

