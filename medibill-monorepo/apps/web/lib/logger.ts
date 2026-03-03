const isDev = process.env.NODE_ENV === 'development';

export function devLog(label: string, ...args: unknown[]) {
  if (isDev) console.log(`[DEV] ${label}`, ...args);
}

export function devWarn(label: string, ...args: unknown[]) {
  if (isDev) console.warn(`[DEV] ${label}`, ...args);
}
