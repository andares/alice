import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  initChatDb,
  closeChatDb,
  createConversation,
  getConversations,
  getConversation,
  updateConversationTitle,
  deleteConversation,
  createMessage,
  getMessages,
  updateMessageContent,
} from '../../../src/services/chat-db';
import type { Database } from 'bun:sqlite';

let db: Database;
let dbPath: string;

/** 测试用默认用户 ID */
const USER_ID = 1;
const OTHER_USER_ID = 2;

describe('chat-db', () => {
  beforeEach(() => {
    dbPath = `/tmp/chat-db-test-${Date.now()}.db`;
    db = initChatDb(dbPath);
  });

  afterEach(() => {
    closeChatDb(db);
    try {
      Bun.file(dbPath).delete();
    } catch {
      // 忽略清理错误
    }
  });

  describe('initChatDb', () => {
    it('should create tables and indexes successfully', () => {
      const tables = db
        .query("SELECT name FROM sqlite_master WHERE type='table';")
        .all() as Array<{ name: string }>;
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('conversations');
      expect(tableNames).toContain('messages');

      const indexes = db
        .query("SELECT name FROM sqlite_master WHERE type='index';")
        .all() as Array<{ name: string }>;
      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain('idx_messages_conversation');
      expect(indexNames).toContain('idx_conversations_updated');
    });
  });

  describe('createConversation', () => {
    it('should create a conversation with default values', () => {
      const conv = createConversation(db, {}, USER_ID);
      expect(conv.title).toBe('New Chat');
      expect(conv.model).toBe('');
      expect(conv.user_id).toBe(USER_ID);
      expect(typeof conv.id).toBe('string');
      expect(conv.id.length).toBeGreaterThan(0);
      expect(conv.created_at).toBeNumber();
      expect(conv.updated_at).toBe(conv.created_at);
    });

    it('should create a conversation with custom values', () => {
      const conv = createConversation(db, {
        title: 'Custom Title',
        model: 'llama3.1:8b',
      }, USER_ID);
      expect(conv.title).toBe('Custom Title');
      expect(conv.model).toBe('llama3.1:8b');
      expect(conv.user_id).toBe(USER_ID);
    });
  });

  describe('getConversations', () => {
    it('should return empty array when no conversations exist', () => {
      const convs = getConversations(db, USER_ID);
      expect(convs).toBeArray();
      expect(convs.length).toBe(0);
    });

    it('should return conversations ordered by updated_at DESC', () => {
      const conv1 = createConversation(db, { title: 'First' }, USER_ID);
      const conv2 = createConversation(db, { title: 'Second' }, USER_ID);

      const convs = getConversations(db, USER_ID);
      expect(convs.length).toBe(2);
      // 后创建的 updated_at 更大，应排在前面
      expect(convs[0].id).toBe(conv2.id);
      expect(convs[1].id).toBe(conv1.id);
    });

    it('should only return conversations for the specified user', () => {
      createConversation(db, { title: 'User1 Conv' }, USER_ID);
      createConversation(db, { title: 'User2 Conv' }, OTHER_USER_ID);

      const user1Convs = getConversations(db, USER_ID);
      const user2Convs = getConversations(db, OTHER_USER_ID);
      expect(user1Convs.length).toBe(1);
      expect(user1Convs[0].title).toBe('User1 Conv');
      expect(user2Convs.length).toBe(1);
      expect(user2Convs[0].title).toBe('User2 Conv');
    });
  });

  describe('getConversation', () => {
    it('should return null for non-existent id', () => {
      const conv = getConversation(db, 'non-existent-id');
      expect(conv).toBeNull();
    });

    it('should return the correct conversation', () => {
      const created = createConversation(db, { title: 'Test' }, USER_ID);
      const fetched = getConversation(db, created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.title).toBe('Test');
    });

    it('should enforce user ownership when userId is provided', () => {
      const created = createConversation(db, { title: 'Owned' }, USER_ID);
      // 同一用户可以获取
      const ownConv = getConversation(db, created.id, USER_ID);
      expect(ownConv).not.toBeNull();
      // 不同用户获取不到
      const otherConv = getConversation(db, created.id, OTHER_USER_ID);
      expect(otherConv).toBeNull();
    });
  });

  describe('updateConversationTitle', () => {
    it('should return null for non-existent conversation', () => {
      const result = updateConversationTitle(db, 'non-existent', 'New Title');
      expect(result).toBeNull();
    });

    it('should update title and updated_at', () => {
      const created = createConversation(db, { title: 'Old Title' }, USER_ID);
      const updated = updateConversationTitle(db, created.id, 'New Title');
      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('New Title');
      expect(updated!.updated_at).toBeGreaterThan(created.updated_at);

      const fetched = getConversation(db, created.id);
      expect(fetched!.title).toBe('New Title');
    });
  });

  describe('deleteConversation', () => {
    it('should return false for non-existent conversation', () => {
      const result = deleteConversation(db, 'non-existent');
      expect(result).toBe(false);
    });

    it('should delete conversation and cascade messages', () => {
      const conv = createConversation(db, {}, USER_ID);
      createMessage(db, {
        conversation_id: conv.id,
        role: 'user',
        content: 'Hello',
      }, USER_ID);

      const deleted = deleteConversation(db, conv.id);
      expect(deleted).toBe(true);
      expect(getConversation(db, conv.id)).toBeNull();
      expect(getMessages(db, conv.id, USER_ID).length).toBe(0);
    });
  });

  describe('createMessage', () => {
    it('should create a message and update conversation updated_at', () => {
      const conv = createConversation(db, {}, USER_ID);
      const msg = createMessage(db, {
        conversation_id: conv.id,
        role: 'user',
        content: 'Hello',
      }, USER_ID);

      expect(msg.conversation_id).toBe(conv.id);
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello');
      expect(msg.reasoning).toBeNull();
      expect(msg.user_id).toBe(USER_ID);
      expect(typeof msg.id).toBe('string');
      expect(msg.id.length).toBeGreaterThan(0);

      const updatedConv = getConversation(db, conv.id);
      expect(updatedConv!.updated_at).toBeGreaterThanOrEqual(conv.updated_at);
    });

    it('should create a message with reasoning', () => {
      const conv = createConversation(db, {}, USER_ID);
      const msg = createMessage(db, {
        conversation_id: conv.id,
        role: 'assistant',
        content: 'Answer',
        reasoning: 'Step 1, Step 2',
      }, USER_ID);

      expect(msg.reasoning).toBe('Step 1, Step 2');
    });

    it('should support system role', () => {
      const conv = createConversation(db, {}, USER_ID);
      const msg = createMessage(db, {
        conversation_id: conv.id,
        role: 'system',
        content: 'System prompt',
      }, USER_ID);

      expect(msg.role).toBe('system');
    });
  });

  describe('getMessages', () => {
    it('should return empty array when no messages exist', () => {
      const conv = createConversation(db, {}, USER_ID);
      const msgs = getMessages(db, conv.id, USER_ID);
      expect(msgs).toBeArray();
      expect(msgs.length).toBe(0);
    });

    it('should return messages ordered by created_at ASC', () => {
      const conv = createConversation(db, {}, USER_ID);
      const msg1 = createMessage(db, {
        conversation_id: conv.id,
        role: 'user',
        content: 'First',
      }, USER_ID);
      const msg2 = createMessage(db, {
        conversation_id: conv.id,
        role: 'assistant',
        content: 'Second',
      }, USER_ID);

      const msgs = getMessages(db, conv.id, USER_ID);
      expect(msgs.length).toBe(2);
      expect(msgs[0].id).toBe(msg1.id);
      expect(msgs[1].id).toBe(msg2.id);
    });

    it('should only return messages for the specified conversation', () => {
      const conv1 = createConversation(db, {}, USER_ID);
      const conv2 = createConversation(db, {}, USER_ID);

      createMessage(db, {
        conversation_id: conv1.id,
        role: 'user',
        content: 'Conv1 msg',
      }, USER_ID);

      const msgs = getMessages(db, conv2.id, USER_ID);
      expect(msgs.length).toBe(0);
    });

    it('should return empty array when conversation belongs to another user', () => {
      const conv = createConversation(db, {}, USER_ID);
      createMessage(db, {
        conversation_id: conv.id,
        role: 'user',
        content: 'Hello',
      }, USER_ID);

      // 不同用户查看应返回空数组
      const msgs = getMessages(db, conv.id, OTHER_USER_ID);
      expect(msgs.length).toBe(0);
    });
  });

  describe('updateMessageContent', () => {
    it('should return null for non-existent message', () => {
      const result = updateMessageContent(db, 'non-existent', 'New content');
      expect(result).toBeNull();
    });

    it('should update message content', () => {
      const conv = createConversation(db, {}, USER_ID);
      const msg = createMessage(db, {
        conversation_id: conv.id,
        role: 'user',
        content: 'Original',
      }, USER_ID);

      const updated = updateMessageContent(db, msg.id, 'Updated');
      expect(updated).not.toBeNull();
      expect(updated!.content).toBe('Updated');

      const fetched = getMessages(db, conv.id, USER_ID);
      expect(fetched[0].content).toBe('Updated');
    });
  });

  describe('closeChatDb', () => {
    it('should close the database without error', () => {
      const testDb = initChatDb(`/tmp/chat-db-close-test-${Date.now()}.db`);
      closeChatDb(testDb);
      // 关闭后再次操作应抛出异常
      expect(() => testDb.query('SELECT 1;')).toThrow();
    });
  });
});
