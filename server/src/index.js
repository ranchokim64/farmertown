import { config } from './config.js';
import { createStore } from './stores/index.js';
import { createApp } from './app.js';

const store = await createStore(config);
const app = createApp({ store, config });

app.listen(config.port, () => {
  console.log(`🌾 가래떡 마을 서버 실행 중: http://localhost:${config.port} (저장소: ${store.kind})`);
});
