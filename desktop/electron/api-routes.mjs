const uuid = (value) =>
  typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export function route(action, body) {
  const id = body?.id;
  const fixed = {
    register: ['POST', '/api/auth/register'],
    login: ['POST', '/api/auth/login'],
    me: ['GET', '/api/auth/me'],
    logout: ['POST', '/api/auth/logout'],
    rooms: ['GET', '/api/chat-rooms'],
    chatStates: ['GET', '/api/chat-rooms/state'],
    groupInvitations: ['GET', '/api/group-invitations'],
    createRoom: ['POST', '/api/chat-rooms'],
    quizzes: ['GET', '/api/question-sets'],
    createQuiz: ['POST', '/api/question-sets'],
    startPractice: ['POST', '/api/practice'],
    practiceHistory: ['GET', '/api/practice'],
    learningProgress: ['GET', '/api/learning-progress'],
    saveLearningGoal: ['PUT', '/api/learning-progress/goal'],
    rankedQueue: ['GET', '/api/ranking/queue'],
    joinRankedQueue: ['POST', '/api/ranking/queue'],
    rankedHeartbeat: ['POST', '/api/ranking/queue/heartbeat'],
    cancelRankedQueue: ['DELETE', '/api/ranking/queue'],
    rankedHistory: ['GET', '/api/ranking/history'],
  };
  fixed.createBattle = ['POST', '/api/battles'];
  fixed.openDirect = ['POST', '/api/chat-rooms/direct'];
  fixed.saveProfile = ['PUT', '/api/profile'];
  Object.assign(fixed, {
    friends: ['GET', '/api/friends'],
    friendRequests: ['GET', '/api/friend-requests'],
    inviteFriend: ['POST', '/api/friend-requests'],
    respondFriend: ['POST', '/api/friend-requests/respond'],
  });
  if (action === 'ranking') {
    const level = body?.level === 'N4' ? 'N4' : 'N5';
    return ['GET', `/api/ranking?level=${level}`];
  }
  if (action === 'searchUsers') {
    return ['GET', `/api/users?q=${encodeURIComponent(String(body?.q || '').slice(0, 60))}`];
  }
  if (action === 'documents' && uuid(body?.roomId)) {
    return ['GET', `/api/documents?roomId=${body.roomId}`];
  }
  if (action === 'battles' && uuid(body?.roomId)) {
    return ['GET', `/api/battles?roomId=${body.roomId}`];
  }
  if (Object.hasOwn(fixed, action)) {
    return fixed[action];
  }
  if (!uuid(id)) {
    throw new Error('ID không hợp lệ');
  }
  if (action === 'searchMessages') {
    const query = encodeURIComponent(String(body?.q || '').slice(0, 100));
    const before =
      body?.before && /^\d+$/.test(String(body.before)) ? `&before=${body.before}` : '';
    return ['GET', `/api/chat-rooms/${id}/messages/search?q=${query}${before}`];
  }
  const dynamic = {
    respondGroupInvitation: ['POST', `/api/group-invitations/${id}/respond`],
    joinRoom: ['POST', `/api/chat-rooms/${id}/join`],
    leaveRoom: ['POST', `/api/chat-rooms/${id}/leave`],
    inviteMember: ['POST', `/api/chat-rooms/${id}/invite`],
    members: ['GET', `/api/chat-rooms/${id}/members`],
    saveDraft: ['PUT', `/api/chat-rooms/${id}/state/draft`],
    markRead: ['PUT', `/api/chat-rooms/${id}/state/read`],
    pinnedMessages: ['GET', `/api/chat-rooms/${id}/pinned`],
    updateGroup: ['PUT', `/api/groups/${id}`],
    setGroupRole: ['PUT', `/api/groups/${id}/role`],
    transferGroup: ['POST', `/api/groups/${id}/transfer`],
    removeGroupMember: ['POST', `/api/groups/${id}/remove`],
    groupBans: ['GET', `/api/groups/${id}/bans`],
    unblockGroupMember: ['POST', `/api/groups/${id}/unblock`],
    messages: [
      'GET',
      `/api/chat-rooms/${id}/messages${body.before && /^\d+$/.test(String(body.before)) ? '?before=' + body.before : ''}`,
    ],
    sendMessage: ['POST', `/api/chat-rooms/${id}/messages`],
    practice: ['GET', `/api/practice/${id}`],
    savePractice: ['PUT', `/api/practice/${id}/answers`],
    submitPractice: ['POST', `/api/practice/${id}/submit`],
    retryMistakes: ['POST', `/api/practice/${id}/mistakes`],
    quiz: ['GET', `/api/question-sets/${id}`],
    saveQuiz: ['PUT', `/api/question-sets/${id}`],
  };
  Object.assign(dynamic, {
    battle: ['GET', `/api/battles/${id}`],
    joinBattle: ['POST', `/api/battles/${id}/join`],
    startBattle: ['POST', `/api/battles/${id}/start`],
    leaveBattle: ['POST', `/api/battles/${id}/leave`],
    heartbeat: ['POST', `/api/battles/${id}/heartbeat`],
    answer: ['POST', `/api/battles/${id}/answers`],
    signal: ['POST', `/api/battles/${id}/signal`],
    ice: ['GET', `/api/battles/${id}/ice-servers`],
  });
  Object.assign(dynamic, {
    roomCall: ['GET', `/api/chat-rooms/${id}/call`],
    call: ['GET', `/api/calls/${id}`],
    joinCall: ['POST', `/api/calls/${id}/join`],
    callHeartbeat: ['POST', `/api/calls/${id}/heartbeat`],
    leaveCall: ['POST', `/api/calls/${id}/leave`],
    declineCall: ['POST', `/api/calls/${id}/decline`],
    callSignal: ['POST', `/api/calls/${id}/signal`],
    callIce: ['GET', `/api/calls/${id}/ice-servers`],
  });
  if (['editMessage', 'deleteMessage', 'pinMessage'].includes(action)) {
    if (!Number.isSafeInteger(body.messageId) || body.messageId <= 0) {
      throw new Error('ID tin nhắn không hợp lệ');
    }
    if (action === 'editMessage') {
      return ['PUT', `/api/chat-rooms/${id}/messages/${body.messageId}`];
    }
    if (action === 'deleteMessage') {
      return ['DELETE', `/api/chat-rooms/${id}/messages/${body.messageId}`];
    }
    return ['PUT', `/api/chat-rooms/${id}/messages/${body.messageId}/pin`];
  }
  dynamic.reactions = ['GET', `/api/chat-rooms/${id}/reactions`];
  if (action === 'toggleReaction' && Number.isSafeInteger(body.messageId) && body.messageId > 0) {
    return ['POST', `/api/chat-rooms/${id}/messages/${body.messageId}/reactions`];
  }
  if (!Object.hasOwn(dynamic, action)) {
    throw new Error('Thao tác không hợp lệ');
  }
  return dynamic[action];
}
