import { isTauri, invoke } from '@tauri-apps/api/core';

export function clientLog(level: 'INFO' | 'WARN' | 'ERROR' | 'AUDIO', tag: string, message: string) {
  const line = `[${level}] [${tag}] ${message}`;
  if (level === 'ERROR') {
    console.error(line);
  } else if (level === 'WARN') {
    console.warn(line);
  } else {
    console.log(line);
  }

  if (isTauri()) {
    invoke('client_log', { level, tag, message }).catch(() => {});
  }
}

export const logger = {
  info: (tag: string, message: string) => clientLog('INFO', tag, message),
  warn: (tag: string, message: string) => clientLog('WARN', tag, message),
  error: (tag: string, message: string) => clientLog('ERROR', tag, message),
  audio: (tag: string, message: string) => clientLog('AUDIO', tag, message),
};
