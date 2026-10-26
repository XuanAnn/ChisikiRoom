CREATE TABLE practice_attempts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    question_set_id UUID NOT NULL REFERENCES question_sets(id),
    title VARCHAR(120) NOT NULL,
    question_snapshot TEXT NOT NULL,
    answers TEXT NOT NULL,
    correct_count INTEGER NOT NULL DEFAULT 0,
    question_count INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX practice_user_history_idx ON practice_attempts(user_id, started_at DESC);
CREATE INDEX practice_user_quiz_idx ON practice_attempts(user_id, question_set_id, finished_at DESC);
