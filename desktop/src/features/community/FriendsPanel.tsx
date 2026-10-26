import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Space, Tag } from 'antd';
import { TeamOutlined, UserAddOutlined } from '@ant-design/icons';
import { request, errorMessage, type User, type Member } from '../../lib/api';
type Invite = { senderId: string; senderName: string; recipientId: string; recipientName: string };
export function FriendsPanel({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invite[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const [f, i] = await Promise.all([
      request<Member[]>('friends'),
      request<Invite[]>('friendRequests'),
    ]);
    setFriends(f);
    setInvitations(i);
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(errorMessage(e)));
    return window.chisiki?.onEvent((e) => {
      if (e.type === 'FRIENDS_CHANGED' || e.type === 'CONNECTION') {
        refresh().catch(() => {});
      }
    });
  }, [refresh]);
  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = setInterval(() => {
      refresh().catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [open, refresh]);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button type="text" icon={<TeamOutlined />} onClick={() => setOpen(true)}>
        Bạn bè{' '}
        {invitations.filter((i) => i.recipientId === user.id).length > 0 && (
          <Tag color="purple">Mới</Tag>
        )}
      </Button>
      <Modal
        open={open}
        title="Kết nối bạn bè"
        onCancel={() => setOpen(false)}
        footer={null}
        width={620}
      >
        {error && <Alert type="error" message={error} />}
        <Input.Search
          placeholder="Tìm theo tên hiển thị (ít nhất 2 ký tự)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          loading={busy}
          onSearch={() =>
            act(async () => setResults(await request<Member[]>('searchUsers', { q: query })))
          }
        />
        <div className="friends-search">
          {results
            .filter((p) => p.id !== user.id)
            .map((p) => (
              <div className="document-row" key={p.id}>
                <div className="avatar">{p.displayName[0]}</div>
                <span>{p.displayName}</span>
                {friends.some((f) => f.id === p.id) ? (
                  <Tag color="green">Bạn bè</Tag>
                ) : invitations.some((i) => i.senderId === user.id && i.recipientId === p.id) ? (
                  <Tag>Đã gửi lời mời</Tag>
                ) : (
                  <Button
                    icon={<UserAddOutlined />}
                    loading={busy}
                    onClick={() =>
                      act(async () => {
                        await request('inviteFriend', { userId: p.id });
                      })
                    }
                  >
                    Kết bạn
                  </Button>
                )}
              </div>
            ))}
        </div>
        <div className="section-label">LỜI MỜI ĐẾN</div>
        {invitations
          .filter((i) => i.recipientId === user.id)
          .map((i) => (
            <div className="document-row" key={i.senderId}>
              <span>{i.senderName}</span>
              <Space>
                <Button
                  type="primary"
                  onClick={() =>
                    act(async () => {
                      await request('respondFriend', { senderId: i.senderId, accept: true });
                    })
                  }
                >
                  Chấp nhận
                </Button>
                <Button
                  onClick={() =>
                    act(async () => {
                      await request('respondFriend', { senderId: i.senderId, accept: false });
                    })
                  }
                >
                  Từ chối
                </Button>
              </Space>
            </div>
          ))}
        <div className="section-label">BẠN BÈ · {friends.length}</div>
        {friends.map((f) => (
          <div className="document-row" key={f.id}>
            <div className="avatar">{f.displayName[0]}</div>
            <span>
              {f.displayName}
              <small className={f.online ? 'online' : ''}>
                {f.online ? '● Đang hoạt động' : '○ Ngoại tuyến'}
              </small>
              <small style={{ userSelect: 'all' }}>ID: {f.id}</small>
            </span>
          </div>
        ))}
        {!friends.length && <Empty description="Tìm và kết nối với bạn học đầu tiên" />}
        <small>
          ID tài khoản của bạn: <span style={{ userSelect: 'all' }}>{user.id}</span>
        </small>
      </Modal>
    </>
  );
}
