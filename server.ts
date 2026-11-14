import { createLogger } from './src/config/logger.js';
import { parseEnv } from './src/config/env.js';
import { Server } from 'node:https';
import { closeHttp } from './src/utils/server-lifecycle';

const main = async (): Promise<void> => {
  let shuttingDown = false;
  let server = null as Server  | null;

  const env = parseEnv()
  const logger = createLogger(env)
  const shutdown = async (reason: string, error?: unknown): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    if (error) logger.error({ err: error, reason }, 'Shutting down due to error');
    else logger.info({ reason }, 'Shutting down');


    const forceTimer = setTimeout(() => {
      logger.error("Gracefully shutting down");
      server?.closeAllConnections();
      process.exitCode = 1

    }, 10_000)

    forceTimer.unref();
    try{
      if( server) await  closeHttp(server)
    }catch (error) {
      logger.error({err: error,}, 'HTTP server shutdown failed')
    }

    clearTimeout(forceTimer);
    if(error) process.exitCode = 1;
    logger.info("Shutting down");


  };

};
