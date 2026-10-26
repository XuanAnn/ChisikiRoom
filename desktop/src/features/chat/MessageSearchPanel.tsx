import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Drawer, Empty, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { request, errorMessage, type ChatMessage, type Room } from '../../lib/api';
import { UserAvatar } from '../../components/UserAvatar';

export function MessageSearchPanel({
  room,
  open,
  onClose,
}: {
  room: Room;
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [more, setMore] = useState(false);
  const generation = useRef(0);
  const submitted = useRef('');
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  async function search(append = false) {
    const phrase = append ? submitted.current : query.trim();
    if (phrase.length < 2) {
      setError('Nhập ít nhất 2 ký tự.');
      return;
    }
    const requestGeneration = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const page = await request<ChatMessage[]>('searchMessages', {
        id: room.id,
        q: phrase,
        before: append ? results.at(-1)?.id : undefined,
      });
      if (requestGeneration !== generation.current) {
        return;
      }
      submitted.current = phrase;
      setResults((previous) => (append ? [...previous, ...page] : page));
      setMore(page.length === 50);
      setSearched(true);
    } catch (failure) {
      if (requestGeneration === generation.current) {
        setError(errorMessage(failure));
      }
    } finally {
      if (requestGeneration === generation.current) {
        setBusy(false);
      }
    }
  }

  return (
    <Drawer title="Tìm tin nhắn" open={open} onClose={onClose} width={420}>
      <p className="muted">Tìm trong toàn bộ lịch sử · {room.name}</p>
      <Input.Search
        autoFocus
        placeholder="Nhập nội dung cần tìm…"
        value={query}
        maxLength={100}
        onChange={(event) => setQuery(event.target.value)}
        onSearch={() => search()}
        loading={busy}
        enterButton={<SearchOutlined />}
      />
      {error && <Alert type="error" message={error} style={{ marginTop: 16 }} />}
      <div className="search-results">
        {results.map((message) => (
          <article className="search-result" key={message.id}>
            <UserAvatar id={message.senderId} name={message.displayName} />
            <div>
              <b>{message.displayName}</b>
              <time>{new Date(message.createdAt).toLocaleString('vi-VN')}</time>
              <p>{message.content}</p>
            </div>
          </article>
        ))}
        {searched && !results.length && !busy && (
          <Empty description="Không tìm thấy tin nhắn phù hợp" />
        )}
        {!searched && (
          <div className="search-hint">
            <SearchOutlined />
            <p>Tìm lại kiến thức, ghi chú hoặc cuộc trò chuyện trước đó.</p>
          </div>
        )}
        {more && (
          <Button block loading={busy} onClick={() => search(true)}>
            Tìm kết quả cũ hơn
          </Button>
        )}
      </div>
    </Drawer>
  );
}
