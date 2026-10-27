import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Space } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
export function ServerSettings() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  useEffect(() => {
    window.chisiki?.serverSettings().then((result) => {
      if (result.data) {
        setUrl(result.data);
      }
    });
  }, []);
  function changeUrl(value: string) {
    setUrl(value);
    setError('');
    setConnectionMessage('');
  }

  async function checkConnection() {
    setChecking(true);
    setError('');
    setConnectionMessage('');

    try {
      const result = await window.chisiki?.checkServer(url);

      if (result?.data) {
        setConnectionMessage(
          `Backend đang hoạt động (${result.data.latencyMs} ms). Kiểm tra này chưa xác nhận chat hoặc gọi video.`,
        );
      } else {
        setError(result?.error || 'Hãy mở ứng dụng Electron để kiểm tra kết nối.');
      }
    } catch {
      setError('Không kiểm tra được kết nối. Hãy thử lại.');
    } finally {
      setChecking(false);
    }
  }

  async function save() {
    setSaving(true);

    try {
      const result = await window.chisiki?.serverSettings(url);

      if (result?.data) {
        setUrl(result.data);
        setError('');
        setConnectionMessage('');
        setOpen(false);
      } else {
        setError(result?.error || 'Không lưu được địa chỉ máy chủ.');
      }
    } catch {
      setError('Không lưu được địa chỉ máy chủ. Hãy thử lại.');
    } finally {
      setSaving(false);
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
        confirmLoading={saving}
        okButtonProps={{ disabled: checking }}
        cancelButtonProps={{ disabled: checking || saving }}
        closable={!checking && !saving}
        maskClosable={!checking && !saving}
        keyboard={!checking && !saving}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <p className="muted">
            Chọn máy chủ chạy backend. Những người muốn trò chuyện với nhau cần kết nối cùng máy
            chủ.
          </p>
          <Space wrap>
            <Button
              disabled={checking || saving}
              onClick={() => changeUrl('http://localhost:8080')}
            >
              Máy này
            </Button>
            <Button
              disabled={checking || saving}
              onClick={() => changeUrl('https://api.nguyenxuanan.id.vn')}
            >
              Máy chủ Internet
            </Button>
          </Space>
          <Input
            aria-label="Địa chỉ máy chủ"
            value={url}
            disabled={checking || saving}
            onChange={(event) => changeUrl(event.target.value)}
            placeholder="https://tên-miền hoặc http://192.168.1.10:8080"
          />
          <Button loading={checking} disabled={saving || !url.trim()} onClick={checkConnection}>
            Kiểm tra kết nối
          </Button>
          {error && <Alert role="alert" type="error" message={error} />}
          {connectionMessage && <Alert role="status" type="success" message={connectionMessage} />}
          <small>
            LAN: nhập IP máy chạy backend và cổng, ví dụ http://192.168.1.10:8080. Internet: dùng
            địa chỉ HTTPS. Địa chỉ được lưu riêng trên máy này; kiểm tra kết nối không thay đổi máy
            chủ đang lưu.
          </small>
        </Space>
      </Modal>
    </>
  );
}
