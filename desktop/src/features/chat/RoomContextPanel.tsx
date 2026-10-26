import { Button, Tabs } from 'antd';
import { CloseOutlined, LockOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons';
import { type Room, type Member, type Quiz } from '../../lib/api';
import { UserAvatar } from '../../components/UserAvatar';
import { DocumentsPanel } from './DocumentsPanel';
import { GroupManagementPanel } from '../community/GroupManagementPanel';
import { BattleCards } from '../battle/BattleCards';

type Props = {
  room: Room;
  members: Member[];
  quizzes: Quiz[];
  userId: string;
  tab: string;
  onTabChange: (tab: string) => void;
  onInvite: () => void;
  onClose: () => void;
};
export function RoomContextPanel(props: Props) {
  const isDirect = props.room.kind === 'DIRECT';
  return (
    <section className="room-context" aria-label="Thông tin và công cụ phòng">
      <div className="context-title">
        <span>KHÔNG GIAN CHUNG</span>
        <Button
          type="text"
          icon={<CloseOutlined />}
          aria-label="Đóng thông tin phòng"
          onClick={props.onClose}
        />
      </div>
      <div className="context-room-avatar">
        {isDirect ? (
          <UserAvatar id={props.room.peerId || ''} name={props.room.name} />
        ) : (
          <span>#</span>
        )}
      </div>
      <h2>{props.room.name}</h2>
      <p className="context-room-kind">
        <LockOutlined />{' '}
        {isDirect
          ? 'Cuộc trò chuyện riêng'
          : props.room.privateRoom
            ? 'Nhóm riêng tư'
            : 'Nhóm công khai'}
      </p>
      {!isDirect && (props.room.ownerId === props.userId || props.room.myRole === 'ADMIN') && (
        <Button className="context-invite" icon={<UserAddOutlined />} onClick={props.onInvite}>
          Mời thành viên
        </Button>
      )}
      <GroupManagementPanel room={props.room} userId={props.userId} />
      <Tabs
        activeKey={props.tab}
        onChange={props.onTabChange}
        className="context-tabs"
        items={[
          {
            key: 'members',
            label: `Thành viên · ${props.members.length}`,
            children: (
              <div className="context-members">
                {props.members.map((member) => (
                  <div className="member" key={member.id}>
                    <UserAvatar id={member.id} name={member.displayName} />
                    <div>
                      {member.displayName}
                      {member.id === props.room.ownerId && !isDirect && <small>Chủ phòng</small>}
                      {member.role === 'ADMIN' && member.id !== props.room.ownerId && (
                        <small>Quản trị viên</small>
                      )}
                      {member.id === props.userId && <small>Bạn</small>}
                    </div>
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: 'files',
            label: 'Tài liệu',
            children: <DocumentsPanel roomId={props.room.id} inline />,
          },
        ]}
      />
      <div className="context-learning">
        <div className="section-label">
          <TeamOutlined /> HỌC CÙNG NHAU
        </div>
        <BattleCards roomId={props.room.id} quizzes={props.quizzes} />
      </div>
    </section>
  );
}
