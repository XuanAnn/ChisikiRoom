ALTER TABLE chat_room_members ADD COLUMN last_read_id BIGINT NOT NULL DEFAULT 0;
ALTER TABLE chat_room_members ADD COLUMN draft TEXT NOT NULL DEFAULT '';
ALTER TABLE chat_room_members ADD COLUMN draft_version BIGINT NOT NULL DEFAULT 0;
