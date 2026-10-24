// Load server/.env no matter which folder the app is started from (Render uses dashboard env vars instead)
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)), quiet: true });
