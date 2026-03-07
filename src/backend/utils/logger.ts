import { createWriteStream } from 'fs';
import { mkdirSync, existsSync } from 'fs';

// Ensure logs directory exists
if (!existsSync('./logs')) {
  mkdirSync('./logs', { recursive: true });
}

const logStream = createWriteStream('./logs/app.log', { flags: 'a' });
const errorStream = createWriteStream('./logs/error.log', { flags: 'a' });

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] INFO: ${message} ${meta ? JSON.stringify(meta) : ''}\n`;
    console.log(logLine.trim());
    logStream.write(logLine);
  },
  
  error: (message: string, error?: Error | unknown, meta?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const errorDetails = error instanceof Error ? error.stack : String(error);
    const logLine = `[${timestamp}] ERROR: ${message} ${meta ? JSON.stringify(meta) : ''}\n`;
    const errorLine = errorDetails ? `[${timestamp}] ERROR DETAILS: ${errorDetails}\n` : '';
    console.error(logLine.trim(), errorDetails || '');
    logStream.write(logLine);
    errorStream.write(logLine);
    if (errorLine) errorStream.write(errorLine);
  },
  
  warn: (message: string, meta?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] WARN: ${message} ${meta ? JSON.stringify(meta) : ''}\n`;
    console.warn(logLine.trim());
    logStream.write(logLine);
  },
  
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.DEBUG === 'true') {
      const timestamp = new Date().toISOString();
      const logLine = `[${timestamp}] DEBUG: ${message} ${meta ? JSON.stringify(meta) : ''}\n`;
      console.log(logLine.trim());
    }
  }
};
