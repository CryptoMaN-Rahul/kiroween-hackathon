/**
 * Persistence Layer
 * 
 * Abstract persistence interface with multiple adapter implementations.
 * Supports file-based storage for development and Redis for production.
 * 
 * @module persistence
 */

import { promises as fs } from 'fs';
import path from 'path';

// =============================================================================
// Types
// =============================================================================

export interface PersistenceAdapter {
  /** Get a value by key */
  get<T>(key: string): Promise<T | null>;
  /** Set a value with optional TTL in seconds */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  /** Delete a key */
  delete(key: string): Promise<boolean>;
  /** Check if key exists */
  has(key: string): Promise<boolean>;
  /** Get all keys matching a pattern (glob-style) */
  keys(pattern?: string): Promise<string[]>;
  /** Clear all data */
  clear(): Promise<void>;
  /** Close connection (for cleanup) */
  close(): Promise<void>;
}

export interface PersistenceConfig {
  /** Adapter type */
  type: 'memory' | 'file' | 'redis';
  /** File path for file adapter */
  filePath?: string;
  /** Redis URL for redis adapter */
  redisUrl?: string;
  /** Key prefix for namespacing */
  keyPrefix?: string;
}

// =============================================================================
// Memory Adapter (Default, for testing)
// =============================================================================

interface MemoryEntry<T> {
  value: T;
  expiresAt?: number;
}

export class MemoryPersistenceAdapter implements PersistenceAdapter {
  private store: Map<string, MemoryEntry<unknown>> = new Map();
  private keyPrefix: string;
  
  constructor(keyPrefix: string = '') {
    this.keyPrefix = keyPrefix;
  }
  
  private prefixKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }
  
  private isExpired(entry: MemoryEntry<unknown>): boolean {
    return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
  }
  
  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);
    const entry = this.store.get(prefixedKey) as MemoryEntry<T> | undefined;
    
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(prefixedKey);
      return null;
    }
    
    return entry.value;
  }
  
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    const entry: MemoryEntry<T> = { value };
    
    if (ttlSeconds !== undefined && ttlSeconds > 0) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
    
    this.store.set(prefixedKey, entry);
  }
  
  async delete(key: string): Promise<boolean> {
    return this.store.delete(this.prefixKey(key));
  }
  
  async has(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const entry = this.store.get(prefixedKey);
    
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.store.delete(prefixedKey);
      return false;
    }
    
    return true;
  }
  
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys());
    const prefix = this.keyPrefix ? `${this.keyPrefix}:` : '';
    
    // Filter out expired entries
    const validKeys = allKeys.filter(k => {
      const entry = this.store.get(k);
      if (entry && this.isExpired(entry)) {
        this.store.delete(k);
        return false;
      }
      return true;
    });
    
    // Remove prefix from keys
    let keys = validKeys.map(k => 
      prefix && k.startsWith(prefix) ? k.slice(prefix.length) : k
    );
    
    // Filter by pattern if provided
    if (pattern) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      keys = keys.filter(k => regex.test(k));
    }
    
    return keys;
  }
  
  async clear(): Promise<void> {
    if (this.keyPrefix) {
      const prefix = `${this.keyPrefix}:`;
      const keys = Array.from(this.store.keys());
      for (const key of keys) {
        if (key.startsWith(prefix)) {
          this.store.delete(key);
        }
      }
    } else {
      this.store.clear();
    }
  }
  
  async close(): Promise<void> {
    // No-op for memory adapter
  }
}

// =============================================================================
// File Adapter (Development/Small Deployments)
// =============================================================================

interface FileStore {
  entries: Record<string, { value: unknown; expiresAt?: number }>;
  version: number;
}

export class FilePersistenceAdapter implements PersistenceAdapter {
  private filePath: string;
  private keyPrefix: string;
  private writeQueue: Promise<void> = Promise.resolve();
  private cache: FileStore | null = null;
  private dirty: boolean = false;
  private flushInterval: NodeJS.Timeout | null = null;
  
  constructor(filePath: string, keyPrefix: string = '') {
    this.filePath = filePath;
    this.keyPrefix = keyPrefix;
    
    // Periodic flush to disk
    this.flushInterval = setInterval(() => {
      if (this.dirty) {
        this.flush().catch(console.error);
      }
    }, 5000); // Flush every 5 seconds if dirty
  }
  
  private prefixKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }
  
  private async load(): Promise<FileStore> {
    if (this.cache) return this.cache;
    
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.cache = JSON.parse(content);
      return this.cache!;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.cache = { entries: {}, version: 1 };
        return this.cache;
      }
      throw error;
    }
  }
  
  private async flush(): Promise<void> {
    if (!this.cache || !this.dirty) return;
    
    // Atomic write: write to temp file, then rename
    const tempPath = `${this.filePath}.tmp`;
    const dir = path.dirname(this.filePath);
    
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(this.cache, null, 2));
    await fs.rename(tempPath, this.filePath);
    
    this.dirty = false;
  }
  
  private isExpired(entry: { expiresAt?: number }): boolean {
    return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
  }
  
  async get<T>(key: string): Promise<T | null> {
    const store = await this.load();
    const prefixedKey = this.prefixKey(key);
    const entry = store.entries[prefixedKey];
    
    if (!entry) return null;
    if (this.isExpired(entry)) {
      delete store.entries[prefixedKey];
      this.dirty = true;
      return null;
    }
    
    return entry.value as T;
  }
  
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const store = await this.load();
    const prefixedKey = this.prefixKey(key);
    
    store.entries[prefixedKey] = {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined
    };
    
    this.dirty = true;
  }
  
  async delete(key: string): Promise<boolean> {
    const store = await this.load();
    const prefixedKey = this.prefixKey(key);
    
    if (prefixedKey in store.entries) {
      delete store.entries[prefixedKey];
      this.dirty = true;
      return true;
    }
    
    return false;
  }
  
  async has(key: string): Promise<boolean> {
    const store = await this.load();
    const prefixedKey = this.prefixKey(key);
    const entry = store.entries[prefixedKey];
    
    if (!entry) return false;
    if (this.isExpired(entry)) {
      delete store.entries[prefixedKey];
      this.dirty = true;
      return false;
    }
    
    return true;
  }
  
  async keys(pattern?: string): Promise<string[]> {
    const store = await this.load();
    const prefix = this.keyPrefix ? `${this.keyPrefix}:` : '';
    
    let keys = Object.keys(store.entries)
      .filter(k => {
        const entry = store.entries[k];
        if (this.isExpired(entry)) {
          delete store.entries[k];
          this.dirty = true;
          return false;
        }
        return !prefix || k.startsWith(prefix);
      })
      .map(k => prefix && k.startsWith(prefix) ? k.slice(prefix.length) : k);
    
    if (pattern) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      keys = keys.filter(k => regex.test(k));
    }
    
    return keys;
  }
  
  async clear(): Promise<void> {
    const store = await this.load();
    
    if (this.keyPrefix) {
      const prefix = `${this.keyPrefix}:`;
      for (const key of Object.keys(store.entries)) {
        if (key.startsWith(prefix)) {
          delete store.entries[key];
        }
      }
    } else {
      store.entries = {};
    }
    
    this.dirty = true;
    await this.flush();
  }
  
  async close(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    await this.flush();
  }
}

// =============================================================================
// Redis Adapter (Production)
// =============================================================================

/**
 * Redis adapter using native fetch to Redis HTTP API.
 * For full Redis support, use ioredis or redis packages.
 * This is a lightweight implementation for Upstash Redis or similar HTTP-based Redis.
 */
export class RedisPersistenceAdapter implements PersistenceAdapter {
  private redisUrl: string;
  private keyPrefix: string;
  private token?: string;
  
  constructor(redisUrl: string, keyPrefix: string = '', token?: string) {
    this.redisUrl = redisUrl;
    this.keyPrefix = keyPrefix;
    this.token = token;
  }
  
  private prefixKey(key: string): string {
    return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
  }
  
  private async command(cmd: string[]): Promise<unknown> {
    const response = await fetch(this.redisUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` })
      },
      body: JSON.stringify(cmd)
    });
    
    if (!response.ok) {
      throw new Error(`Redis error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    return result.result;
  }
  
  async get<T>(key: string): Promise<T | null> {
    const prefixedKey = this.prefixKey(key);
    const result = await this.command(['GET', prefixedKey]);
    
    if (result === null) return null;
    
    try {
      return JSON.parse(result as string) as T;
    } catch {
      return result as T;
    }
  }
  
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    const serialized = JSON.stringify(value);
    
    if (ttlSeconds) {
      await this.command(['SET', prefixedKey, serialized, 'EX', ttlSeconds.toString()]);
    } else {
      await this.command(['SET', prefixedKey, serialized]);
    }
  }
  
  async delete(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const result = await this.command(['DEL', prefixedKey]);
    return (result as number) > 0;
  }
  
  async has(key: string): Promise<boolean> {
    const prefixedKey = this.prefixKey(key);
    const result = await this.command(['EXISTS', prefixedKey]);
    return (result as number) > 0;
  }
  
  async keys(pattern?: string): Promise<string[]> {
    const prefix = this.keyPrefix ? `${this.keyPrefix}:` : '';
    const searchPattern = pattern 
      ? `${prefix}${pattern.replace(/\*/g, '*')}`
      : `${prefix}*`;
    
    const result = await this.command(['KEYS', searchPattern]) as string[];
    
    return result.map(k => 
      prefix && k.startsWith(prefix) ? k.slice(prefix.length) : k
    );
  }
  
  async clear(): Promise<void> {
    const keys = await this.keys('*');
    if (keys.length > 0) {
      const prefixedKeys = keys.map(k => this.prefixKey(k));
      await this.command(['DEL', ...prefixedKeys]);
    }
  }
  
  async close(): Promise<void> {
    // No-op for HTTP-based Redis
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createPersistenceAdapter(config: PersistenceConfig): PersistenceAdapter {
  switch (config.type) {
    case 'memory':
      return new MemoryPersistenceAdapter(config.keyPrefix);
    
    case 'file':
      if (!config.filePath) {
        throw new Error('filePath required for file persistence adapter');
      }
      return new FilePersistenceAdapter(config.filePath, config.keyPrefix);
    
    case 'redis':
      if (!config.redisUrl) {
        throw new Error('redisUrl required for redis persistence adapter');
      }
      return new RedisPersistenceAdapter(config.redisUrl, config.keyPrefix);
    
    default:
      throw new Error(`Unknown persistence adapter type: ${config.type}`);
  }
}

// =============================================================================
// Specialized Stores
// =============================================================================

/**
 * Alias store for router learned aliases.
 */
export interface AliasStore {
  get(from: string): Promise<string | null>;
  set(from: string, to: string): Promise<void>;
  getAll(): Promise<Map<string, string>>;
  delete(from: string): Promise<boolean>;
  clear(): Promise<void>;
}

export function createAliasStore(adapter: PersistenceAdapter): AliasStore {
  const ALIAS_PREFIX = 'alias:';
  
  return {
    async get(from: string): Promise<string | null> {
      return adapter.get<string>(`${ALIAS_PREFIX}${from}`);
    },
    
    async set(from: string, to: string): Promise<void> {
      await adapter.set(`${ALIAS_PREFIX}${from}`, to);
    },
    
    async getAll(): Promise<Map<string, string>> {
      const keys = await adapter.keys(`${ALIAS_PREFIX}*`);
      const aliases = new Map<string, string>();
      
      for (const key of keys) {
        const from = key.slice(ALIAS_PREFIX.length);
        const to = await adapter.get<string>(key);
        if (to) aliases.set(from, to);
      }
      
      return aliases;
    },
    
    async delete(from: string): Promise<boolean> {
      return adapter.delete(`${ALIAS_PREFIX}${from}`);
    },
    
    async clear(): Promise<void> {
      const keys = await adapter.keys(`${ALIAS_PREFIX}*`);
      for (const key of keys) {
        await adapter.delete(key);
      }
    }
  };
}

/**
 * Citation store for persisting discovered citations.
 */
export interface CitationPersistenceStore {
  add(citation: { id: string; [key: string]: unknown }): Promise<void>;
  get(id: string): Promise<{ id: string; [key: string]: unknown } | null>;
  getAll(): Promise<Array<{ id: string; [key: string]: unknown }>>;
  delete(id: string): Promise<boolean>;
  clear(): Promise<void>;
}

export function createCitationPersistenceStore(adapter: PersistenceAdapter): CitationPersistenceStore {
  const CITATION_PREFIX = 'citation:';
  const INDEX_KEY = 'citation_index';
  
  return {
    async add(citation: { id: string; [key: string]: unknown }): Promise<void> {
      await adapter.set(`${CITATION_PREFIX}${citation.id}`, citation);
      
      // Update index
      const index = await adapter.get<string[]>(INDEX_KEY) || [];
      if (!index.includes(citation.id)) {
        index.push(citation.id);
        await adapter.set(INDEX_KEY, index);
      }
    },
    
    async get(id: string): Promise<{ id: string; [key: string]: unknown } | null> {
      return adapter.get(`${CITATION_PREFIX}${id}`);
    },
    
    async getAll(): Promise<Array<{ id: string; [key: string]: unknown }>> {
      const index = await adapter.get<string[]>(INDEX_KEY) || [];
      const citations: Array<{ id: string; [key: string]: unknown }> = [];
      
      for (const id of index) {
        const citation = await adapter.get<{ id: string; [key: string]: unknown }>(`${CITATION_PREFIX}${id}`);
        if (citation) citations.push(citation);
      }
      
      return citations;
    },
    
    async delete(id: string): Promise<boolean> {
      const deleted = await adapter.delete(`${CITATION_PREFIX}${id}`);
      
      if (deleted) {
        const index = await adapter.get<string[]>(INDEX_KEY) || [];
        const newIndex = index.filter(i => i !== id);
        await adapter.set(INDEX_KEY, newIndex);
      }
      
      return deleted;
    },
    
    async clear(): Promise<void> {
      const index = await adapter.get<string[]>(INDEX_KEY) || [];
      
      for (const id of index) {
        await adapter.delete(`${CITATION_PREFIX}${id}`);
      }
      
      await adapter.delete(INDEX_KEY);
    }
  };
}
