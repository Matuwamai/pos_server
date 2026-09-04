
import winston from 'winston';
import env from './env.js';

// Human-readable, colorized output for local dev; structured JSON in
// production so logs are easy to ship into something like CloudWatch,
// Datadog, or an ELK stack later without changing this file.
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  format: env.nodeEnv === 'production' ? prodFormat : devFormat,
  defaultMeta: { service: 'pos-backend' },
  transports: [
    new winston.transports.Console(),
    // Persisted logs on disk regardless of environment — swap/add a cloud
    // transport later without touching any call site since everything logs
    // through this one module.
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
  exitOnError: false,
});

export default logger;
