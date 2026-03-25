# 📦 CourierTrack Pro
### A Production-Grade MERN Stack Parcel Management System

> Real-time parcel tracking, role-based access control, live GPS, and automated email notifications — all in one platform.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20App-2563eb?style=for-the-badge)](https://curier-client.vercel.app/)
[![Backend API](https://img.shields.io/badge/Backend%20API-Render-10b981?style=for-the-badge)](https://curier-server.onrender.com)
[![Client Repo](https://img.shields.io/badge/GitHub-Client%20Repo-181717?style=for-the-badge&logo=github)](https://github.com/rahman2220510189/curier_client)
[![Server Repo](https://img.shields.io/badge/GitHub-Server%20Repo-181717?style=for-the-badge&logo=github)](https://github.com/rahman2220510189/curier_server)

---

## 🚀 What Is This?

CourierTrack Pro is a **full-stack courier and parcel management platform** built entirely solo using the MERN stack. It handles the complete lifecycle of a parcel — from customer booking to live agent tracking to admin reporting — with real-time updates powered by Socket.IO.

This is not a tutorial clone. Every feature was designed, architected, and deployed from scratch to solve real logistics challenges.

---

## ✨ Core Features

### 👤 Customer Portal
- Book parcel pickups with full address details, size/type selection, and COD or Prepaid payment method
- Track parcels in **real-time** with live status updates and map location
- View complete booking history with status timeline

### 🚴 Delivery Agent Portal
- View all assigned parcels with customer details
- Update parcel status: `Picked Up → In Transit → Delivered / Failed`
- Send **live GPS coordinates** to the tracking system in real time

### 🛡️ Admin Dashboard
- Monitor daily metrics: bookings, COD collection, deliveries
- View **7-day booking trend charts**
- Assign parcels to available agents with automatic **email notifications**
- Export detailed booking reports as **CSV**
- View per-agent COD collection summaries
- Manage all users and parcels from a single panel

---

## 🧰 Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React.js, Tailwind CSS, React Router, Axios (with Interceptors), Socket.IO Client, Lucide React |
| **Backend** | Node.js, Express.js, MongoDB Native Driver, Socket.IO, Nodemailer, JWT, bcryptjs, Helmet |
| **Database** | MongoDB Atlas (NoSQL) with efficient indexing |
| **Advanced** | Real-time communication, Email notifications, QR Code generation, Refresh token rotation |

---

## 🏗️ Architecture Overview

```
courier-tracking-project/
├── courier-backend/
│   ├── index.js              # Server entry: Routes, DB, Middleware, Socket.IO
│   └── .env                  # Environment configuration
│
└── courier-tracking-frontend/
    └── src/
        ├── components/       # UI components (Admin, Customer, Layout)
        ├── context/          # AuthContext (global auth state)
        ├── hooks/            # useAuth, useSocket
        ├── services/         # api.js (Axios), socket.js (Socket client)
        └── utils/            # helpers.js
```

---

## 🔐 Demo Credentials

Try all three roles live — no signup required:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@example.com | admin123 |
| **Agent** | agent@example.com | agent123 |
| **Customer** | customer@example.com | customer123 |

🔗 **[Open Live App](https://curier-client.vercel.app/)**

---

## ⚙️ Local Setup

### Prerequisites
- Node.js v18+
- MongoDB Atlas account
- Gmail account with App Password (for email notifications)

### 1. Clone the repositories

```bash
# Client
git clone https://github.com/rahman2220510189/curier_client
cd curier_client

# Server
git clone https://github.com/rahman2220510189/curier_server
cd curier_server
```

### 2. Backend Setup

```bash
cd courier-backend
npm install
```

Create a `.env` file:

```env
PORT=5000

# MongoDB Atlas
DB_USER=your_mongo_user
DB_PASS=your_mongo_pass
MONGO_URI="mongodb+srv://${DB_USER}:${DB_PASS}@cluster0.cjuyyb2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Email (Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_16_digit_app_password

# Frontend URL
CLIENT_URL=http://localhost:5173
```

> **Note:** Use a Gmail App Password for `SMTP_PASS`. Enable 2FA on your Google account first.

```bash
npm start
```

### 3. Frontend Setup

```bash
cd courier-tracking-frontend
npm install
```

Create a `.env.local` file:

```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

```bash
npm run dev
```

---

## 🌐 Deployment

| Environment | URL |
|-------------|-----|
| Frontend (Vercel) | https://curier-client.vercel.app/ |
| Backend API (Render) | https://curier-server.onrender.com |
| Backend Health Check | https://curier-server.onrender.com/health |

---

## 👨‍💻 Built By

**Md. Naymur Rahman**
Full Stack Developer | React · Node.js · Python · AI

[![GitHub](https://img.shields.io/badge/GitHub-rahman2220510189-181717?style=flat&logo=github)](https://github.com/rahman2220510189)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-md--naymur--rahman-0077b5?style=flat&logo=linkedin)](https://linkedin.com/in/md-naymur-rahman-5101894d)
