CREATE TABLE group_invitations (
    room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    inviter_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(room_id, user_id)
);
CREATE INDEX group_invitation_recipient_idx ON group_invitations(user_id, created_at DESC);
