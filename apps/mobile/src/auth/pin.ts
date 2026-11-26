import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const key = 'uangku_app_pin_hash';
const attemptLimit = 10;
type StoredPin = { salt: string; hash: string; failures: number; until: number };
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();

function serialized<T>(work: () => Promise<T>): Promise<T> {
  const result = queue.then(work);
  queue = result.catch(() => {});
  return result;
}

function digest(salt: string, digits: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${digits}`);
}
function write(pin: StoredPin) {
  return SecureStore.setItemAsync(key, JSON.stringify(pin), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}
async function makePin(digits: string): Promise<StoredPin> {
  if (!/^\d{6}$/.test(digits)) throw new Error('PIN harus terdiri dari 6 angka.');
  const salt = Crypto.randomUUID();
  return { salt, hash: await digest(salt, digits), failures: 0, until: 0 };
}
async function read(): Promise<StoredPin | null> {
  const value = await SecureStore.getItemAsync(key);
  if (value === null) return null;
  if (/^\d{6}$/.test(value)) {
    const migrated = await makePin(value);
    await write(migrated);
    return migrated;
  }
  const pin: StoredPin = JSON.parse(value);
  if (!pin.salt || !/^[0-9a-f]{64}$/i.test(pin.hash) || !Number.isInteger(pin.failures) ||
      pin.failures < 0 || !Number.isFinite(pin.until)) throw new Error('Status PIN tidak dapat dibaca.');
  return pin;
}
function state(pin: StoredPin | null) {
  return { hasPin: !!pin, requiresLogin: !!pin && pin.failures >= attemptLimit,
    failures: pin?.failures ?? 0, seconds: Math.max(0, Math.ceil(((pin?.until ?? 0) - Date.now()) / 1000)) };
}
export const pinState = () => serialized(async () => state(await read()));
export const savePin = (digits: string) => serialized(async () => write(await makePin(digits)));
export function onPinExhausted(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function verifyPin(digits: string) {
  return serialized(async () => {
    const pin = await read();
    const prior = state(pin);
    if (!pin || prior.requiresLogin || prior.seconds) return { ...prior, ok: false };
    const ok = await digest(pin.salt, digits) === pin.hash;
    pin.failures = ok ? 0 : pin.failures + 1;
    pin.until = pin.failures >= 5 ? Date.now() + 30000 : 0;
    await write(pin);
    if (pin.failures >= attemptLimit) for (const listener of listeners) listener();
    return { ...state(pin), ok };
  });
}
