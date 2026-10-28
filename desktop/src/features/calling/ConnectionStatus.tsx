import { useEffect, useState, type RefObject } from 'react';
import { Alert, Collapse, Space, Tag } from 'antd';
import { summarizeConnection, type ConnectionDetails } from '../../lib/connectionStats';

type ConnectionRow = ConnectionDetails & { state: RTCPeerConnectionState };
type Participant = { id: string; displayName: string };
type Props = {
  peers: RefObject<Map<string, { pc: RTCPeerConnection }>>;
  participants: Participant[];
  online: boolean;
  iceReady: boolean;
};

const stateLabels: Record<RTCPeerConnectionState, string> = {
  new: 'Đang chuẩn bị',
  connecting: 'Đang kết nối',
  connected: 'Đã kết nối',
  disconnected: 'Tạm gián đoạn',
  failed: 'Kết nối thất bại',
  closed: 'Đã đóng',
};

export function ConnectionStatus({ peers, participants, online, iceReady }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [connections, setConnections] = useState<Record<string, ConnectionRow>>({});

  useEffect(() => {
    if (!expanded) {
      return;
    }
    let disposed = false;
    let pending = false;

    async function refresh() {
      if (pending) {
        return;
      }
      pending = true;
      const next: Record<string, ConnectionRow> = {};
      try {
        await Promise.all(
          Array.from(peers.current.entries()).map(async ([id, peer]) => {
            let details: ConnectionDetails = { route: 'unknown' };
            try {
              details = summarizeConnection(await peer.pc.getStats());
            } catch {
              // A peer may close between enumeration and reading its statistics.
            }
            if (peers.current.get(id) === peer) {
              next[id] = { ...details, state: peer.pc.connectionState };
            }
          }),
        );
        if (!disposed) {
          setConnections(next);
        }
      } finally {
        pending = false;
      }
    }

    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [expanded, peers]);

  return (
    <Collapse
      onChange={(keys) => setExpanded(keys.length > 0)}
      items={[
        {
          key: 'connection',
          label: 'Tình trạng kết nối',
          children: (
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Tag color={online ? 'green' : 'orange'}>
                  {online ? 'Đã kết nối máy chủ' : 'Đang kết nối lại máy chủ'}
                </Tag>
                <Tag>{iceReady ? 'Cấu hình gọi đã tải' : 'Chưa tải xong cấu hình gọi'}</Tag>
              </div>
              {participants.map((participant) => {
                const connection = connections[participant.id];
                let routeLabel = 'Chưa xác định đường truyền';
                if (connection?.route === 'relay') {
                  routeLabel = 'Qua máy chủ TURN';
                } else if (connection?.route === 'direct') {
                  routeLabel = 'Kết nối trực tiếp';
                }
                return (
                  <div key={participant.id}>
                    <strong>{participant.displayName}</strong>
                    <div>{connection ? stateLabels[connection.state] : 'Đang chờ kết nối'}</div>
                    <Space wrap>
                      <Tag>{routeLabel}</Tag>
                      {connection?.protocol && <Tag>{connection.protocol.toUpperCase()}</Tag>}
                      {connection?.relayProtocol && (
                        <Tag>Đến TURN: {connection.relayProtocol.toUpperCase()}</Tag>
                      )}
                      {connection?.roundTripMs !== undefined && (
                        <Tag>Độ trễ khứ hồi: {connection.roundTripMs} ms</Tag>
                      )}
                    </Space>
                  </div>
                );
              })}
              {!participants.length && <span>Chưa có người khác tham gia.</span>}
              <Alert
                type="info"
                message="Chat được nhưng cuộc gọi chưa kết nối: kiểm tra quyền camera/mic và cấu hình TURN khi hai người dùng khác mạng."
              />
            </Space>
          ),
        },
      ]}
    />
  );
}
