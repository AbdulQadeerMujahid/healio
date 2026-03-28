<<<<<<< HEAD
# Health Connect - Smart Healthcare Platform

A modern full-stack healthcare application with real-time appointments, built with React, Node.js, MongoDB, and Socket.IO.

## ✨ Features

- **Patient Dashboard**: Browse doctors, book appointments, real-time updates
- **Doctor Dashboard**: Manage appointments, accept/reject/reschedule
- **Real-time Notifications**: Instant updates via Socket.IO
- **Modern UI**: Built with React, Vite, and Tailwind CSS
- **Analytics Dashboard**: Charts and insights with Chart.js
- **File Upload**: Document and image handling
- **Authentication**: Secure JWT-based auth system

## 🚀 Quick Start

### Local Development (Monorepo)
```bash
# Install dependencies
npm install

# Setup environment variables
npm run setup:prod

# Start development servers
npm run dev
```

### Production Deployment (Vercel)
```bash
# Build for production
npm run build

# Deploy to Vercel
bash deploy.vercel.sh
```

## 🏗️ Architecture

- **Frontend**: React + Vite (served from `/`)
- **Backend**: Vercel Serverless Functions (in `/api/`)
- **Database**: MongoDB Atlas
- **Real-time**: Socket.IO
- **Styling**: Tailwind CSS
- **Build**: Optimized for production
- Login as patient → book appointment
- Login as doctor (in another browser window) → see real-time request and act
- Patient dashboard updates in real-time on accept/reschedule/reject

## 🔑 **Environment Variables for Vercel**

### **Required Variables (Set in Vercel Dashboard):**

```bash
# 1. MongoDB Atlas Connection String (REQUIRED)
MONGODB_URI=mongodb+srv://Vercel-Admin-Health-Connect:3mpoSBxMevqD8eC4@health-connect.lrj8cw8.mongodb.net/healthconnect?retryWrites=true&w=majority

# 2. JWT Secret for Authentication (REQUIRED)
JWT_SECRET=df2545394d42b3926c00a6f9cf101b16676496f76ac10951bb15f89f517ae141058f3e237c8a2ee84b7bf847b001b52f6c6ec4d67276cab663ce6865c46d3d85

# 3. Client Origin for CORS (Auto-filled by Vercel)
CLIENT_ORIGIN=https://your-project-name.vercel.app
```

### **How to Set in Vercel:**

1. **Go to Vercel Dashboard:**
   - Select your project → Settings → Environment Variables

2. **Add Each Variable:**
   ```
   Variable Name: MONGODB_URI
   Value: mongodb+srv://yourusername:yourpassword@cluster0.xxxxx.mongodb.net/healthconnect?retryWrites=true&w=majority

   Variable Name: JWT_SECRET
   Value: your-super-secret-jwt-key-12345-abcdef

   Variable Name: CLIENT_ORIGIN
   Value: https://your-project-name.vercel.app
   ```

3. **Generate JWT Secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

### **MongoDB Setup:**
1. Go to https://cloud.mongodb.com
2. Create account (free tier available)
3. Create cluster → Connect → Connect your application
4. Copy connection string and update:
   - Replace `<username>` with your MongoDB username
   - Replace `<password>` with your MongoDB password
   - Replace `<cluster>` with your cluster details
   - Database name: `healthconnect`

### **Client Configuration:**
- ✅ **No additional environment variables needed**
- ✅ **API URL automatically detected** (same domain + `/api`)
- ✅ **Works in both development and production**

## 🚀 **Quick Deploy:**

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login and deploy
vercel login
vercel --prod

# 3. Set environment variables in Vercel dashboard
# 4. Your app will be live at: https://your-project.vercel.app
```

## ✨ **Auto-Configuration Features:**

- 🔄 **API URL Detection:** Automatically uses correct API URL in production
- 🌐 **CORS Handling:** CLIENT_ORIGIN auto-configured by Vercel
- 📱 **Responsive UI:** Works on all devices without additional config
- ⚡ **Real-time Updates:** Polling mechanism replaces Socket.IO
- 🔒 **Secure Authentication:** JWT tokens with proper validation

### API Endpoints (when deployed):

- **Authentication:**
  - `POST /api/auth/register` - Register new user
  - `POST /api/auth/login` - Login user
  - `GET /api/auth/me` - Get current user

- **Appointments:**
  - `GET /api/appointments/doctors` - List all doctors
  - `POST /api/appointments` - Create appointment (patients)
  - `GET /api/appointments/me` - Get user's appointments
  - `PATCH /api/appointments/:id` - Update appointment status (doctors)
  - `POST /api/appointments/:id/notes` - Add notes (doctors)
  - `POST /api/appointments/:id/messages` - Send messages
  - `GET /api/appointments/poll` - Poll for updates (replaces Socket.IO)

### Real-time Updates:
- **Replaces Socket.IO** with polling mechanism
- Client polls `/api/appointments/poll` every 5 seconds
- Shows real-time notifications for appointment updates

### Features:
- ✅ **Modern UI** with teal accent theme
- ✅ **Real-time updates** via polling
- ✅ **Multi-language support** (English, Hindi, Marathi)
- ✅ **Drag-and-drop file upload** with OCR
- ✅ **Heart rate monitoring** charts
- ✅ **Professional healthcare dashboard**
- ✅ **Responsive design** for all devices
- ✅ **Serverless architecture** optimized for Vercel
=======
# healio
Health Tech based project 
>>>>>>> 2b37aa19d47657be4db350e4b15bd92a7ccf3032
