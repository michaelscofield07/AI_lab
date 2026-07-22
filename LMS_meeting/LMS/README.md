# Continuous Telemetry Client: Learning Management System (LMS)

This repository contains a simple, high-fidelity **Learning Management System (LMS)** client application. It serves as a demo testbed for integrating our **AI-Based Behavioural Biometrics Security Platform** JavaScript SDK to collect continuous typing, navigation, and telemetry data.

The project highlights two major biometric-rich environments:
1. **Coding Practice Sandbox**: A LeetCode-style split-pane environment featuring an embedded **Monaco Editor** where users solve programming challenges that execute on a sandboxed Node.js VM.
2. **Timed Quizzes**: An exam interface with timed controls, question navigation, flag-for-review matrices, and auto-grading.

---

## 🚀 Key Features

### 🔐 Authentication & Session Security
- **Role-Based Routing**: Restricts views by roles (`student`, `teacher`, `admin`) using React Router guards.
- **JWT Authorization**: Enforces bearer tokens on all API endpoints.
- **Dark Mode Support**: Dynamic global theme toggler synced with browser LocalStorage.

### 🎓 Classroom & Course Management
- **Teacher Panel**: Allows instructors to publish new courses, create coding assignments (with custom test-case matrices), publish MCQ quizzes, and track submission analytics.
- **Student Dashboard**: Includes class enrollment, progress visualization charts using Recharts, classroom details, coding challenges, and timed quizzes.
- **Admin Control Panel**: Features user directories, role modifications, and global statistics.

---

## 🛠️ Technology Stack

### Backend
- **Framework**: Node.js & Express
- **Database**: MongoDB (via Mongoose)
- **Security**: JWT & bcryptjs
- **Code Executor**: Sandboxed runner using Node's native `vm` module

### Frontend
- **Framework**: React 19 (scaffolded via Vite)
- **Styling**: Tailwind CSS
- **Interactions**: Monaco Editor, Recharts, Lucide Icons

---

## 📦 Local Setup & Installation

### Prerequisites
- Node.js (v18+)
- MongoDB running locally on port `27017`

### 1. Database Setup
Start your local MongoDB instance. If running in the default workspace configuration, you can start it using the custom shell script:
```bash
bash "/home/vijay/behaviour analysis/start_mongodb.sh"
```

### 2. Install Dependencies
Run npm install in the root folder, backend, and frontend directories:
```bash
# Install root monorepo scripts
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 3. Start Development Servers
Run the concurrent dev command at the root level to launch both the backend (port `5000`) and the Vite client (port `5173`):
```bash
npm run dev
```

---

## 🌐 Exposing via ngrok (Single Tunnel Proxy)

To expose this project to the public internet or external telemetry listeners, we route all requests through a single ngrok tunnel. Vite is configured to reverse-proxy `/api` requests to the local backend on port `5000` and allows connection headers from dynamic hosts.

1. **Start your local backend and client servers**:
   ```bash
   npm run dev
   ```
2. **Expose the frontend port (5173) using ngrok**:
   ```bash
   ngrok http 5173
   ```
3. **Access the app**: Copy the generated `https://*.ngrok-free.app` URL and open it in any browser or remote device. All authentication, code submissions, and database endpoints will work out-of-the-box.
