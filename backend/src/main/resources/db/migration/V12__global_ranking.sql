ALTER TABLE battles ADD COLUMN ranked_level VARCHAR(2);
ALTER TABLE battles ADD COLUMN ranked_result VARCHAR(36);
CREATE TABLE ranking_guard (id INTEGER PRIMARY KEY);
INSERT INTO ranking_guard(id) VALUES (1);
CREATE TABLE ranking_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    level VARCHAR(2) NOT NULL,
    season INTEGER NOT NULL,
    rating DOUBLE PRECISION NOT NULL DEFAULT 1500,
    deviation DOUBLE PRECISION NOT NULL DEFAULT 350,
    volatility DOUBLE PRECISION NOT NULL DEFAULT 0.06,
    games INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(user_id, level, season)
);
CREATE INDEX ranking_board_idx ON ranking_profiles(season, level, rating DESC);
CREATE TABLE ranked_questions (
    id UUID PRIMARY KEY,
    level VARCHAR(2) NOT NULL,
    content TEXT NOT NULL
);
CREATE TABLE ranked_matches (
    id UUID PRIMARY KEY REFERENCES battles(id),
    season INTEGER NOT NULL,
    level VARCHAR(2) NOT NULL,
    first_user UUID NOT NULL REFERENCES users(id),
    second_user UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'MATCHED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    first_before DOUBLE PRECISION,
    second_before DOUBLE PRECISION,
    first_after DOUBLE PRECISION,
    second_after DOUBLE PRECISION,
    outcome VARCHAR(20)
);
CREATE INDEX ranked_recent_idx ON ranked_matches(first_user, second_user, created_at DESC);
CREATE TABLE ranked_queue (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    level VARCHAR(2) NOT NULL,
    season INTEGER NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL,
    match_id UUID REFERENCES ranked_matches(id)
);
