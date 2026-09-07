-- ============================================
-- V1: Initial Schema for Skill Swap
-- ============================================
-- Compatible with both PostgreSQL and H2 (MODE=PostgreSQL)

-- Users table
CREATE TABLE users (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL,
    email       VARCHAR(255)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    bio         TEXT,
    avatar_url  VARCHAR(500),
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- Skills table
CREATE TABLE skills (
    id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name     VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(100) NOT NULL
);

CREATE INDEX idx_skills_name ON skills(name);
CREATE INDEX idx_skills_category ON skills(category);

-- User-Skill join table
CREATE TABLE user_skills (
    id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id  BIGINT       NOT NULL,
    skill_id BIGINT       NOT NULL,
    type     VARCHAR(10)  NOT NULL CHECK (type IN ('TEACH', 'LEARN')),
    level    VARCHAR(20)  NOT NULL CHECK (level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')),

    CONSTRAINT fk_user_skills_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    CONSTRAINT fk_user_skills_skill FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_skill_type   UNIQUE (user_id, skill_id, type)
);

CREATE INDEX idx_user_skills_user  ON user_skills(user_id);
CREATE INDEX idx_user_skills_skill ON user_skills(skill_id);

-- Groups table
CREATE TABLE groups (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    skill_id    BIGINT       NOT NULL,
    owner_id    BIGINT       NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_groups_skill FOREIGN KEY (skill_id) REFERENCES skills(id),
    CONSTRAINT fk_groups_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE INDEX idx_groups_skill ON groups(skill_id);
CREATE INDEX idx_groups_owner ON groups(owner_id);

-- Group members join table
CREATE TABLE group_members (
    id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id  BIGINT      NOT NULL,
    user_id   BIGINT      NOT NULL,
    role      VARCHAR(10) NOT NULL CHECK (role IN ('OWNER', 'MEMBER')),
    joined_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_group_members_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    CONSTRAINT fk_group_members_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
    CONSTRAINT uq_group_member        UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user  ON group_members(user_id);

-- Posts (group discussion feed)
CREATE TABLE posts (
    id         BIGINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id   BIGINT    NOT NULL,
    author_id  BIGINT    NOT NULL,
    content    TEXT      NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_posts_group  FOREIGN KEY (group_id)  REFERENCES groups(id) ON DELETE CASCADE,
    CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX idx_posts_group ON posts(group_id);

-- Sessions (scheduled learning events)
CREATE TABLE sessions (
    id               BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id         BIGINT       NOT NULL,
    title            VARCHAR(200) NOT NULL,
    description      TEXT,
    scheduled_at     TIMESTAMP    NOT NULL,
    location_or_link VARCHAR(500),
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sessions_group FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_group ON sessions(group_id);
CREATE INDEX idx_sessions_scheduled ON sessions(scheduled_at);

-- Messages (real-time group chat)
CREATE TABLE messages (
    id         BIGINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    group_id   BIGINT    NOT NULL,
    sender_id  BIGINT    NOT NULL,
    content    TEXT      NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_messages_group  FOREIGN KEY (group_id)  REFERENCES groups(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id)
);

CREATE INDEX idx_messages_group ON messages(group_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- Seed some initial skills
INSERT INTO skills (name, category) VALUES
    ('Java', 'Programming'),
    ('Python', 'Programming'),
    ('JavaScript', 'Programming'),
    ('TypeScript', 'Programming'),
    ('React', 'Web Development'),
    ('Spring Boot', 'Web Development'),
    ('SQL', 'Databases'),
    ('Guitar', 'Music'),
    ('Piano', 'Music'),
    ('Photography', 'Creative'),
    ('Drawing', 'Creative'),
    ('Public Speaking', 'Communication'),
    ('Spanish', 'Languages'),
    ('French', 'Languages'),
    ('Machine Learning', 'Data Science'),
    ('Data Analysis', 'Data Science'),
    ('UI/UX Design', 'Design'),
    ('Cooking', 'Lifestyle'),
    ('Yoga', 'Health & Fitness'),
    ('Chess', 'Games & Strategy');
