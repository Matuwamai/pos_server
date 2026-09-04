import dotenv from 'dotenv';
dotenv.config();

export default {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
};
