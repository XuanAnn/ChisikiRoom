'use strict';
let adminKey = '';
let snapshot = null;
let timer = null;
let generation = 0;
const element = (id) => document.getElementById(id);
function node(tag, text, className) {
  const value = document.createElement(tag);
  value.textContent = text ?? '';
  if (className) {
    value.className = className;
  }
  return value;
}
function name(id) {
  if (!id) {
    return 'Server';
  }
  return snapshot.users.find((user) => user.id === id)?.displayName || id;
}
function address(id) {
  return snapshot.addresses[id]?.ip || 'Chưa ghi nhận';
}
function date(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa ghi nhận';
}
function row(values) {
  const result = document.createElement('tr');
  values.forEach((value) => result.append(node('td', value)));
  return result;
}
async function api(path, method = 'GET') {
  const response = await fetch(path, {
    method,
    headers: { 'X-Admin-Key': adminKey },
    cache: 'no-store',
    credentials: 'omit',
  });
  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? 'Khóa không hợp lệ hoặc quản trị chưa được bật.'
        : `Server trả lỗi ${response.status}`,
    );
  }
  if (method === 'GET') {
    return response.json();
  }
}
function renderUsers() {
  const query = element('search').value.trim().toLowerCase();
  const target = element('userRows');
  target.replaceChildren();
  snapshot.users
    .filter((user) =>
      `${user.displayName} ${user.email} ${address(user.id)}`.toLowerCase().includes(query),
    )
    .forEach((user) => {
      const item = row([
        user.displayName,
        user.email,
        address(user.id),
        date(snapshot.addresses[user.id]?.lastSeen),
      ]);
      const cell = document.createElement('td');
      const button = node('button', 'Thu hồi phiên', 'secondary');
      button.onclick = async () => {
        if (!confirm(`Thu hồi tất cả phiên đăng nhập của ${user.displayName}?`)) {
          return;
        }
        button.disabled = true;
        try {
          await api(`/api/admin/users/${user.id}/revoke-sessions`, 'POST');
          element('status').textContent = `Đã thu hồi phiên của ${user.displayName}`;
        } catch (error) {
          element('status').textContent = error.message;
        } finally {
          button.disabled = false;
        }
      };
      cell.append(button);
      item.append(cell);
      target.append(item);
    });
  if (!target.children.length) {
    target.append(row(['Không có người dùng phù hợp.']));
  }
}
function activities(targetId, activities, participants) {
  const target = element(targetId);
  target.replaceChildren();
  activities.forEach((activity) => {
    const card = document.createElement('article');
    card.append(node('strong', `${activity.title} · ${activity.status}`));
    card.append(node('p', `ID: ${activity.id}`));
    const members = participants.filter((person) => person.activityId === activity.id);
    members.forEach((person) =>
      card.append(
        node(
          'p',
          `${name(person.userId)} · ${address(person.userId)} · ${person.status}${person.score == null ? '' : ` · ${person.score} điểm`}`,
        ),
      ),
    );
    if (!members.length) {
      card.append(node('p', 'Chưa có người tham gia.'));
    }
    target.append(card);
  });
  if (!activities.length) {
    target.append(node('p', 'Chưa có hoạt động.', 'muted'));
  }
}
function renderEvents() {
  const query = element('eventSearch').value.toLowerCase();
  const target = element('eventRows');
  target.replaceChildren();
  snapshot.transfers.forEach((event) => {
    const recipients = event.recipients
      .map((person) => `${name(person.userId)} · ${person.ip}`)
      .join('\n');
    const values = [
      date(event.time),
      `${name(event.senderId)} · ${event.senderIp}`,
      recipients,
      event.type,
      event.summary,
    ];
    if (values.join(' ').toLowerCase().includes(query)) {
      target.append(row(values));
    }
  });
  if (!target.children.length) {
    target.append(row(['Chưa có sự kiện phù hợp.']));
  }
}
function render() {
  element('stats').replaceChildren(
    ...[
      ['Người dùng', snapshot.users.length],
      ['Cuộc gọi', snapshot.calls.length],
      ['Thi đấu', snapshot.battles.length],
      ['Sự kiện đã ghi', snapshot.transfers.length],
    ].map(([title, count]) => node('div', `${title}: ${count}`, 'stat')),
  );
  renderUsers();
  activities('callCards', snapshot.calls, snapshot.callParticipants);
  activities('battleCards', snapshot.battles, snapshot.battleParticipants);
  renderEvents();
}
function disconnect() {
  generation += 1;
  adminKey = '';
  snapshot = null;
  clearTimeout(timer);
  ['stats', 'userRows', 'callCards', 'battleCards', 'eventRows'].forEach((id) =>
    element(id).replaceChildren(),
  );
  element('status').textContent = 'Đã ngắt kết nối';
}
async function refresh(current) {
  try {
    const data = await api('/api/admin/snapshot');
    if (current !== generation) {
      return;
    }
    snapshot = data;
    render();
    element('status').textContent = `Cập nhật ${new Date().toLocaleTimeString('vi-VN')}`;
  } catch (error) {
    if (current !== generation) {
      return;
    }
    element('status').textContent = error.message;
  }
  if (current === generation && adminKey) {
    timer = setTimeout(() => refresh(current), 3000);
  }
}
element('login').onsubmit = (event) => {
  event.preventDefault();
  disconnect();
  adminKey = element('key').value;
  element('key').value = '';
  refresh(generation);
};
element('logout').onclick = disconnect;
element('search').oninput = () => {
  if (snapshot) {
    renderUsers();
  }
};
element('eventSearch').oninput = () => {
  if (snapshot) {
    renderEvents();
  }
};
