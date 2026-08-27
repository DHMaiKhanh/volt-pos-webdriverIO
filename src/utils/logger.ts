import fs from 'node:fs';
import path from 'node:path';
import winston from 'winston';
import { Paths } from '../../configs/constants/paths.js';

const level = process.env.LOG_LEVEL ?? 'info';

fs.mkdirSync(Paths.LOGS, { recursive: true });

const line = winston.format.printf(({ timestamp, level: lvl, message, module, ...rest }) => {
  const meta = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
  // Narrowed rather than `String(module)`: the field comes off winston's
  // open-ended `info` object, so anything can be sitting in it, and stringifying
  // an object would print `[module: [object Object]]` into every line of the run
  // log — noise that looks like a logger bug rather than a bad caller.
  const mod = typeof module === 'string' && module !== '' ? `[${module}] ` : '';
  return `${String(timestamp)} ${lvl.toUpperCase()} ${mod}${String(message)}${meta}`;
});

/**
 * Structured run log.
 *
 * The console transport is what an engineer reads while watching a run; the
 * file transport is what survives a CI job whose console was truncated. Both
 * carry the `module` child field so a failure can be traced to the page object
 * that produced it without adding prefixes by hand.
 */
export const Logger = winston.createLogger({
  level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    line,
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(Paths.LOGS, 'e2e.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 3,
      tailable: true,
    }),
  ],
});

/** A logger bound to one module name, e.g. `moduleLogger('HomePage')`. */
export const moduleLogger = (module: string): winston.Logger => Logger.child({ module });
