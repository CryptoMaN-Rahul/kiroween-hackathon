/**
 * Freshness Monitor
 * 
 * Tracks content freshness and staleness for GEO optimization.
 * Production-grade implementation with persistence support.
 * 
 * @module freshness-monitor
 */

export interface FreshnessConfig {
  staleThresholdDays: number;
  velocityWindowMonths: number;
  /** Optional persistence adapter for storing update history */
  persistence?: FreshnessPersistence;
}

export interface FreshnessMetrics {
  path: string;
  lastModified: Date;
  ageInDays: number;
  isStale: boolean;
  velocity: number;
  refreshPriority: 'critical' | 'high' | 'medium' | 'low';
}

export interface FreshnessPersistence {
  load(): Promise<Map<string, Date[]>>;
  save(data: Map<string, Date[]>): Promise<void>;
}

const DEFAULT_CONFIG: FreshnessConfig = {
  staleThresholdDays: 90,
  velocityWindowMonths: 3
};

export function calculateAgeInDays(lastModified: Date, now: Date = new Date()): number {
  const diffMs = now.getTime() - lastModified.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function determineRefreshPriority(
  ageInDays: number,
  staleThreshold: number
): 'critical' | 'high' | 'medium' | 'low' {
  if (ageInDays >= staleThreshold * 2) return 'critical';
  if (ageInDays >= staleThreshold) return 'high';
  if (ageInDays >= staleThreshold * 0.5) return 'medium';
  return 'low';
}

export function analyzeFreshness(
  path: string,
  lastModified: Date,
  config: FreshnessConfig = DEFAULT_CONFIG
): FreshnessMetrics {
  const ageInDays = calculateAgeInDays(lastModified);
  const isStale = ageInDays > config.staleThresholdDays;
  const refreshPriority = determineRefreshPriority(ageInDays, config.staleThresholdDays);
  
  return { path, lastModified, ageInDays, isStale, velocity: 0, refreshPriority };
}

export function calculateVelocity(updateHistory: Date[]): number {
  if (updateHistory.length < 2) return 0;
  
  const sorted = [...updateHistory].sort((a, b) => a.getTime() - b.getTime());
  const firstUpdate = sorted[0];
  const lastUpdate = sorted[sorted.length - 1];
  const spanMs = lastUpdate.getTime() - firstUpdate.getTime();
  const spanMonths = spanMs / (1000 * 60 * 60 * 24 * 30);
  
  if (spanMonths <= 0) return 0;
  return Math.round((updateHistory.length - 1) / spanMonths * 100) / 100;
}

export function getStalePages(
  pages: Array<{ path: string; lastModified: Date }>,
  config: FreshnessConfig = DEFAULT_CONFIG
): FreshnessMetrics[] {
  return pages
    .map(p => analyzeFreshness(p.path, p.lastModified, config))
    .filter(m => m.isStale)
    .sort((a, b) => b.ageInDays - a.ageInDays);
}

export function injectDateModified<T extends Record<string, unknown>>(
  schema: T,
  lastModified: Date
): T & { dateModified: string } {
  return { ...schema, dateModified: lastModified.toISOString().split('T')[0] };
}

/**
 * In-memory persistence adapter (default).
 */
export class MemoryPersistence implements FreshnessPersistence {
  private data: Map<string, Date[]> = new Map();
  
  async load(): Promise<Map<string, Date[]>> {
    return new Map(this.data);
  }
  
  async save(data: Map<string, Date[]>): Promise<void> {
    this.data = new Map(data);
  }
}

/**
 * LocalStorage persistence adapter (for browser environments).
 */
export class LocalStoragePersistence implements FreshnessPersistence {
  private key: string;
  
  constructor(key: string = 'chimera_freshness_history') {
    this.key = key;
  }
  
  async load(): Promise<Map<string, Date[]>> {
    if (typeof localStorage === 'undefined') return new Map();
    
    try {
      const stored = localStorage.getItem(this.key);
      if (!stored) return new Map();
      
      const parsed = JSON.parse(stored);
      const map = new Map<string, Date[]>();
      
      for (const [path, dates] of Object.entries(parsed)) {
        map.set(path, (dates as string[]).map(d => new Date(d)));
      }
      
      return map;
    } catch {
      return new Map();
    }
  }
  
  async save(data: Map<string, Date[]>): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    
    const obj: Record<string, string[]> = {};
    const entries = Array.from(data.entries());
    for (const [path, dates] of entries) {
      obj[path] = dates.map((d: Date) => d.toISOString());
    }
    
    localStorage.setItem(this.key, JSON.stringify(obj));
  }
}

/**
 * File-based persistence adapter (for Node.js environments).
 */
export class FilePersistence implements FreshnessPersistence {
  private filePath: string;
  
  constructor(filePath: string) {
    this.filePath = filePath;
  }
  
  async load(): Promise<Map<string, Date[]>> {
    try {
      // Dynamic import for Node.js fs module
      const fs = await import('fs').then(m => m.promises);
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content);
      
      const map = new Map<string, Date[]>();
      for (const [path, dates] of Object.entries(parsed)) {
        map.set(path, (dates as string[]).map(d => new Date(d)));
      }
      
      return map;
    } catch {
      return new Map();
    }
  }
  
  async save(data: Map<string, Date[]>): Promise<void> {
    try {
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      
      const obj: Record<string, string[]> = {};
      const entries = Array.from(data.entries());
      for (const [p, dates] of entries) {
        obj[p] = dates.map((d: Date) => d.toISOString());
      }
      
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
      
      await fs.writeFile(this.filePath, JSON.stringify(obj, null, 2));
    } catch (e) {
      console.error('[FreshnessMonitor] Failed to save:', e);
    }
  }
}

export interface FreshnessMonitor {
  analyze(path: string, lastModified: Date): FreshnessMetrics;
  recordUpdate(path: string, updateDate?: Date): void;
  getVelocity(path: string): number;
  getStalePages(pages: Array<{ path: string; lastModified: Date }>): FreshnessMetrics[];
  getConfig(): FreshnessConfig;
  getHistory(path: string): Date[];
  getAllHistory(): Map<string, Date[]>;
  /** Persist current state (if persistence adapter configured) */
  persist(): Promise<void>;
  /** Load state from persistence (if persistence adapter configured) */
  hydrate(): Promise<void>;
}

export function createFreshnessMonitor(config: FreshnessConfig = DEFAULT_CONFIG): FreshnessMonitor {
  const pageHistory: Map<string, Date[]> = new Map();
  const persistence = config.persistence || new MemoryPersistence();
  
  return {
    analyze(path: string, lastModified: Date): FreshnessMetrics {
      const base = analyzeFreshness(path, lastModified, config);
      const history = pageHistory.get(path) || [];
      base.velocity = calculateVelocity(history);
      return base;
    },
    
    recordUpdate(path: string, updateDate: Date = new Date()): void {
      const history = pageHistory.get(path) || [];
      history.push(updateDate);
      
      // Keep only updates within velocity window
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - config.velocityWindowMonths);
      const filtered = history.filter(d => d >= cutoff);
      
      pageHistory.set(path, filtered);
    },
    
    getVelocity(path: string): number {
      const history = pageHistory.get(path) || [];
      return calculateVelocity(history);
    },
    
    getStalePages(pages: Array<{ path: string; lastModified: Date }>): FreshnessMetrics[] {
      return getStalePages(pages, config);
    },
    
    getConfig(): FreshnessConfig {
      return { ...config };
    },
    
    getHistory(path: string): Date[] {
      return [...(pageHistory.get(path) || [])];
    },
    
    getAllHistory(): Map<string, Date[]> {
      return new Map(pageHistory);
    },
    
    async persist(): Promise<void> {
      await persistence.save(pageHistory);
    },
    
    async hydrate(): Promise<void> {
      const loaded = await persistence.load();
      const entries = Array.from(loaded.entries());
      for (const [path, dates] of entries) {
        pageHistory.set(path, dates);
      }
    }
  };
}
