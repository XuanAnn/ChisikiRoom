import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Drawer, Input, Modal, Space, Tabs, Tag } from 'antd';
import { request, errorMessage, type Room, type Member } from '../../lib/api';
type Ban = { userId: string; displayName: string; blockedBy: string; createdAt: string };
export function GroupManagementPanel({ room, userId }: { room: Room; userId: string }) {
  const [open, setOpen] = useState(false);
  const [modal, modalHolder] = Modal.useModal();
  const [members, setMembers] = useState<Member[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [name, setName] = useState(room.name);
  const [privateRoom, setPrivateRoom] = useState(room.privateRoom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owner = room.ownerId === userId;
  const manager = owner || room.myRole === 'ADMIN';
  useEffect(() => {
    if (open) {
      setName(room.name);
      setPrivateRoom(room.privateRoom);
    }
  }, [open, room.name, room.privateRoom]);
  useEffect(() => {
    if (!open || !manager) {
      return;
    }
    let current = true;
    async function refresh() {
      try {
        const [nextMembers, nextBans] = await Promise.all([
          request<Member[]>('members', { id: room.id }),
          request<Ban[]>('groupBans', { id: room.id }),
        ]);
        if (current) {
          setMembers(nextMembers);
          setBans(nextBans);
        }
      } catch (exception) {
        if (current) {
          setError(errorMessage(exception));
        }
      }
    }
    void refresh();
    const unsubscribe = window.chisiki?.onEvent((event) => {
      if (event.type === 'ROOM_CHANGED' && event.data.roomId === room.id) {
        void refresh();
      }
    });
    return () => {
      current = false;
      unsubscribe?.();
    };
  }, [open, manager, room.id]);
  async function act(action: string, body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      await request(action, { id: room.id, ...body });
      setMembers(await request<Member[]>('members', { id: room.id }));
      if (action !== 'transferGroup') {
        setBans(await request<Ban[]>('groupBans', { id: room.id }));
      }
    } catch (exception) {
      setError(errorMessage(exception));
    } finally {
      setBusy(false);
    }
  }
  function confirm(action: string, member: Member, block = false) {
    let title = `Loại ${member.displayName} khỏi nhóm?`;
    let content = 'Người này sẽ mất quyền truy cập chat, tài liệu và cuộc gọi của nhóm.';
    if (block) {
      title = `Chặn ${member.displayName} khỏi nhóm?`;
      content += ' Họ không thể tham gia lại cho đến khi được bỏ chặn.';
    }
    if (action === 'transferGroup') {
      title = `Chuyển quyền chủ nhóm cho ${member.displayName}?`;
      content =
        'Bạn sẽ trở thành quản trị viên. Chỉ chủ nhóm mới có quyền cấp/thu hồi quản trị hoặc chuyển quyền sở hữu.';
    }
    modal.confirm({
      title,
      content,
      okText: 'Xác nhận',
      cancelText: 'Hủy',
      okButtonProps: { danger: action !== 'transferGroup' },
      onOk: () => {
        if (action === 'transferGroup') {
          return act(action, { userId: member.id });
        }
        return act(action, { userId: member.id, block });
      },
    });
  }
  if (!manager || room.kind === 'DIRECT') {
    return null;
  }
  return (
    <>
      {modalHolder}
      <Button onClick={() => setOpen(true)}>Quản lý nhóm</Button>
      <Drawer title="Quản lý nhóm" width={620} open={open} onClose={() => setOpen(false)}>
        {error && <Alert type="error" message={error} />}
        <Tabs
          items={[
            {
              key: 'info',
              label: 'Thông tin',
              children: (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <label>Tên nhóm</label>
                  <Input
                    aria-label="Tên nhóm mới"
                    value={name}
                    maxLength={80}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <Checkbox
                    checked={privateRoom}
                    disabled={!owner}
                    onChange={(event) => setPrivateRoom(event.target.checked)}
                  >
                    Nhóm riêng tư
                  </Checkbox>
                  <Button
                    type="primary"
                    loading={busy}
                    disabled={!name.trim()}
                    onClick={() => void act('updateGroup', { name, privateRoom })}
                  >
                    Lưu thông tin nhóm
                  </Button>
                  <p>
                    Chủ nhóm quyết định chế độ công khai/riêng tư. Lời mời vẫn cần người nhận chấp
                    nhận.
                  </p>
                </Space>
              ),
            },
            {
              key: 'members',
              label: `Thành viên (${members.length})`,
              children: members.map((member) => {
                const targetOwner = member.id === room.ownerId;
                const roleLabels: Record<string, string> = {
                  OWNER: 'Chủ nhóm',
                  ADMIN: 'Quản trị viên',
                  MEMBER: 'Thành viên',
                };
                const roleLabel = roleLabels[targetOwner ? 'OWNER' : member.role || 'MEMBER'];
                const canRemove =
                  member.id !== userId && !targetOwner && (owner || member.role !== 'ADMIN');
                return (
                  <section className="group-manager-member" key={member.id}>
                    <h3>{member.displayName}</h3>
                    <Tag>{roleLabel}</Tag>
                    <Space wrap>
                      {owner && !targetOwner && (
                        <>
                          <Button
                            disabled={busy}
                            onClick={() =>
                              void act('setGroupRole', {
                                userId: member.id,
                                role: member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
                              })
                            }
                          >
                            {member.role === 'ADMIN' ? 'Thu hồi quản trị' : 'Cấp quản trị'}
                          </Button>
                          <Button disabled={busy} onClick={() => confirm('transferGroup', member)}>
                            Chuyển chủ nhóm
                          </Button>
                        </>
                      )}
                      {canRemove && (
                        <>
                          <Button
                            danger
                            disabled={busy}
                            onClick={() => confirm('removeGroupMember', member)}
                          >
                            Loại khỏi nhóm
                          </Button>
                          <Button
                            danger
                            disabled={busy}
                            onClick={() => confirm('removeGroupMember', member, true)}
                          >
                            Chặn khỏi nhóm
                          </Button>
                        </>
                      )}
                    </Space>
                  </section>
                );
              }),
            },
            {
              key: 'bans',
              label: `Bị chặn (${bans.length})`,
              children: (
                <>
                  {bans.map((ban) => (
                    <section key={ban.userId} className="group-manager-member">
                      <h3>{ban.displayName}</h3>
                      <p>
                        Chặn bởi {ban.blockedBy} · {new Date(ban.createdAt).toLocaleString('vi-VN')}
                      </p>
                      {owner && (
                        <Button
                          disabled={busy}
                          onClick={() => void act('unblockGroupMember', { userId: ban.userId })}
                        >
                          Bỏ chặn
                        </Button>
                      )}
                    </section>
                  ))}
                  {!owner && <p>Chỉ chủ nhóm được bỏ chặn.</p>}
                </>
              ),
            },
          ]}
        />
      </Drawer>
    </>
  );
}
