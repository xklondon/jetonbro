import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const { app } = createApp();
app.listen(port, () => {
  console.log(`JetonBro API on http://127.0.0.1:${port}`);
});
