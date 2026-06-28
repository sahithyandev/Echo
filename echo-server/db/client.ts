import { drizzle } from 'drizzle-orm/libsql';
import { getEnvVar } from '../utils/env';

export const client = drizzle(getEnvVar("DATABASE_URL"));
