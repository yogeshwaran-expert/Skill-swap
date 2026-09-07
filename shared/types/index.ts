// ============================================
// Skill Swap — Shared TypeScript Types
// ============================================
// These types mirror the backend DTOs and are shared
// between frontend-web and (future) frontend-mobile.

// --- Enums ---

export type SkillType = 'TEACH' | 'LEARN';

export type MemberRole = 'OWNER' | 'MEMBER';

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

// --- API Envelope ---

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  message: string;
  code: string;
}

// --- Auth ---

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

// --- User ---

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  skills: UserSkillDto[];
  createdAt: string;
}

export interface UpdateUserRequest {
  name?: string;
  bio?: string;
}

export interface UserSkillDto {
  id: number;
  skill: SkillDto;
  type: SkillType;
  level: SkillLevel;
}

export interface AddUserSkillRequest {
  skillId: number;
  type: SkillType;
  level: SkillLevel;
}

// --- Skill ---

export interface SkillDto {
  id: number;
  name: string;
  category: string;
}

// --- Group ---

export interface GroupDto {
  id: number;
  name: string;
  description: string;
  skill: SkillDto;
  owner: UserSummaryDto;
  memberCount: number;
  createdAt: string;
}

export interface CreateGroupRequest {
  name: string;
  description: string;
  skillId: number;
}

export interface GroupMemberDto {
  user: UserSummaryDto;
  role: MemberRole;
  joinedAt: string;
}

export interface UserSummaryDto {
  id: number;
  name: string;
  avatarUrl: string | null;
}

// --- Post ---

export interface PostDto {
  id: number;
  author: UserSummaryDto;
  content: string;
  createdAt: string;
}

export interface CreatePostRequest {
  content: string;
}

// --- Session ---

export interface SessionDto {
  id: number;
  title: string;
  description: string;
  scheduledAt: string;
  locationOrLink: string;
  createdAt: string;
}

export interface CreateSessionRequest {
  title: string;
  description: string;
  scheduledAt: string;
  locationOrLink: string;
}

// --- Message (WebSocket) ---

export interface MessageDto {
  id: number;
  sender: UserSummaryDto;
  content: string;
  createdAt: string;
}

export interface SendMessageRequest {
  content: string;
}

// --- Pagination ---

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}
