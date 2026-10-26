import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Input, Modal, Tooltip } from 'antd';
import {
  DownloadOutlined,
  FileOutlined,
  PaperClipOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { request, errorMessage } from '../../lib/api';
import { matchesSearch } from '../../lib/search';
type Document = { id: string; filename: string; sizeBytes: number; createdAt: string };
export function DocumentsPanel({ roomId, inline = false }: { roomId: string; inline?: boolean }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<Document[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(
    async () => setFiles(await request<Document[]>('documents', { roomId })),
    [roomId],
  );
  useEffect(() => {
    load().catch((e) => setError(errorMessage(e)));
    return window.chisiki?.onEvent((e) => {
      if (e.type === 'DOCUMENT_CREATED' && e.data.roomId === roomId) {
        load().catch(() => {});
      }
    });
  }, [load, roomId]);
  async function upload() {
    setBusy(true);
    setError('');
    try {
      const r = await window.chisiki?.uploadDocument(roomId);
      if (r?.error) {
        throw new Error(r.error);
      }
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function download(file: Document) {
    setError('');
    const result = await window.chisiki?.downloadDocument(file.id, file.filename);
    if (result?.error) {
      setError(result.error);
    }
  }
  if (inline) {
    const visibleFiles = files.filter((file) => matchesSearch(file.filename, query));
    return (
      <div className="inline-documents">
        <Input
          placeholder="Tìm tài liệu…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          allowClear
        />
        <Button block icon={<UploadOutlined />} loading={busy} onClick={upload}>
          Tải file lên
        </Button>
        {error && <Alert type="error" message={error} />}
        <div className="document-list">
          {visibleFiles.map((file) => (
            <div className="document-row" key={file.id}>
              <FileOutlined />
              <span>
                {file.filename}
                <small>{(file.sizeBytes / 1024).toFixed(1)} KB</small>
              </span>
              <Tooltip title="Tải xuống">
                <Button
                  type="text"
                  aria-label={`Tải ${file.filename}`}
                  icon={<DownloadOutlined />}
                  onClick={() => download(file)}
                />
              </Tooltip>
            </div>
          ))}
          {!visibleFiles.length && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={query ? 'Không tìm thấy tài liệu' : 'Chưa có tài liệu'}
            />
          )}
        </div>
        <p className="muted">PDF, Word, PowerPoint, TXT và ảnh · Tối đa 20 MB/file.</p>
      </div>
    );
  }
  return (
    <>
      <div className="documents-bar">
        <Button type="text" icon={<PaperClipOutlined />} onClick={() => setOpen(true)}>
          Tài liệu · {files.length}
        </Button>
        <Tooltip title="Chia sẻ tài liệu trong phòng">
          <Button type="text" icon={<UploadOutlined />} loading={busy} onClick={upload}>
            Tải file lên
          </Button>
        </Tooltip>
      </div>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title="Tài liệu trong phòng"
        footer={
          <Button icon={<UploadOutlined />} loading={busy} onClick={upload}>
            Tải file lên
          </Button>
        }
      >
        <p className="muted">
          PDF, DOCX, PPTX, TXT, PNG, JPEG · tối đa 20 MB/file.
          <br />
          Chỉ thành viên của phòng được tải tài liệu.
        </p>
        {error && <Alert type="error" message={error} />}
        <div className="document-list">
          {files.map((f) => (
            <div key={f.id} className="document-row">
              <FileOutlined />
              <span>
                {f.filename}
                <small>{(f.sizeBytes / 1024).toFixed(1)} KB</small>
              </span>
              <Button type="text" icon={<DownloadOutlined />} onClick={() => download(f)} />
            </div>
          ))}
        </div>
      </Modal>
      {!open && error && (
        <Alert type="error" message={error} closable onClose={() => setError('')} />
      )}
    </>
  );
}
