# Skill Swap API Specification

## Base URL
```
http://localhost:8080/api
```

## Response Envelope

All API responses follow this consistent format:

### Success
```json
{
  "data": { ... },
  "error": null
}
```

### Error
```json
{
  "data": null,
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE"
  }
}
```

---

## Auth Endpoints

### POST /auth/signup
Register a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response (201):**
```json
{
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "tokenType": "Bearer",
    "expiresIn": 900
  },
  "error": null
}
```

### POST /auth/login
Authenticate an existing user.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response (200):** Same as signup.

### POST /auth/refresh
Exchange a refresh token for a new access token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response (200):** Same as signup.

---

## User Endpoints

### GET /users/me
Get the authenticated user's profile. Requires `Authorization: Bearer <token>`.

### PUT /users/me
Update the authenticated user's profile.

**Request Body:**
```json
{
  "name": "John Doe",
  "bio": "Full-stack developer who loves teaching"
}
```

### GET /users/{id}
Get a user's public profile.

### POST /users/me/skills
Add a skill to the authenticated user's profile.

**Request Body:**
```json
{
  "skillId": 1,
  "type": "TEACH",
  "level": "INTERMEDIATE"
}
```

### DELETE /users/me/skills/{skillId}
Remove a skill from the authenticated user's profile.

---

## Group Endpoints

### GET /groups
List/search/filter groups.

**Query Parameters:**
- `skill` — filter by skill ID
- `category` — filter by skill category
- `search` — search by group name
- `page` — page number (default: 0)
- `size` — page size (default: 20)

### POST /groups
Create a new group.

**Request Body:**
```json
{
  "name": "Python Study Group",
  "description": "Weekly Python learning sessions",
  "skillId": 1
}
```

### GET /groups/{id}
Get group details.

### POST /groups/{id}/join
Join a group. No request body needed.

### POST /groups/{id}/leave
Leave a group. No request body needed.

### GET /groups/{id}/members
List group members.

---

## Post Endpoints (Group Discussion Feed)

### GET /groups/{id}/posts
List posts in a group.

**Query Parameters:**
- `page` — page number (default: 0)
- `size` — page size (default: 20)

### POST /groups/{id}/posts
Create a new post in a group.

**Request Body:**
```json
{
  "content": "Hey everyone! Who's up for a pair programming session?"
}
```

---

## Session Endpoints

### GET /groups/{id}/sessions
List scheduled sessions in a group.

### POST /groups/{id}/sessions
Create a new session.

**Request Body:**
```json
{
  "title": "Intro to Flask",
  "description": "We'll build a simple REST API together",
  "scheduledAt": "2024-03-15T14:00:00Z",
  "locationOrLink": "https://meet.google.com/abc-defg-hij"
}
```

---

## WebSocket

### Connection
Connect to `/ws` using STOMP over WebSocket.

### Topics
- `/topic/group/{groupId}` — Subscribe to live group chat messages

### Send
- `/app/group/{groupId}/message` — Send a message to a group chat
