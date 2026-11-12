const main = async (): Promise<void> => {
  let shuttingDown = false;

  const shutdown = async (reason: string, error?: unknown): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    if (error) logger.error({ err: error, reason }, 'Shutting down due to error');
    else logger.info({ reason }, 'Shutting down');
  };
};
