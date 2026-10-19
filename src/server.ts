import { app } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

const PORT = env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`
========================================================================
🚀 SentinelApply Core Backend Engine Running
------------------------------------------------------------------------
🌐 Environment : ${env.NODE_ENV}
📡 Port        : ${PORT}
🔗 API Base    : http://localhost:${PORT}/api/v1
🛡️ Step Scope  : Step A1 (Auth & Onboarding) + Step A2 (Resume Staging)
========================================================================
  `);
});

// Graceful Shutdown
async function shutdown(signal: string) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    await prisma.$disconnect();
    console.log('[Prisma] Database connection disconnected.');
    process.exit(0);
  });

  // Force exit after 5 seconds if not closed
  setTimeout(() => {
    console.error('[Server] Force exit timeout reached.');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
