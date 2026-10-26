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
};
export type Member = { id: string; displayName: string; online?: boolean };
export type RoomCall = {
  id: string;
  roomId: string;
  callerId: string;
  status: 'ACTIVE' | 'ENDED';
  sequence: number;
  participants: { id: string; displayName: string; camera: boolean }[];
};
export type ChatMessage = {
  id: number;
  roomId: string;
  senderId: string;
  displayName: string;
  content: string;
  requestId: string;
  createdAt: string;
};
export type Question = { text: string; options: string[]; correctIndex: number };
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
  roomId: string;
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
