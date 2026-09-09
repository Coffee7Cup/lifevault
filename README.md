# Project Structure

This project is a monorepo consisting of:

- `frontend/`: Next.js frontend for the LifeVault web application.
- `backend/`: FastAPI backend handling authentication, vault operations, AI services, and APIs.
- `database/`: PostgreSQL schema and migration files.
- `docs/`: Project documentation and architecture notes.
- `assets/`: Static assets such as logos and icons.

## Getting Started

### Prerequisites

Install the following before running the project:

- Python 3.11+
- Node.js 18+ (npm or Bun)
- PostgreSQL 15+
- Git
- Docker (optional)

Verify the installation:

```bash
python --version
node -v
npm -v
git --version
psql --version
```

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Chandan3101/lifevault.git
cd lifevault
```

### 2. Create the Database

Login to PostgreSQL and run:

```sql
CREATE DATABASE lifevault;
```

If migration files are available, run them.

```bash
psql -U postgres -d lifevault -f database/init.sql
```

### 3. Backend Environment

Navigate to the backend folder.

```bash
cd backend
```

Create a virtual environment.

```bash
python -m venv .venv
```

Activate it.

**Windows**

```bash
.venv\Scripts\activate
```

**Linux/macOS**

```bash
source .venv/bin/activate
```

Install dependencies.

```bash
pip install -r requirements.txt
```

Create a `.env` file.

```env
DATABASE_URL=postgresql://username:password@localhost/lifevault
OPENAI_API_KEY=your_api_key
JWT_SECRET=your_secret_key
```

## Backend

Start the backend server.

```bash
cd backend
uvicorn main:app --reload
```

The backend will be available at:

```
http://localhost:8000
```

Swagger API documentation:

```
http://localhost:8000/docs
```

## Frontend

Open another terminal.

Navigate to the frontend directory.

```bash
cd frontend
```

Install dependencies.

```bash
npm install
```

Start the development server.

```bash
npm run dev
```

Open your browser:

```
http://localhost:3000
```

## Running the Complete Project

Keep both terminals running.

| Service | URL |
|---------|-----|
| Frontend | `http://localhost:3000` |
| Backend | `http://localhost:8000` |
| API Docs | `http://localhost:8000/docs` |

## Features

- Secure encrypted document vault
- AI-powered document assistant
- Family and nominee management
- Sanctuary Mode for emergency access
- Asset and inheritance planning
- Advisor collaboration portal
- JWT authentication
- Role-Based Access Control
- AES-256 encryption
- Audit logging

## Running with Docker

If Docker is installed:

```bash
docker-compose up --build
```

This starts:

- Frontend
- Backend
- PostgreSQL

## Running on LAN (Wi-Fi/Ethernet)

To access LifeVault from another device on the same network:

### 1. Find your local IP

**Windows**

```bash
ipconfig
```

**Linux/macOS**

```bash
ip addr
```

Example:

```
192.168.1.25
```

### 2. Run the frontend

```bash
npm run dev -- --host
```

### 3. Run the backend

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Open from another device

Frontend:

```
http://192.168.1.25:3000
```

Backend:

```
http://192.168.1.25:8000
```

## Troubleshooting

### `npm` is not recognized

Install Node.js and restart the terminal.

### `python` is not recognized

Reinstall Python and enable **Add Python to PATH**.

### Database connection failed

- Make sure PostgreSQL is running.
- Verify the `DATABASE_URL` in `.env`.
- Confirm the `lifevault` database exists.

### Port already in use

Stop the application using the port or change the port number.