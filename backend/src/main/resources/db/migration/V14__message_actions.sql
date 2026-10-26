ALTER TABLE messages ADD COLUMN reply_to_id BIGINT REFERENCES messages(id);
ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN pinned_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX messages_pinned_idx ON messages(room_id, pinned_at);
