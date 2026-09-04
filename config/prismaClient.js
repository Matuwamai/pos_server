import { PrismaClient } from '@prisma/client';
import logger from './logger.js';
 
// Reuse a single PrismaClient instance across the app (avoids exhausting
// MySQL connections, especially important with nodemon hot-reloads in dev).
const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});
 
// Pipe Prisma's own warnings/errors through winston so every log in the
// app — including from the ORM layer — goes through one consistent place.
prisma.$on('warn', (e) => logger.warn('Prisma warning', { message: e.message }));
prisma.$on('error', (e) => logger.error('Prisma error', { message: e.message }));
 
export default prisma;