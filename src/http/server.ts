import { createApp, createPersistentApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL?.trim();

async function listen(): Promise<void> {
  const { app } = databaseUrl ? await createPersistentApp(databaseUrl) : createApp();
  if (databaseUrl) {
    console.log('DATABASE_URL is set; using Postgres stores');
  } else {
    console.log('DATABASE_URL unset; using in-memory stores');
  }
  app.listen(port, '0.0.0.0', () => {
    console.log(`JetonBro listening on http://0.0.0.0:${port}`);
  });
}

void listen().catch((error) => {
  console.error(error);
  process.exit(1);
});
