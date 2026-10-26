ALTER TABLE chat_rooms ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'GROUP';
ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_kind_check CHECK (kind IN ('GROUP','DIRECT'));
CREATE TABLE direct_chats (
    room_id UUID PRIMARY KEY REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_low UUID NOT NULL REFERENCES users(id),
    user_high UUID NOT NULL REFERENCES users(id),
    UNIQUE(user_low,user_high),
    CHECK(user_low<>user_high)
);
