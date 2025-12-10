// ============================================================================
// Utility Functions
// ============================================================================

let idCounters: Map<string, number> = new Map();

/**
 * Generates a unique ID with the given prefix
 */
export function generateId(prefix: string = 'id'): string {
  const count = (idCounters.get(prefix) || 0) + 1;
  idCounters.set(prefix, count);
  return `${prefix}_${Date.now().toString(36)}_${count.toString(36)}`;
}

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Delays execution for the specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a deep clone of an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Logs with timestamp and module prefix
 */
export function log(module: string, message: string, data?: unknown): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${module}]`;
  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

