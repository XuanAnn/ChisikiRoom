import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Drawer, Empty, Space } from 'antd';
import { request, errorMessage } from '../../lib/api';
type Invitation = { roomId: string; roomName: string; inviterName: string; createdAt: string };
export function GroupInvitationsPanel({
  onJoined,
}: {
  onJoined: (roomId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    async function refresh() {
      try {
        const next = await request<Invitation[]>('groupInvitations');
        if (mounted) {
          setInvitations(next);
        }
      } catch (exception) {
        if (mounted) {
          setError(errorMessage(exception));
        }
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    const unsubscribe = window.chisiki?.onEvent((event) => {
      if (['GROUP_INVITED', 'GROUP_INVITATION_CHANGED', 'ROOM_CHANGED'].includes(event.type)) {
        void refresh();
      }
    });
    return () => {
      mounted = false;
      window.clearInterval(timer);
      unsubscribe?.();
    };
  }, []);
  async function respond(invitation: Invitation, accept: boolean) {
    setBusy(invitation.roomId);
    setError('');
    try {
      await request('respondGroupInvitation', { id: invitation.roomId, accept });
      setInvitations((current) => current.filter((item) => item.roomId !== invitation.roomId));
      if (accept) {
        await onJoined(invitation.roomId);
        setOpen(false);
      }
    } catch (exception) {
      setError(errorMessage(exception));
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <Badge count={invitations.length} size="small">
        <Button type="text" aria-label="Lời mời nhóm" onClick={() => setOpen(true)}>
          Lời mời nhóm
        </Button>
      </Badge>
      <Drawer title="Lời mời tham gia nhóm" open={open} onClose={() => setOpen(false)} width={460}>
        {error && <Alert type="error" message={error} />}
        <p className="muted">Bạn chỉ trở thành thành viên sau khi chấp nhận lời mời.</p>
        {invitations.map((invitation) => (
          <section key={invitation.roomId} className="group-invitation">
            <h3>{invitation.roomName}</h3>
            <p>
              {invitation.inviterName} mời bạn tham gia ·{' '}
              {new Date(invitation.createdAt).toLocaleString('vi-VN')}
            </p>
            <Space>
              <Button disabled={busy !== null} onClick={() => void respond(invitation, false)}>
                Từ chối
              </Button>
              <Button
                type="primary"
                loading={busy === invitation.roomId}
                disabled={busy !== null && busy !== invitation.roomId}
                onClick={() => void respond(invitation, true)}
              >
                Chấp nhận
              </Button>
            </Space>
          </section>
        ))}
        {!invitations.length && <Empty description="Không có lời mời nhóm đang chờ" />}
      </Drawer>
    </>
  );
}
