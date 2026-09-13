import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  console.log('DATABASE_URL is set; escrow store is still in-memory until a Postgres adapter exists');
} else {
  console.log('DATABASE_URL unset; using in-memory escrow store');
}

const { app } = createApp();
app.listen(port, '0.0.0.0', () => {
  console.log(`JetonBro listening on http://0.0.0.0:${port}`);
});
