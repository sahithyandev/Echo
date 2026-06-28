import { drizzle } from 'drizzle-orm/libsql';
import { getEnvVar } from './utils/env';

export const db = drizzle(getEnvVar("DATABASE_URL"));
