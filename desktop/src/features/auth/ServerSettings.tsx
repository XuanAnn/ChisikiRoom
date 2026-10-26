import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
export function ServerSettings() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    window.chisiki?.serverSettings().then((result) => {
      if (result.data) {
        setUrl(result.data);
      }
    });
  }, []);
  async function save() {
    const result = await window.chisiki?.serverSettings(url);
    if (result?.error) {
      setError(result.error);
    } else {
      setUrl(result?.data || url);
      setError('');
      setOpen(false);
    }
  }
  return (
    <>
      <Button type="text" icon={<SettingOutlined />} onClick={() => setOpen(true)}>
        Máy chủ
      </Button>
      <Modal
        open={open}
        title="Kết nối máy chủ"
        okText="Lưu địa chỉ"
        cancelText="Hủy"
        onOk={save}
        onCancel={() => setOpen(false)}
      >
        <p className="muted">
          Cùng máy: http://localhost:8080
          <br />
          Máy khác trong LAN: nhập IP nội bộ của máy chạy backend, ví dụ http://192.168.1.10:8080.
        </p>
        <Input
          aria-label="Địa chỉ máy chủ"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://192.168.1.10:8080"
        />
        {error && <Alert type="error" message={error} />}
        <small>
          Địa chỉ được lưu trên máy này. Máy chủ LAN cần mở cổng backend trong tường lửa.
        </small>
      </Modal>
    </>
  );
}
