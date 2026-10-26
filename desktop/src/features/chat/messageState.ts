import { type ChatMessage } from '../../lib/api';

export function latestMessage(previous: ChatMessage, incoming: ChatMessage): ChatMessage {
  let selected = incoming;
  if ((previous.revision || 0) > (incoming.revision || 0)) {
    selected = previous;
  }
  if (selected.deletedAt) {
    return { ...selected, reply: null };
  }
  let reply = selected.reply;
  for (const candidate of [previous.reply, incoming.reply]) {
    if (
      candidate &&
      reply &&
      candidate.id === reply.id &&
      (candidate.revision || 0) > (reply.revision || 0)
    ) {
      reply = candidate;
    }
  }
  return { ...selected, reply };
}

export function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const messages = new Map(previous.map((message) => [message.id, message]));
  for (const message of incoming) {
    const existing = messages.get(message.id);
    messages.set(message.id, existing ? latestMessage(existing, message) : message);
  }
  return [...messages.values()].sort((first, second) => first.id - second.id);
}
