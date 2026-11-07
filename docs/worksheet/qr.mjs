// 활동지에 넣을 게임 입장 QR (게임 안 QR 화면과 같은 라이브러리·설정: 표준 여백 4칸, 진한 색)
// client/node_modules 의 qrcode 패키지를 사용합니다 (먼저 npm --prefix client install).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const QRCode = require(require.resolve('qrcode', { paths: [path.join(here, '../../client')] }));

export const qrPng = (url) =>
  QRCode.toBuffer(url, { type: 'png', width: 480, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#1f1408', light: '#ffffff' } });
