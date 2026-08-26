import { createApp } from './app.factory';
import { logger } from './logging/logger';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.child({ port }).info(`Manhar Nexus API listening on http://localhost:${port}`);
}

void bootstrap();
