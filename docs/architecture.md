# Skill Swap — Architecture

## Overview

Skill Swap is a community learning platform built as a monorepo with a Java Spring Boot backend and React TypeScript frontend. The architecture supports future expansion to React Native mobile.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
│  ┌──────────────────────┐    ┌─────────────────────────────┐    │
│  │  frontend-web/       │    │  (future) frontend-mobile/  │    │
│  │  React + TS + Vite   │    │  React Native               │    │
│  │  Tailwind CSS        │    │                             │    │
│  └──────────┬───────────┘    └──────────┬──────────────────┘    │
│             │   REST + WebSocket        │                       │
│             └───────────┬───────────────┘                       │
│                         │ shared/types/                         │
└─────────────────────────┼───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API Gateway                               │
│                  Spring Boot 3 (port 8080)                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Security Layer: JWT Auth Filter → SecurityContext       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐    │
│  │ Auth     │ │ User     │ │ Group    │ │ WebSocket/STOMP│    │
│  │Controller│ │Controller│ │Controller│ │ /ws endpoint   │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘    │
│       │             │            │                │             │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐         │             │
│  │AuthSvc   │ │UserSvc   │ │GroupSvc  │         │             │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘         │             │
│       │             │            │                │             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Spring Data JPA Repositories                │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │ Flyway Migrations               │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    PostgreSQL 16     │
                    │  (H2 for local dev) │
                    └──────────────────────┘
```

## Monorepo Structure

```
skill-swap/
├── backend/          # Spring Boot 3 API server
├── frontend-web/     # React + TypeScript + Vite
├── shared/types/     # Shared TS type definitions (web + future mobile)
├── docs/             # API spec + architecture docs
├── .github/          # CI workflows
└── docker-compose.yml
```

## Key Design Decisions

### 1. Monorepo with Shared Types
TypeScript interfaces in `shared/types/` mirror backend DTOs, ensuring frontend-backend contract consistency. The future React Native app imports the same types.

### 2. JWT Authentication
- **Access tokens** (15 min expiry): Sent in `Authorization: Bearer` header
- **Refresh tokens** (7 day expiry): Used to obtain new access tokens
- Stateless — no server-side session storage

### 3. Database Strategy
- **Production**: PostgreSQL 16 via Docker
- **Development**: H2 in-memory (no Docker required)
- **Migrations**: Flyway with portable SQL syntax

### 4. API Response Envelope
All responses wrapped in `{ data, error }` for consistent client-side handling.

### 5. File Storage Abstraction
`FileStorageService` interface with `LocalFileStorageService` implementation. S3/Cloudinary can be swapped via configuration.

### 6. Real-time Communication
STOMP over WebSocket for group chat. Each group has a topic `/topic/group/{id}`. Messages are persisted to the `messages` table.

## Entity Relationships

```
User 1──N UserSkill N──1 Skill
User 1──N GroupMember N──1 Group
User 1──N Post N──1 Group
User 1──N Message N──1 Group
Group 1──N Session
Group N──1 Skill (primary skill)
Group N──1 User (owner)
```
