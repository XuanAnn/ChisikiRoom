CREATE TABLE battles (
    id UUID PRIMARY KEY,
    room_id UUID REFERENCES chat_rooms(id) ON DELETE SET NULL,
    question_set_id UUID NOT NULL REFERENCES question_sets(id),
    owner_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    question_snapshot TEXT,
    round_no INTEGER NOT NULL DEFAULT 0,
    sequence BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE battle_players (
    battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    score INTEGER NOT NULL DEFAULT 0,
    ready BOOLEAN NOT NULL DEFAULT FALSE,
    camera BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unavailable_since TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(battle_id,user_id)
);
CREATE TABLE battle_rounds (
    id UUID PRIMARY KEY,
    battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    round_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    question_snapshot TEXT NOT NULL,
    deadline_at TIMESTAMP WITH TIME ZONE NOT NULL,
    next_question_at TIMESTAMP WITH TIME ZONE,
    winner_id UUID REFERENCES users(id),
    resolution_reason VARCHAR(20),
    UNIQUE(battle_id,round_no)
);
CREATE TABLE battle_answers (
    round_id UUID NOT NULL REFERENCES battle_rounds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    request_id UUID NOT NULL UNIQUE,
    option_index INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(round_id,user_id)
);
CREATE TABLE battle_score_events (
    round_id UUID NOT NULL REFERENCES battle_rounds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    delta INTEGER NOT NULL,
    PRIMARY KEY(round_id,user_id)
);
CREATE TABLE battle_events (
    id UUID PRIMARY KEY,
    battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
    sequence BIGINT NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(battle_id,sequence)
);
CREATE INDEX battle_events_pending_idx ON battle_events(published,created_at);
