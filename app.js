import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import logger from './config/logger.js';
import { Prisma } from "@prisma/client";


process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — shutting down', { stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
// const prisma = new PrismaClient();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    logger.info (`Server is running on port ${PORT}`);
});