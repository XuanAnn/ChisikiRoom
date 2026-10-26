import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Space } from 'antd';
import { UserOutlined, UploadOutlined } from '@ant-design/icons';
import { request, errorMessage, type User } from '../../lib/api';
import { UserAvatar } from '../../components/UserAvatar';
export function ProfilePanel({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.displayName);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(user.displayName), [user.displayName]);
  async function save() {
    setBusy(true);
    setError('');
    try {
      await request('saveProfile', { displayName: name });
      setOpen(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function avatar() {
    setBusy(true);
    setError('');
    try {
      const result = await window.chisiki?.uploadAvatar();
      if (result?.error) {
        throw new Error(result.error);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button type="text" icon={<UserOutlined />} onClick={() => setOpen(true)}>
        Hồ sơ
      </Button>
      <Modal
        open={open}
        title="Hồ sơ của bạn"
        okText="Lưu hồ sơ"
        cancelText="Hủy"
        confirmLoading={busy}
        onOk={save}
        onCancel={() => setOpen(false)}
      >
        <Space style={{ margin: '10px 0 25px' }}>
          <UserAvatar id={user.id} name={user.displayName} />
          <Button icon={<UploadOutlined />} loading={busy} onClick={avatar}>
            Đổi avatar
          </Button>
        </Space>
        <p className="muted">PNG/JPEG · tối đa 2 MB và 2048×2048 pixel.</p>
        <label className="section-label">TÊN HIỂN THỊ</label>
        <Input
          aria-label="Tên hiển thị"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        <p className="muted">{user.email}</p>
        <small>
          ID: <span style={{ userSelect: 'all' }}>{user.id}</span>
        </small>
        {error && <Alert type="error" message={error} />}
      </Modal>
    </>
  );
}
