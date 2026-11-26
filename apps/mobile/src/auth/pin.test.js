import { expect, it, mock, spyOn } from 'bun:test';
import { createHash, randomUUID } from 'node:crypto';

const store = new Map();
mock.module('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: async key => store.get(key) ?? null,
  setItemAsync: async (key, value) => { store.set(key, value); },
}));
mock.module('expo-crypto', () => ({
  randomUUID, CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_, value) => createHash('sha256').update(value).digest('hex'),
}));
const { pinState, savePin, verifyPin } = await import('./pin');

it('migrates a legacy PIN, retains lockouts in secure storage, and requires recovery at the tenth failure', async () => {
  const digits = '580319';
  const key = 'uangku_app_pin_hash';
  store.set(key, digits);
  let now = Date.now();
  const clock = spyOn(Date, 'now').mockImplementation(() => now);
  try {
    expect((await verifyPin(digits)).ok).toBe(true);
    expect(store.get(key)).not.toBe(digits);
    for (let i = 1; i <= 10; i++) {
      expect((await verifyPin('000000')).failures).toBe(i);
      if (i >= 5) {
        expect((await verifyPin(digits)).ok).toBe(false);
        expect(JSON.parse(store.get(key)).until).toBeGreaterThan(now);
        now += 31000;
      }
    }
    expect((await pinState()).requiresLogin).toBe(true);
    expect((await verifyPin(digits)).ok).toBe(false);
    await savePin('738624');
    expect((await verifyPin('738624')).ok).toBe(true);
  } finally { clock.mockRestore(); }
});
