import 'dotenv/config';
import process from 'process';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Did you create a .env file (see .env.example)?`);
  }
  return value;
};

export const baseURL = required('API_BASE_URL');
export const apiKey = required('API_KEY');
