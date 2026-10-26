import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dropdown, Input, Modal } from 'antd';
import {
  ArrowDownOutlined,
  MessageOutlined,
  MoreOutlined,
  PushpinOutlined,
} from '@ant-design/icons';
import { request, errorMessage, type ChatMessage, type Room } from '../../lib/api';
import { UserAvatar } from '../../components/UserAvatar';
import { ReactionBar, useRoomReactions } from './Reactions';

type Reactions = ReturnType<typeof useRoomReactions>;
export function MessageTimeline({
  room,
  messages,
  userId,
  more,
  busy,
  onLoadMore,
  reactions,
  onReply,
  onChanged,
  canModerate,
}: {
  room: Room;
  messages: ChatMessage[];
  userId: string;
  more: boolean;
  busy: boolean;
  onLoadMore: () => void;
  reactions: Reactions;
  onReply: (message: ChatMessage) => void;
  onChanged: (message: ChatMessage) => void;
  canModerate: (message: ChatMessage) => boolean;
}) {
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [deleting, setDeleting] = useState<ChatMessage | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');
  const [pins, setPins] = useState<ChatMessage[]>([]);
  const [pinsOpen, setPinsOpen] = useState(false);
  const canPin = room.kind === 'DIRECT' || room.ownerId === userId || room.myRole === 'ADMIN';
  useEffect(() => {
    let current = true;
    async function refreshPins() {
      try {
        const rows = await request<ChatMessage[]>('pinnedMessages', { id: room.id });
        if (current) {
          setPins(rows);
        }
      } catch (exception) {
        if (current) {
          setError(errorMessage(exception));
        }
      }
    }
    void refreshPins();
    const timer = window.setInterval(refreshPins, 15000);
    const unsubscribe = window.chisiki?.onEvent((event) => {
      if (event.type === 'MESSAGE_CHANGED' && event.data.roomId === room.id) {
        void refreshPins();
      }
    });
    return () => {
      current = false;
      window.clearInterval(timer);
      unsubscribe?.();
    };
  }, [room.id]);
  async function mutate(action: string, message: ChatMessage, extra: Record<string, unknown> = {}) {
    setActionBusy(true);
    setError('');
    try {
      const updated = await request<ChatMessage>(action, {
        id: room.id,
        messageId: message.id,
        ...extra,
      });
      onChanged(updated);
      setEditing(null);
      setDeleting(null);
      setPins(await request<ChatMessage[]>('pinnedMessages', { id: room.id }));
    } catch (exception) {
      setError(errorMessage(exception));
    } finally {
      setActionBusy(false);
    }
  }
  const container = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const [newMessages, setNewMessages] = useState(false);
  useEffect(() => {
    if (follow.current) {
      bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
      setNewMessages(true);
    }
  }, [messages.at(-1)?.id]);
  function scrollToBottom() {
    follow.current = true;
    setNewMessages(false);
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }
  return (
    <div className="timeline-container">
      {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
      {pins.length > 0 && (
        <Button
          className="pinned-banner"
          icon={<PushpinOutlined />}
          onClick={() => setPinsOpen(true)}
        >
          Tin ghim ({pins.length})
        </Button>
      )}
      <Modal
        title="Tin nhắn đã ghim"
        open={pinsOpen}
        footer={null}
        onCancel={() => setPinsOpen(false)}
      >
        {pins.map((message) => (
          <section className="pinned-message" key={message.id}>
            <strong>{message.displayName}</strong>
            <p>{message.content}</p>
            {canPin && (
              <Button
                disabled={actionBusy}
                onClick={() => void mutate('pinMessage', message, { pinned: false })}
              >
                Bỏ ghim
              </Button>
            )}
          </section>
        ))}
      </Modal>
      <Modal
        title="Sửa tin nhắn"
        open={editing !== null}
        confirmLoading={actionBusy}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        okButtonProps={{ disabled: !editText.trim() }}
        onCancel={() => setEditing(null)}
        onOk={() => {
          if (editing) {
            void mutate('editMessage', editing, { content: editText });
          }
        }}
      >
        <Input.TextArea
          aria-label="Nội dung chỉnh sửa"
          value={editText}
          maxLength={4000}
          autoSize={{ minRows: 3, maxRows: 8 }}
          onChange={(event) => setEditText(event.target.value)}
        />
      </Modal>
      <Modal
        title="Xóa tin nhắn?"
        open={deleting !== null}
        confirmLoading={actionBusy}
        okText="Xóa tin nhắn"
        cancelText="Giữ lại"
        okButtonProps={{ danger: true }}
        onCancel={() => setDeleting(null)}
        onOk={() => {
          if (deleting) {
            void mutate('deleteMessage', deleting);
          }
        }}
      >
        <p>Nội dung sẽ được thay bằng dấu tin nhắn đã xóa, kể cả trong trích dẫn.</p>
      </Modal>
      <div
        className="message-list"
        ref={container}
        onScroll={() => {
          const element = container.current;
          if (element) {
            follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
            if (follow.current) {
              setNewMessages(false);
            }
          }
        }}
      >
        {more && (
          <Button block type="text" loading={busy} onClick={onLoadMore}>
            Tải tin nhắn cũ hơn
          </Button>
        )}
        <div className="chat-welcome">
          <div className="conversation-symbol">
            <MessageOutlined />
          </div>
          <span className="eyebrow">CÙNG NHAU CHIA SẺ</span>
          <h2>
            {room.kind === 'DIRECT'
              ? `Trò chuyện với ${room.name}`
              : `Chào mừng đến với ${room.name}`}
          </h2>
          <p>Một ý tưởng hay luôn bắt đầu từ một cuộc trò chuyện.</p>
        </div>
        {messages.map((message, index) => {
          const date = new Date(message.createdAt).toLocaleDateString('vi-VN');
          const previousDate =
            index > 0 ? new Date(messages[index - 1].createdAt).toLocaleDateString('vi-VN') : '';
          const ownMessage = message.senderId === userId;
          return (
            <div key={message.id}>
              {date !== previousDate && (
                <div className="message-day">
                  <span>{date}</span>
                </div>
              )}
              <article
                data-message-id={message.id}
                className={ownMessage ? 'message message-mine' : 'message'}
              >
                <UserAvatar id={message.senderId} name={message.displayName} />
                <div className="message-content">
                  <div className="message-meta">
                    <b>{message.displayName}</b>
                    <time>
                      {new Date(message.createdAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                  {message.reply && (
                    <blockquote className="message-quote">
                      <strong>{message.reply.displayName}</strong>
                      <span>
                        {message.reply.deleted ? 'Tin nhắn đã xóa' : message.reply.content}
                      </span>
                    </blockquote>
                  )}
                  <p className={message.deletedAt ? 'message-deleted' : undefined}>
                    {message.deletedAt ? 'Tin nhắn đã xóa' : message.content}
                  </p>
                  {message.editedAt && !message.deletedAt && (
                    <small className="message-edited">Đã chỉnh sửa</small>
                  )}
                  {!message.deletedAt && (
                    <div className="message-actions">
                      <Button
                        type="text"
                        size="small"
                        aria-label="Trả lời tin nhắn"
                        onClick={() => onReply(message)}
                      >
                        Trả lời
                      </Button>
                      <Dropdown
                        trigger={['click']}
                        menu={{
                          items: [
                            ...(ownMessage ? [{ key: 'edit', label: 'Sửa tin nhắn' }] : []),
                            ...(ownMessage || canModerate(message)
                              ? [{ key: 'delete', label: 'Xóa tin nhắn', danger: true }]
                              : []),
                            ...(canPin
                              ? [
                                  {
                                    key: 'pin',
                                    label: message.pinnedAt ? 'Bỏ ghim' : 'Ghim tin nhắn',
                                  },
                                ]
                              : []),
                          ],
                          onClick: ({ key }) => {
                            if (key === 'edit') {
                              setEditText(message.content);
                              setEditing(message);
                            } else if (key === 'delete') {
                              setDeleting(message);
                            } else if (key === 'pin') {
                              void mutate('pinMessage', message, { pinned: !message.pinnedAt });
                            }
                          },
                        }}
                      >
                        <Button
                          type="text"
                          size="small"
                          aria-label="Thao tác tin nhắn"
                          icon={<MoreOutlined />}
                        />
                      </Dropdown>
                    </div>
                  )}
                  {!message.deletedAt && (
                    <ReactionBar
                      rows={reactions.rows}
                      messageId={message.id}
                      userId={userId}
                      onToggle={reactions.toggle}
                    />
                  )}
                </div>
              </article>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {newMessages && (
        <Button
          className="new-messages-button"
          icon={<ArrowDownOutlined />}
          onClick={scrollToBottom}
        >
          Tin nhắn mới
        </Button>
      )}
    </div>
  );
}
