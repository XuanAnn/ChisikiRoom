CREATE TABLE learning_goals (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    daily_questions INTEGER NOT NULL DEFAULT 20 CHECK (daily_questions BETWEEN 1 AND 200)
);
