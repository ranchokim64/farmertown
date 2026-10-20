import { config } from './config.js';
import { createRedis } from './redis.js';
import { createApp } from './app.js';

const redis = await createRedis(config.redisUrl);
const app = createApp({ redis, config });

app.listen(config.port, () => {
  console.log(`🌾 가래떡 마을 서버 실행 중: http://localhost:${config.port}`);
});
