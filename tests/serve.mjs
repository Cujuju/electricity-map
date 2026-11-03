import { createApp } from '../server/index.mjs';
const server = await createApp();
server.listen(3187, '127.0.0.1');
process.on('SIGTERM', () => server.close());
