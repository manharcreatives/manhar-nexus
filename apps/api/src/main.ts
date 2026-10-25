import { EnvValidationError } from './config/configuration';

/**
 * Prints a fatal startup error and exits 1. An invalid environment is reported
 * as one readable list of variable names (never values), not a stack trace.
 */
function fatal(error: unknown): void {
  if (error instanceof EnvValidationError) {
    process.stderr.write(`\n[nexus-api] ${error.message}\n\nSee apps/api/.env.example.\n`);
  } else {
    process.stderr.write(
      `[nexus-api] fatal startup error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
  }
  // Let stderr flush (pipe writes are async on some platforms), then exit 1.
  process.exitCode = 1;
  setTimeout(() => process.exit(1), 300).unref();
}

// ConfigModule.forRoot() is async: env validation rejects while AppModule is
// being evaluated, before Nest awaits it, so it surfaces as an unhandled
// rejection. Route it (and any other unhandled rejection) through fatal().
process.on('unhandledRejection', fatal);

async function bootstrap(): Promise<void> {
  const { createApp } = await import('./app.factory');
  const { logger } = await import('./logging/logger');
  const app = await createApp();
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.child({ port }).info(`Manhar Nexus API listening on http://localhost:${port}`);
}

bootstrap().catch(fatal);
