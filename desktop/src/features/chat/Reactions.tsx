import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Popover, Space } from 'antd';
import { SmileOutlined } from '@ant-design/icons';
import { request, errorMessage } from '../../lib/api';
type Reaction = { messageId: number; userId: string; emoji: string };
export function useRoomReactions(roomId: string, joined: boolean) {
  const [rows, setRows] = useState<Reaction[]>([]);
  const [error, setError] = useState('');
  const current = useRef(roomId);
  current.current = roomId;
  const refresh = useCallback(async () => {
    if (joined) {
      const data = await request<Reaction[]>('reactions', { id: roomId });
      if (current.current === roomId) {
        setRows(data);
      }
    }
  }, [roomId, joined]);
  useEffect(() => {
    setRows([]);
    refresh().catch((e) => setError(errorMessage(e)));
    return window.chisiki?.onEvent((e) => {
      if (e.type === 'REACTIONS_CHANGED' && e.data.roomId === roomId) {
        refresh().catch(() => {});
      }
      if (e.type === 'CONNECTION' && e.data === 'online') {
        refresh().catch(() => {});
      }
    });
  }, [refresh, roomId]);
  async function toggle(messageId: number, emoji: string) {
    setError('');
    try {
      await request('toggleReaction', { id: roomId, messageId, emoji });
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return { rows, toggle, error };
}
export function ReactionBar({
  rows,
  messageId,
  userId,
  onToggle,
}: {
  rows: Reaction[];
  messageId: number;
  userId: string;
  onToggle: (id: number, emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const mine = rows.filter((r) => r.messageId === messageId);
  const choices = ['👍', '❤️', '🎉', '😂', '🔥'];
  return (
    <div className="reaction-bar">
      {choices
        .filter((emoji) => mine.some((r) => r.emoji === emoji))
        .map((emoji) => (
          <Button
            size="small"
            type={
              mine.some((r) => r.emoji === emoji && r.userId === userId) ? 'primary' : 'default'
            }
            key={emoji}
            onClick={() => onToggle(messageId, emoji)}
          >
            {emoji} {mine.filter((r) => r.emoji === emoji).length}
          </Button>
        ))}
      <Popover
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        trigger="click"
        content={
          <Space>
            {choices.map((emoji) => (
              <Button
                type="text"
                key={emoji}
                onClick={() => {
                  setPickerOpen(false);
                  onToggle(messageId, emoji);
                }}
              >
                {emoji}
              </Button>
            ))}
          </Space>
        }
      >
        <Button type="text" size="small" icon={<SmileOutlined />} aria-label="Thêm reaction" />
      </Popover>
    </div>
  );
}
