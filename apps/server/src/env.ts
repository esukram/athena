import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root
dotenv.config({ path: path.join(process.cwd(), './.env') });
