import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envFiles = ['.env.local', '.env'];

export const loadLocalEnv = (): void => {
  for (const file of envFiles) {
    const path = resolve(process.cwd(), file);

    if (existsSync(path)) {
      process.loadEnvFile(path);
    }
  }
};
