/**
 * Chat Storage - Persist chat sessions.
 *
 * In server mode (NEXT_PUBLIC_STORAGE_BACKEND=server):
 *   Chat sessions are embedded in the stage JSON via saveStageData/loadStageData,
 *   so save/load/delete operations here are no-ops.
 *
 * In IndexedDB mode (legacy):
 *   Sessions are stored in the chatSessions table independently from the stage.
 */

import type { ChatSession, ChatMessageMetadata, SessionStatus } from '@/lib/types/chat';
import type { UIMessage } from 'ai';
import { isServerStorageEnabled } from './storage-backend';

/** Maximum messages per session to avoid IndexedDB bloat */
const MAX_MESSAGES_PER_SESSION = 200;

/**
 * Save chat sessions for a stage.
 */
export async function saveChatSessions(stageId: string, sessions: ChatSession[]): Promise<void> {
  // Server mode: chats are saved as part of StageStoreData in saveStageData — no-op here.
  if (isServerStorageEnabled()) return;

  const { db } = await import('./database');

  if (!sessions || sessions.length === 0) {
    await db.chatSessions.where('stageId').equals(stageId).delete();
    return;
  }

  const records = sessions.map((session) => ({
    id: session.id,
    stageId,
    type: session.type,
    title: session.title,
    status: (session.status === 'active' ? 'interrupted' : session.status) as SessionStatus,
    messages: session.messages.slice(-MAX_MESSAGES_PER_SESSION),
    config: session.config,
    toolCalls: session.toolCalls,
    pendingToolCalls: [],
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    sceneId: session.sceneId,
    lastActionIndex: session.lastActionIndex,
  }));

  await db.transaction('rw', db.chatSessions, async () => {
    await db.chatSessions.where('stageId').equals(stageId).delete();
    await db.chatSessions.bulkPut(records);
  });
}

/**
 * Load chat sessions for a stage.
 */
export async function loadChatSessions(stageId: string): Promise<ChatSession[]> {
  // Server mode: chats are returned as part of StageStoreData in loadStageData.
  if (isServerStorageEnabled()) return [];

  const { db } = await import('./database');
  const records = await db.chatSessions.where('stageId').equals(stageId).sortBy('createdAt');

  return records.map((record) => ({
    id: record.id,
    type: record.type,
    title: record.title,
    status: record.status,
    messages: record.messages as UIMessage<ChatMessageMetadata>[],
    config: record.config,
    toolCalls: record.toolCalls,
    pendingToolCalls: record.pendingToolCalls,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    sceneId: record.sceneId,
    lastActionIndex: record.lastActionIndex,
  }));
}

/**
 * Delete all chat sessions for a stage.
 */
export async function deleteChatSessions(stageId: string): Promise<void> {
  // Server mode: handled by deleteStageData (which deletes the whole stage directory).
  if (isServerStorageEnabled()) return;

  const { db } = await import('./database');
  await db.chatSessions.where('stageId').equals(stageId).delete();
}
