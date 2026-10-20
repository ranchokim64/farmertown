import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNickname, containsProfanity } from '../src/profanity.js';

test('정상 닉네임 허용', () => {
  assert.deepEqual(validateNickname('  꼬마 농부  '), { ok: true, nickname: '꼬마 농부' });
  assert.equal(validateNickname('Farmer7').ok, true);
});

test('길이/문자 규칙', () => {
  assert.equal(validateNickname('가').ok, false);
  assert.equal(validateNickname('가나다라마바사아자차카').ok, false);
  assert.equal(validateNickname('농부<script>').ok, false);
});

test('비속어 및 우회 표현 차단', () => {
  for (const bad of ['시발', '시 1 발', '씨.발', 'ㅅㅂ', 'F u c k', '관리자']) {
    assert.equal(containsProfanity(bad), true, bad);
  }
  assert.equal(validateNickname('개새끼').ok, false);
});
