# 🔄 Skill Swap

**Trade Skills, Not Cash** — A community learning platform where users create and join skill-sharing groups to teach and learn from each other.

## 🏗️ Architecture

Monorepo with:
- **`backend/`** — Java 21 + Spring Boot 3 REST API
- **`frontend-web/`** — React 18 + TypeScript + Vite + Tailwind CSS
- **`shared/types/`** — Shared TypeScript type definitions (web + future mobile)
- **`docs/`** — API specification and architecture documentation

## 🚀 Quick Start

### Prerequisites
- Java 21+ ([download](https://www.oracle.com/java/technologies/downloads/))
- Node.js 18+ ([download](https://nodejs.org/))
- Docker & Docker Compose (optional, for PostgreSQL)

### Option A: With Docker (recommended)
```bash
# Clone and start everything
git clone <repo-url> skill-swap
cd skill-swap
cp .env.example .env
docker-compose up
```
- Backend: http://localhost:8080
- Frontend: http://localhost:5173

### Option B: Without Docker (H2 in-memory DB)

**Start the backend:**
```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```
Backend runs at http://localhost:8080

**Start the frontend:**
```bash
cd frontend-web
npm install
npm run dev
```
Frontend runs at http://localhost:5173

## 🧪 Running Tests

**Backend:**
```bash
cd backend
./mvnw test
```

**Frontend:**
```bash
cd frontend-web
npm test
```

## 📁 Project Structure

```
skill-swap/
├── backend/                  # Spring Boot API
│   ├── src/main/java/        # Application code
│   ├── src/main/resources/   # Config + Flyway migrations
│   └── src/test/java/        # Tests
├── frontend-web/             # React + Vite
│   └── src/                  # Application code
├── shared/types/             # Shared TS types
├── docs/                     # Documentation
├── .github/workflows/        # CI pipeline
├── docker-compose.yml        # Local dev environment
└── .env.example              # Environment variables template
```

## 📖 Documentation

- [API Specification](docs/api-spec.md)
- [Architecture](docs/architecture.md)

## 🛡️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 21, Spring Boot 3, Spring Security, Spring Data JPA |
| Database | PostgreSQL 16 (H2 for dev) |
| Migrations | Flyway |
| Auth | JWT (access + refresh tokens) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| API State | TanStack Query |
| Real-time | WebSocket (STOMP) |
| Testing | JUnit 5 + Mockito, Vitest + React Testing Library |
| CI | GitHub Actions |
