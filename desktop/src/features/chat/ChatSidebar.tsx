import { useState } from 'react';
import { Button, Input, Tooltip } from 'antd';
import {
  BookOutlined,
  LockOutlined,
  LogoutOutlined,
  PlusOutlined,
  TeamOutlined,
  HomeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { type Member, type Room, type User } from '../../lib/api';
import { UserAvatar } from '../../components/UserAvatar';
import './sidebar.css';
import { matchesSearch } from '../../lib/search';
import { type WorkspaceTab } from './useWorkspaceActivity';

type Props = {
  user: User;
  friends: Member[];
  rooms: Room[];
  roomId: string;
  tab: WorkspaceTab;
  unread: Record<string, number>;
  drafts: Record<string, string>;
  onShowHome: () => void;
  online: boolean;
  openingFriend: string | null;
  onShowChat: () => void;
  onShowQuizzes: () => void;
  onCreateGroup: () => void;
  onSelectRoom: (id: string) => void;
  onOpenFriend: (friend: Member) => void;
  onLogout: () => void;
};

export function ChatSidebar(props: Props) {
  const [query, setQuery] = useState('');
  const { user, friends, rooms, roomId, tab } = props;
  const visibleFriends = friends.filter((friend) => matchesSearch(friend.displayName, query));
  const groups = rooms.filter((room) => room.kind !== 'DIRECT' && matchesSearch(room.name, query));
  const active = rooms.find((room) => room.id === roomId);
  return (
    <aside className="room-sidebar split-chat-sidebar">
      <h2>
        <span className="sidebar-brand-mark">知</span>
        <div>
          ChisikiRoom<span>HỌC CÙNG NHAU</span>
        </div>
      </h2>
      <div className="workspace">KHÔNG GIAN CỦA BẠN</div>
      <button
        className={tab === 'home' ? 'sidebar-link selected' : 'sidebar-link'}
        onClick={props.onShowHome}
      >
        <HomeOutlined /> Tổng quan
      </button>
      <button
        className={tab === 'chat' ? 'sidebar-link selected' : 'sidebar-link'}
        onClick={props.onShowChat}
      >
        <TeamOutlined /> Phòng trò chuyện
      </button>
      <button
        className={tab === 'quiz' ? 'sidebar-link selected' : 'sidebar-link'}
        onClick={props.onShowQuizzes}
      >
        <BookOutlined /> Bộ câu hỏi
      </button>
      <Input
        className="sidebar-search"
        aria-label="Tìm bạn bè và nhóm"
        placeholder="Tìm bạn bè, nhóm…"
        prefix={<SearchOutlined />}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        allowClear
      />
      <div className="sidebar-chat-sections">
        <section className="sidebar-chat-section" aria-labelledby="friend-chats-heading">
          <div className="sidebar-section-heading">
            <h3 id="friend-chats-heading">CHAT BẠN BÈ</h3>
            <span>{visibleFriends.length}</span>
          </div>
          <div
            className="sidebar-scroll-list"
            role="region"
            aria-label="Danh sách chat bạn bè"
            tabIndex={0}
          >
            {visibleFriends.length ? (
              visibleFriends.map((friend) => {
                const directRoom = rooms.find(
                  (room) => room.kind === 'DIRECT' && room.peerId === friend.id,
                );
                const unread = directRoom ? props.unread[directRoom.id] || 0 : 0;
                const draft = directRoom ? props.drafts[directRoom.id] : '';
                return (
                  <button
                    key={friend.id}
                    className={
                      tab === 'chat' && active?.kind === 'DIRECT' && active.peerId === friend.id
                        ? 'friend-chat-link active'
                        : 'friend-chat-link'
                    }
                    disabled={props.openingFriend === friend.id}
                    onClick={() => props.onOpenFriend(friend)}
                    aria-label={`Chat với ${friend.displayName}`}
                    aria-current={
                      tab === 'chat' && active?.kind === 'DIRECT' && active.peerId === friend.id
                        ? 'page'
                        : undefined
                    }
                  >
                    <span className="sidebar-friend-avatar">
                      <UserAvatar id={friend.id} name={friend.displayName} />
                      <span
                        className={friend.online ? 'friend-presence online' : 'friend-presence'}
                        aria-label={friend.online ? 'Đang hoạt động' : 'Ngoại tuyến'}
                      />
                    </span>
                    <span className="sidebar-chat-name">
                      <b>{friend.displayName}</b>
                      <small>
                        {draft
                          ? 'Bản nháp chưa gửi'
                          : friend.online
                            ? 'Đang trực tuyến'
                            : 'Chat riêng · Gọi video'}
                      </small>
                    </span>
                    {unread > 0 && (
                      <span className="unread-badge" title="Tin mới nhận trong phiên">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                    {props.openingFriend === friend.id && (
                      <span className="sidebar-opening">…</span>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="sidebar-list-empty">
                {query ? 'Không tìm thấy bạn phù hợp.' : 'Kết bạn để bắt đầu trò chuyện riêng.'}
              </p>
            )}
          </div>
        </section>

        <section
          className="sidebar-chat-section group-chat-section"
          aria-labelledby="group-chats-heading"
        >
          <div className="sidebar-section-heading">
            <h3 id="group-chats-heading">CHAT NHÓM</h3>
            <span>{groups.length}</span>
            <Tooltip title="Tạo nhóm chat">
              <Button
                type="text"
                size="small"
                aria-label="Tạo nhóm chat"
                icon={<PlusOutlined />}
                onClick={props.onCreateGroup}
              />
            </Tooltip>
          </div>
          <div
            className="sidebar-scroll-list"
            role="region"
            aria-label="Danh sách chat nhóm"
            tabIndex={0}
          >
            {groups.length ? (
              groups.map((room) => (
                <button
                  key={room.id}
                  className={
                    room.id === roomId && tab === 'chat'
                      ? 'group-chat-link active'
                      : 'group-chat-link'
                  }
                  onClick={() => props.onSelectRoom(room.id)}
                  aria-current={room.id === roomId && tab === 'chat' ? 'page' : undefined}
                >
                  <span className="sidebar-group-symbol" aria-hidden="true">
                    {room.privateRoom ? <LockOutlined /> : '#'}
                  </span>
                  <span className="sidebar-chat-name">
                    <b>{room.name}</b>
                    <small>
                      {props.drafts[room.id]
                        ? 'Bản nháp chưa gửi'
                        : `${room.privateRoom ? 'Nhóm riêng' : 'Công khai'} · ${room.memberCount} thành viên`}
                    </small>
                  </span>
                  {props.unread[room.id] > 0 ? (
                    <span className="unread-badge" title="Tin mới nhận trong phiên">
                      {props.unread[room.id] > 99 ? '99+' : props.unread[room.id]}
                    </span>
                  ) : (
                    <small>{room.memberCount}</small>
                  )}
                </button>
              ))
            ) : (
              <p className="sidebar-list-empty">Chưa có nhóm chat. Bấm + để tạo nhóm.</p>
            )}
          </div>
        </section>
      </div>

      <footer className="chat-sidebar-footer">
        <UserAvatar id={user.id} name={user.displayName} />
        <div className="profile-name">
          {user.displayName}
          <small className={props.online ? 'online' : ''}>
            {props.online ? '● Đã kết nối' : '○ Đang kết nối lại…'}
          </small>
        </div>
        <Tooltip title="Đăng xuất">
          <Button type="text" icon={<LogoutOutlined />} onClick={props.onLogout} />
        </Tooltip>
      </footer>
    </aside>
  );
}
