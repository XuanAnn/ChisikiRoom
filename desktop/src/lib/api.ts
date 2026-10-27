export type User = { id: string; email: string; displayName: string };
export type Room = {
  id: string;
  name: string;
  privateRoom: boolean;
  ownerId: string;
  joined: boolean;
  memberCount: number;
  kind: 'GROUP' | 'DIRECT';
  peerId: string | null;
  myRole?: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
};
export type Member = {
  id: string;
  displayName: string;
  online?: boolean;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';
};
export type RoomCall = {
  id: string;
  roomId: string;
  callerId: string;
  status: 'ACTIVE' | 'ENDED';
  sequence: number;
  participants: { id: string; displayName: string; camera: boolean }[];
};
export type ChatMessage = {
  revision?: number;
  editedAt?: string | null;
  deletedAt?: string | null;
  pinnedAt?: string | null;
  reply?: {
    id: number;
    displayName: string;
    content: string;
    deleted: boolean;
    revision?: number;
  } | null;
  id: number;
  roomId: string;
  senderId: string;
  displayName: string;
  content: string;
  requestId: string;
  createdAt: string;
};
export type Question = {
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string | null;
};
export type Quiz = {
  id: string;
  ownerId: string | null;
  title: string;
  questions: Question[];
  updatedAt: string;
};
export type ServerEvent = { eventId?: string; type: string; data: any };
export type BattlePlayer = {
  id: string;
  displayName: string;
  score: number;
  ready: boolean;
  camera: boolean;
  status: string;
  lastSeen: string;
};
export type Battle = {
  id: string;
  roomId: string | null;
  rankedResult?: string | null;
  rankedLevel?: string | null;
  ownerId: string;
  title: string;
  status: string;
  totalQuestions: number;
  sequence: number;
  serverTime: string;
  players: BattlePlayer[];
  round: {
    id: string;
    number: number;
    status: string;
    text: string;
    options: string[];
    correctIndex: number | null;
    deadlineAt: string;
    nextQuestionAt: string | null;
    winnerId: string | null;
    reason: string;
    answered: boolean;
  } | null;
};
declare global {
  interface Window {
    chisiki?: {
      request(action: string, body?: unknown): Promise<{ data?: any; error?: string }>;
      openWindow(kind: string, id?: string): Promise<void>;
      connection(): Promise<string>;
      notifyIncoming(callId: string): Promise<void>;
      respondIncoming(
        callId: string,
        decision: 'accept' | 'decline' | 'dismiss',
      ): Promise<{ data?: boolean; error?: string }>;
      avatar(userId: string): Promise<string | null>;
      uploadAvatar(): Promise<{ data?: unknown; error?: string }>;
      serverSettings(value?: string): Promise<{ data?: string; error?: string }>;
      checkServer(value: string): Promise<{
        data?: { url: string; latencyMs: number };
        error?: string;
      }>;
      uploadDocument(roomId: string): Promise<{ data?: unknown; error?: string }>;
      downloadDocument(id: string, filename: string): Promise<{ data?: unknown; error?: string }>;
      setDirty(dirty: boolean): void;
      onEvent(callback: (event: ServerEvent) => void): () => void;
    };
  }
}
export async function request<T = any>(action: string, body?: unknown): Promise<T> {
  if (!window.chisiki) {
    throw new Error('Hãy mở ứng dụng Electron để kết nối máy chủ.');
  }
  const result = await window.chisiki.request(action, body);
  if (result.error) {
    throw new Error(result.error);
  }
  return result.data as T;
}
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Có lỗi xảy ra');

export type PracticeQuestion = {
  text: string;
  options: string[];
  correctIndex: number | null;
  explanation: string | null;
};
export type PracticeAttempt = {
  id: string;
  questionSetId: string;
  title: string;
  questions: PracticeQuestion[];
  answers: number[];
  correctCount: number | null;
  startedAt: string;
  finishedAt: string | null;
};
export type PracticeHistory = {
  id: string;
  questionSetId: string;
  title: string;
  questionCount: number;
  correctCount: number | null;
  startedAt: string;
  finishedAt: string | null;
};

export type LearningProgress = {
  completedAttempts: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracy: number;
  todayAnswered: number;
  dailyGoal: number;
  date: string;
  timezone: string;
};

export type RankEntry = {
  userId: string;
  displayName: string;
  rating: number;
  deviation: number;
  games: number;
  wins: number;
  draws: number;
  provisional: boolean;
  lastPlayedAt: string | null;
};
export type RankBoard = {
  level: string;
  season: { id: number; startsAt: string; endsAt: string };
  me: RankEntry;
  leaders: RankEntry[];
};
export type RankedQueue = {
  status: 'IDLE' | 'QUEUED' | 'MATCHED';
  level: string | null;
  battleId: string | null;
  joinedAt: string | null;
};
export type RankedHistory = {
  battleId: string;
  level: string;
  season: number;
  opponent: string;
  status: string;
  outcome: string | null;
  before: number | null;
  after: number | null;
  createdAt: string;
};

export type ChatState = {
  roomId: string;
  draft: string;
  draftVersion: number;
  lastReadId: number;
  unreadCount: number;
};
