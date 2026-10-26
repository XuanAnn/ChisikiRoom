import { useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { ArrowDownOutlined, MessageOutlined } from '@ant-design/icons';
import { type ChatMessage, type Room } from '../../lib/api';
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
}: {
  room: Room;
  messages: ChatMessage[];
  userId: string;
  more: boolean;
  busy: boolean;
  onLoadMore: () => void;
  reactions: Reactions;
}) {
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
              <article className={ownMessage ? 'message message-mine' : 'message'}>
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
                  <p>{message.content}</p>
                  <ReactionBar
                    rows={reactions.rows}
                    messageId={message.id}
                    userId={userId}
                    onToggle={reactions.toggle}
                  />
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
