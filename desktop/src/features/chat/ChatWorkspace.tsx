import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal, Select, Space, Tooltip } from 'antd';
import {
  BookOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  PaperClipOutlined,
  MoreOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import {
  request,
  errorMessage,
  type User,
  type Room,
  type Member,
  type ChatMessage,
  type Quiz,
} from '../../lib/api';
import { FriendsPanel } from '../community/FriendsPanel';
import { useRoomReactions } from './Reactions';
import { ProfilePanel } from '../auth/ProfilePanel';
import { ChatSidebar } from './ChatSidebar';
import { CallPanel, IncomingCalls } from '../calling/CallPanel';
import { WorkspaceOverview } from './WorkspaceOverview';
import { GroupInvitationsPanel } from '../community/GroupInvitationsPanel';
import { RankingPanel } from '../ranking/RankingPanel';
import { QuizLibrary } from '../quiz/QuizLibrary';
import { RoomContextPanel } from './RoomContextPanel';
import { MessageTimeline } from './MessageTimeline';
import { MessageSearchPanel } from './MessageSearchPanel';
import { useWorkspaceActivity, type WorkspaceTab } from './useWorkspaceActivity';
import './workspace-design.css';
export function ChatWorkspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [friends, setFriends] = useState<Member[]>([]);
  const [openingFriend, setOpeningFriend] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [error, setError] = useState('');
  const [online, setOnline] = useState('offline');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>('chat');
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [privateRoom, setPrivateRoom] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteId, setInviteId] = useState('');
  const [more, setMore] = useState(false);
  const [contextOpen, setContextOpen] = useState(window.innerWidth >= 1180);
  const [contextTab, setContextTab] = useState('members');
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    setSearchOpen(false);
  }, [tab]);
  const [manualInvite, setManualInvite] = useState(false);
  const [uploading, setUploading] = useState(false);
  const activity = useWorkspaceActivity(user.id, roomId, tab);
  const text = activity.drafts[roomId] || '';
  function setText(content: string) {
    activity.setDraft(roomId, content);
  }
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1179px)');
    function updateLayout() {
      if (media.matches) {
        setContextOpen(false);
      }
    }
    media.addEventListener('change', updateLayout);
    return () => media.removeEventListener('change', updateLayout);
  }, []);
  const active = rooms.find((r) => r.id === roomId);
  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.sidebar-search input')?.focus();
      }
      if (event.key.toLowerCase() === 'f' && tab === 'chat' && active?.joined) {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [tab, active?.joined]);
  const isDirect = active?.kind === 'DIRECT';
  const reactions = useRoomReactions(roomId, Boolean(active?.joined));
  const currentRoom = useRef(roomId);
  const pending = useRef(new Map<string, { text: string; id: string }>());
  currentRoom.current = roomId;
  const loadRooms = useCallback(async () => {
    const list = await request<Room[]>('rooms');
    setRooms(list);
    setRoomId((previous) =>
      list.some((r) => r.id === previous)
        ? previous
        : list.find((r) => r.joined)?.id || list[0]?.id || '',
    );
  }, []);
  const loadQuizzes = useCallback(async () => setQuizzes(await request<Quiz[]>('quizzes')), []);
  const loadFriends = useCallback(async () => setFriends(await request<Member[]>('friends')), []);
  const loadRoom = useCallback(async (id: string) => {
    const [history, people] = await Promise.all([
      request<ChatMessage[]>('messages', { id }),
      request<Member[]>('members', { id }),
    ]);
    if (currentRoom.current === id) {
      setMessages((previous) =>
        [
          ...new Map(
            [...history, ...previous.filter((m) => m.roomId === id)].map((m) => [m.id, m]),
          ).values(),
        ].sort((a, b) => a.id - b.id),
      );
      setMembers(people);
      setMore(history.length === 50);
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      loadRooms().catch(() => {});
      loadQuizzes().catch(() => {});
      loadFriends().catch(() => {});
      if (active?.joined) {
        loadRoom(roomId).catch(() => {});
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [loadRooms, loadQuizzes, loadFriends, loadRoom, roomId, active?.joined]);
  useEffect(() => {
    Promise.all([loadRooms(), loadQuizzes(), loadFriends()]).catch((e) =>
      setError(errorMessage(e)),
    );
    window.chisiki?.connection().then(setOnline);
    return window.chisiki?.onEvent((event) => {
      if (
        event.type === 'FRIENDS_CHANGED' ||
        event.type === 'PROFILE_CHANGED' ||
        event.type === 'CONNECTION'
      ) {
        loadFriends().catch(() => {});
      }
      if (event.type === 'CONNECTION') {
        setOnline(event.data);
        if (event.data === 'online') {
          loadRooms().catch((e) => setError(errorMessage(e)));
          if (currentRoom.current) {
            loadRoom(currentRoom.current).catch(() => {});
          }
        }
      }
      if (event.type === 'ROOM_CHANGED') {
        loadRooms().catch((e) => setError(errorMessage(e)));
        if (event.data.roomId === currentRoom.current) {
          loadRoom(currentRoom.current).catch(() => {
            setMessages([]);
            setMembers([]);
          });
        }
      }
      if (event.type === 'MESSAGE_CREATED' && event.data.roomId === currentRoom.current) {
        setMessages((previous) =>
          [...previous.filter((m) => m.id !== event.data.id), event.data].sort(
            (a, b) => a.id - b.id,
          ),
        );
      }
    });
  }, [loadRooms, loadRoom, loadQuizzes, loadFriends]);
  useEffect(() => {
    setMessages([]);
    setMembers([]);
    setMore(false);
    if (active?.joined) {
      loadRoom(roomId).catch((e) => setError(errorMessage(e)));
    }
  }, [roomId, active?.joined, loadRoom]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function openFriend(friend: Member) {
    setOpeningFriend(friend.id);
    setError('');
    try {
      const room = await request<Room>('openDirect', { userId: friend.id });
      await loadRooms();
      setRoomId(room.id);
      setTab('chat');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setOpeningFriend(null);
    }
  }
  async function send() {
    if (busy || !text.trim() || !active?.joined) {
      return;
    }
    const targetRoomId = roomId;
    const sentText = text;
    await act(async () => {
      if (pending.current.get(targetRoomId)?.text !== sentText) {
        pending.current.set(targetRoomId, { text: sentText, id: crypto.randomUUID() });
      }
      const message = await request<ChatMessage>('sendMessage', {
        id: targetRoomId,
        content: sentText,
        requestId: pending.current.get(targetRoomId)!.id,
      });
      if (currentRoom.current === targetRoomId) {
        setMessages((previous) =>
          [...previous.filter((existing) => existing.id !== message.id), message].sort(
            (first, second) => first.id - second.id,
          ),
        );
      }
      pending.current.delete(targetRoomId);
      activity.clearSentDraft(targetRoomId, sentText);
    });
  }

  function selectRoom(id: string) {
    setRoomId(id);
    setTab('chat');
    setSearchOpen(false);
  }

  async function uploadDocument() {
    const targetRoomId = roomId;
    setUploading(true);
    setError('');
    try {
      const result = await window.chisiki?.uploadDocument(targetRoomId);
      if (result?.error) {
        throw new Error(result.error);
      }
      if (result?.data && currentRoom.current === targetRoomId) {
        setContextTab('files');
        setContextOpen(true);
      }
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setUploading(false);
    }
  }

  async function loadOlder() {
    const targetRoomId = roomId;
    await act(async () => {
      const page = await request<ChatMessage[]>('messages', {
        id: targetRoomId,
        before: messages[0]?.id,
      });
      if (currentRoom.current !== targetRoomId) {
        return;
      }
      setMessages((previous) => [
        ...page,
        ...previous.filter((message) => !page.some((older) => older.id === message.id)),
      ]);
      setMore(page.length === 50);
    });
  }

  function leaveRoom() {
    Modal.confirm({
      title: 'Rời phòng này?',
      content: 'Quyền chủ phòng sẽ chuyển cho thành viên tiếp theo.',
      okText: 'Rời phòng',
      cancelText: 'Ở lại',
      onOk: () =>
        act(async () => {
          await request('leaveRoom', { id: roomId });
          await loadRooms();
        }),
    });
  }

  function renderContent() {
    if (tab === 'ranking') {
      return <RankingPanel />;
    }
    if (tab === 'quiz') {
      return <QuizLibrary quizzes={quizzes} />;
    }
    if (tab === 'home' || !active) {
      return (
        <WorkspaceOverview
          user={user}
          friends={friends}
          rooms={rooms}
          quizzes={quizzes}
          unread={activity.unread}
          onCreateGroup={() => setCreateOpen(true)}
          onCreateQuiz={() => window.chisiki?.openWindow('quiz')}
          onShowQuizzes={() => setTab('quiz')}
          onOpenFriend={openFriend}
          onSelectRoom={selectRoom}
        />
      );
    }
    if (!active.joined) {
      return (
        <div className="join-room-screen">
          <div className="join-room-icon">#</div>
          <span className="eyebrow">KHÁM PHÁ CỘNG ĐỒNG</span>
          <h1>{active.name}</h1>
          <p>
            Cùng {active.memberCount} thành viên trò chuyện, chia sẻ tài liệu và học qua Battle.
          </p>
          <div className="join-features">
            <span>
              <MessageOutlined /> Chat realtime
            </span>
            <span>
              <BookOutlined /> Chia sẻ kiến thức
            </span>
          </div>
          <Button
            type="primary"
            size="large"
            loading={busy}
            onClick={() =>
              act(async () => {
                await request('joinRoom', { id: roomId });
                await loadRooms();
              })
            }
          >
            Tham gia phòng
          </Button>
        </div>
      );
    }
    return (
      <div className="chat-body">
        <section className="conversation">
          <MessageTimeline
            key={roomId}
            room={active}
            messages={messages.filter((message) => message.roomId === roomId)}
            userId={user.id}
            more={more}
            busy={busy}
            onLoadMore={loadOlder}
            reactions={reactions}
          />
          <div className="composer">
            <Tooltip title="Đính kèm tài liệu">
              <Button
                type="text"
                aria-label="Đính kèm tài liệu"
                icon={<PaperClipOutlined />}
                loading={uploading}
                onClick={uploadDocument}
              />
            </Tooltip>
            <Input.TextArea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                isDirect ? `Nhắn tin cho ${active.name}` : `Nhắn tin trong # ${active.name}`
              }
              maxLength={4000}
              autoSize={{ minRows: 1, maxRows: 5 }}
              onPressEnter={(event) => {
                if (!event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <Tooltip title="Gửi tin nhắn">
              <Button
                type="primary"
                icon={<SendOutlined />}
                disabled={!text.trim()}
                loading={busy}
                onClick={send}
              />
            </Tooltip>
          </div>
          <div className="composer-hint">
            <span>Enter để gửi · Shift + Enter để xuống dòng</span>
            <span>
              {text.length > 0 ? `${text.length}/4000` : 'Bản nháp riêng cho từng cuộc trò chuyện'}
            </span>
          </div>
        </section>
        {contextOpen && (
          <RoomContextPanel
            key={roomId}
            room={active}
            members={members}
            quizzes={quizzes}
            userId={user.id}
            tab={contextTab}
            onTabChange={setContextTab}
            onInvite={() => setInviteOpen(true)}
            onClose={() => setContextOpen(false)}
          />
        )}
      </div>
    );
  }

  let heading = 'Không gian học tập';
  let subtitle = 'Kết nối, chia sẻ và cùng nhau tiến bộ';
  if (tab === 'ranking') {
    heading = 'Xếp hạng toàn hệ thống';
    subtitle = 'Đấu 1–1 · N5 / N4 · Không tính điểm luyện tập';
  }
  if (tab === 'quiz') {
    heading = 'Bộ câu hỏi của bạn';
    subtitle = 'Xây dựng kiến thức theo cách của bạn';
  }
  if (tab === 'chat' && active) {
    heading = active.name;
    subtitle = isDirect
      ? 'Cuộc trò chuyện bạn bè'
      : `${active.memberCount} thành viên · ${active.privateRoom ? 'Nhóm riêng tư' : 'Nhóm công khai'}`;
  }
  const sectionNames: Record<WorkspaceTab, string> = {
    home: 'Tổng quan',
    chat: 'Trò chuyện',
    quiz: 'Thư viện câu hỏi',
    ranking: 'Xếp hạng',
  };
  const availableFriends = friends.filter(
    (friend) => !members.some((member) => member.id === friend.id),
  );

  return (
    <div className="chat-workspace">
      <ChatSidebar
        user={user}
        friends={friends}
        rooms={rooms}
        roomId={roomId}
        tab={tab}
        online={online === 'online'}
        openingFriend={openingFriend}
        unread={activity.unread}
        drafts={activity.drafts}
        onShowHome={() => setTab('home')}
        onShowRanking={() => setTab('ranking')}
        onShowChat={() => setTab('chat')}
        onShowQuizzes={() => {
          setTab('quiz');
          loadQuizzes().catch((failure) => setError(errorMessage(failure)));
        }}
        onCreateGroup={() => setCreateOpen(true)}
        onSelectRoom={selectRoom}
        onOpenFriend={openFriend}
        onLogout={onLogout}
      />
      <main className="workspace-main">
        <header className="workspace-header">
          <div className="workspace-heading">
            <span className="heading-icon">
              {tab === 'quiz' ? (
                <BookOutlined />
              ) : tab === 'home' ? (
                '知'
              ) : isDirect ? (
                <MessageOutlined />
              ) : (
                '#'
              )}
            </span>
            <div>
              <strong>{heading}</strong>
              <small>{subtitle}</small>
            </div>
          </div>
          <Space size={8}>
            {tab === 'chat' && active?.joined && (
              <>
                <CallPanel key={roomId} room={active} />
                <Tooltip title="Tìm trong lịch sử">
                  <Button
                    type="text"
                    aria-label="Tìm tin nhắn"
                    icon={<SearchOutlined />}
                    onClick={() => setSearchOpen(true)}
                  />
                </Tooltip>
                <Tooltip title="Thông tin, tài liệu và Battle">
                  <Button
                    type={contextOpen ? 'default' : 'text'}
                    aria-label="Thông tin phòng"
                    icon={<InfoCircleOutlined />}
                    onClick={() => setContextOpen(!contextOpen)}
                  />
                </Tooltip>
              </>
            )}
            {tab === 'quiz' && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => window.chisiki?.openWindow('quiz')}
              >
                Tạo bộ câu hỏi
              </Button>
            )}
            <Tooltip title="Làm mới dữ liệu">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={() =>
                  act(async () => {
                    await Promise.all([loadRooms(), loadQuizzes(), loadFriends()]);
                    if (active?.joined) {
                      await loadRoom(roomId);
                    }
                  })
                }
              />
            </Tooltip>
          </Space>
        </header>
        <div className="workspace-tools">
          <div className="workspace-breadcrumb">
            <span className={online === 'online' ? 'live-dot' : 'live-dot offline'} />
            {online === 'online' ? 'Đã kết nối' : 'Đang kết nối lại…'}
            <span className="breadcrumb-separator">/</span>
            <span>{sectionNames[tab]}</span>
          </div>
          <Space size={4}>
            <GroupInvitationsPanel
              onJoined={async (id) => {
                await loadRooms();
                selectRoom(id);
              }}
            />
            <FriendsPanel user={user} />
            <ProfilePanel user={user} />
            {tab === 'chat' && active?.joined && !isDirect && (
              <Tooltip title="Rời nhóm">
                <Button
                  type="text"
                  aria-label="Rời phòng"
                  onClick={leaveRoom}
                  icon={<MoreOutlined />}
                />
              </Tooltip>
            )}
          </Space>
        </div>
        {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
        {reactions.error && <Alert type="error" message={reactions.error} />}
        <IncomingCalls rooms={rooms} userId={user.id} />
        {renderContent()}
      </main>
      {active?.joined && (
        <MessageSearchPanel
          key={roomId}
          room={active}
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
        />
      )}
      <Modal
        open={createOpen}
        title="Tạo nhóm học tập"
        okText="Tạo phòng"
        cancelText="Hủy"
        confirmLoading={busy}
        onCancel={() => setCreateOpen(false)}
        onOk={() =>
          act(async () => {
            if (!name.trim()) {
              throw new Error('Hãy nhập tên phòng');
            }
            const room = await request<Room>('createRoom', { name, privateRoom });
            await loadRooms();
            selectRoom(room.id);
            setCreateOpen(false);
            setName('');
          })
        }
      >
        <p className="muted">
          Một nơi để cùng trò chuyện, gọi video, chia sẻ tài liệu và tham gia Battle.
        </p>
        <label className="field-label" htmlFor="new-room-name">
          Tên nhóm
        </label>
        <Input
          id="new-room-name"
          placeholder="Ví dụ: Góc học tiếng Nhật"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
        />
        <Checkbox
          checked={privateRoom}
          onChange={(event) => setPrivateRoom(event.target.checked)}
          style={{ marginTop: 20 }}
        >
          Nhóm riêng tư · chỉ người được mời có thể vào
        </Checkbox>
      </Modal>
      <Modal
        open={inviteOpen}
        title="Mời thành viên"
        okText="Gửi lời mời"
        cancelText="Hủy"
        okButtonProps={{ disabled: !inviteId }}
        confirmLoading={busy}
        onCancel={() => setInviteOpen(false)}
        onOk={() =>
          act(async () => {
            await request('inviteMember', { id: roomId, userId: inviteId });
            await loadRoom(roomId);
            setInviteOpen(false);
            setInviteId('');
          })
        }
      >
        <p className="muted">
          Chọn một người bạn để gửi lời mời. Họ chỉ vào nhóm sau khi chấp nhận.
        </p>
        {!manualInvite && (
          <Select
            aria-label="Chọn bạn bè để mời"
            style={{ width: '100%' }}
            placeholder="Chọn bạn bè…"
            showSearch
            optionFilterProp="label"
            value={inviteId || undefined}
            onChange={setInviteId}
            options={availableFriends.map((friend) => ({
              value: friend.id,
              label: friend.displayName,
            }))}
            notFoundContent="Không có bạn bè để mời"
          />
        )}
        <Checkbox
          checked={manualInvite}
          onChange={(event) => {
            setManualInvite(event.target.checked);
            setInviteId('');
          }}
          style={{ margin: '16px 0' }}
        >
          Mời bằng ID tài khoản
        </Checkbox>
        {manualInvite && (
          <Input
            aria-label="ID người được mời"
            value={inviteId}
            onChange={(event) => setInviteId(event.target.value)}
            placeholder="ID tài khoản"
          />
        )}
        <small>
          ID của bạn: <span style={{ userSelect: 'all' }}>{user.id}</span>
        </small>
      </Modal>
    </div>
  );
}
