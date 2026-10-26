import { Button, Empty } from 'antd';
import {
  ArrowRightOutlined,
  BookOutlined,
  CompassOutlined,
  MessageOutlined,
  PlusOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { type User, type Member, type Room, type Quiz } from '../../lib/api';
import { UserAvatar } from '../../components/UserAvatar';

type Props = {
  user: User;
  friends: Member[];
  rooms: Room[];
  quizzes: Quiz[];
  unread: Record<string, number>;
  onCreateGroup: () => void;
  onCreateQuiz: () => void;
  onShowQuizzes: () => void;
  onOpenFriend: (friend: Member) => void;
  onSelectRoom: (id: string) => void;
};
export function WorkspaceOverview(props: Props) {
  const groups = props.rooms.filter((room) => room.kind === 'GROUP' && room.joined);
  const discover = props.rooms.filter((room) => room.kind === 'GROUP' && !room.joined);
  const onlineFriends = props.friends.filter((friend) => friend.online);
  const questionCount = props.quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0);
  const unreadCount = Object.values(props.unread).reduce((sum, count) => sum + count, 0);
  return (
    <div className="workspace-overview">
      <section className="overview-hero">
        <div>
          <span className="hero-chip">
            <span className="live-dot" /> KHÔNG GIAN CỦA BẠN
          </span>
          <h1>
            Học điều mới.
            <br />
            <em>Kết nối mỗi ngày.</em>
          </h1>
          <p>
            Chào {props.user.displayName}! Một cuộc trò chuyện,
            <br />
            một thử thách — thêm một điều bạn biết.
          </p>
          <div className="hero-actions">
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={props.onCreateGroup}
            >
              Tạo nhóm học tập
            </Button>
            <Button size="large" icon={<BookOutlined />} onClick={props.onCreateQuiz}>
              Soạn quiz mới
            </Button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-art-center">知</div>
          <span className="floating-symbol float-book">
            <BookOutlined />
          </span>
          <span className="floating-symbol float-call">
            <VideoCameraOutlined />
          </span>
          <span className="floating-symbol float-bolt">
            <ThunderboltOutlined />
          </span>
        </div>
      </section>
      <div className="overview-stats">
        <div>
          <span className="stat-icon">
            <TeamOutlined />
          </span>
          <div>
            <strong>{props.friends.length}</strong>
            <span>Bạn bè · {onlineFriends.length} trực tuyến</span>
          </div>
        </div>
        <div>
          <span className="stat-icon green">
            <MessageOutlined />
          </span>
          <div>
            <strong>{groups.length}</strong>
            <span>Nhóm đang tham gia</span>
          </div>
        </div>
        <div>
          <span className="stat-icon amber">
            <BookOutlined />
          </span>
          <div>
            <strong>{questionCount}</strong>
            <span>Câu hỏi · {props.quizzes.length} bộ quiz</span>
          </div>
        </div>
        <div title="Tin mới nhận trong phiên mở ứng dụng hiện tại">
          <span className="stat-icon rose">
            <ThunderboltOutlined />
          </span>
          <div>
            <strong>{unreadCount}</strong>
            <span>Tin nhắn mới trong phiên</span>
          </div>
        </div>
      </div>
      <div className="overview-columns">
        <section className="overview-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">CÙNG NHAU TIẾN BỘ</span>
              <h2>Nhóm học tập của bạn</h2>
            </div>
            <Button
              type="text"
              aria-label="Tạo nhóm học tập mới"
              icon={<PlusOutlined />}
              onClick={props.onCreateGroup}
            />
          </div>
          {groups.length ? (
            groups.slice(0, 5).map((room) => (
              <button
                className="overview-room"
                key={room.id}
                onClick={() => props.onSelectRoom(room.id)}
              >
                <span className="room-card-icon">#</span>
                <div>
                  <b>{room.name}</b>
                  <small>
                    {room.memberCount} thành viên · {room.privateRoom ? 'Riêng tư' : 'Công khai'}
                  </small>
                </div>
                <ArrowRightOutlined />
              </button>
            ))
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Chưa có nhóm học tập. Tạo một nhóm để bắt đầu!"
            />
          )}
        </section>
        <section className="overview-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">MỖI NGÀY MỘT CHÚT</span>
              <h2>Tiếp tục khám phá</h2>
            </div>
            <BookOutlined />
          </div>
          <button className="learning-launch" onClick={props.onShowQuizzes}>
            <span className="learning-launch-icon">
              <BookOutlined />
            </span>
            <div>
              <h3>Thư viện kiến thức của bạn</h3>
              <p>
                {props.quizzes.length
                  ? `${props.quizzes.length} bộ câu hỏi đã sẵn sàng. Chỉnh sửa và dùng để tạo Battle trong nhóm.`
                  : 'Biến ghi chú thành câu hỏi. Tạo quiz đầu tiên và thử sức cùng bạn bè.'}
              </p>
              <span>
                Mở thư viện <ArrowRightOutlined />
              </span>
            </div>
          </button>
          <div className="battle-tip">
            <ThunderboltOutlined />
            <div>
              <b>Sẵn sàng cho một Battle?</b>
              <p>
                Mở một nhóm chat → chọn Tạo Battle.
                <br />
                Tối đa 4 người · 15 giây/câu · +10/−5 điểm.
              </p>
            </div>
          </div>
        </section>
      </div>
      <section className="overview-card">
        <div className="card-heading">
          <div>
            <span className="eyebrow">KẾT NỐI GẦN HƠN</span>
            <h2>Bạn bè của bạn</h2>
          </div>
          <span className="muted">Chat riêng hoặc gọi video</span>
        </div>
        <div className="overview-friends">
          {props.friends.slice(0, 8).map((friend) => (
            <button key={friend.id} onClick={() => props.onOpenFriend(friend)}>
              <UserAvatar id={friend.id} name={friend.displayName} />
              <b>{friend.displayName}</b>
              <small>
                <span className={friend.online ? 'live-dot' : 'live-dot offline'} />{' '}
                {friend.online ? 'Đang trực tuyến' : 'Nhắn tin riêng'}
              </small>
            </button>
          ))}
          {!props.friends.length && (
            <p className="muted">Chọn Bạn bè ở thanh trên để tìm và gửi lời mời kết bạn.</p>
          )}
        </div>
      </section>
      {!!discover.length && (
        <section className="overview-card">
          <div className="card-heading">
            <div>
              <span className="eyebrow">MỞ RỘNG VÒNG KẾT NỐI</span>
              <h2>
                <CompassOutlined /> Khám phá nhóm công khai
              </h2>
            </div>
          </div>
          <div className="discover-grid">
            {discover.map((room) => (
              <button key={room.id} onClick={() => props.onSelectRoom(room.id)}>
                <span className="room-card-icon">#</span>
                <h3>{room.name}</h3>
                <p>{room.memberCount} thành viên</p>
                <span>
                  Xem nhóm <ArrowRightOutlined />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
