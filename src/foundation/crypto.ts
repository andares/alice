/**
 * 加密工具 —— API Key / 密码哈希 / JWT / CSRF
 *
 * 全部基于 Bun 内置 API，零外部依赖。
 */

import { Database } from 'bun:sqlite';
import { getSetting, setSetting } from './db';

function base64UrlEncode(data: Uint8Array): string {
  const binary = String.fromCharCode(...data);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.length !== bufB.length) return false;
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

function decodeBase64UrlJson<T>(str: string): T {
  let padded = str.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  return JSON.parse(atob(padded)) as T;
}

export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

const jwtAlgorithm: HmacImportParams = { name: 'HMAC', hash: 'SHA-256' };

async function importHmacKey(secret: string, usage: KeyUsage): Promise<CryptoKey> {
  const keyData = new TextEncoder().encode(secret);
  return crypto.subtle.importKey('raw', keyData, jwtAlgorithm, false, [usage]);
}

// ── API Key ────────────────────────────────────────────────────────

export function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `sk-${hex}`;
}

export function hashApiKey(key: string): Promise<string> {
  return Bun.password.hash(key, { algorithm: 'bcrypt', cost: 10 });
}

export function verifyApiKey(hash: string, key: string): Promise<boolean> {
  return Bun.password.verify(key, hash);
}

// ── 密码 ───────────────────────────────────────────────────────────

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

// ── JWT ────────────────────────────────────────────────────────────

export function generateJwtSecret(): string {
  const bytes = new Uint8Array(36);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const headerEncoded = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })),
  );
  const payloadEncoded = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const key = await importHmacKey(secret, 'sign');
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const signature = new Uint8Array(
    (() => {
      let padded = signatureEncoded.replace(/-/g, '+').replace(/_/g, '/');
      while (padded.length % 4) padded += '=';
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    })(),
  );

  const key = await importHmacKey(secret, 'verify');
  const isValid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(signingInput));

  if (!isValid) {
    throw new Error('Invalid JWT signature');
  }

  const header = decodeBase64UrlJson<{ alg: string; typ: string }>(headerEncoded);
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Invalid JWT header: expected HS256 / JWT');
  }

  const payload = decodeBase64UrlJson<JwtPayload>(payloadEncoded);

  if (payload.exp !== undefined && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('JWT has expired');
  }

  return payload;
}

// ── CSRF ───────────────────────────────────────────────────────────

export function generateCsrfToken(): string {
  return crypto.randomUUID();
}

export function validateCsrfToken(token: string, stored: string): boolean {
  return timingSafeEqual(token, stored);
}

// ── JWT Secret 管理 ──────────────────────────────────────────────

/** settings 表中 JWT Secret 的键名 */
const JWT_SECRET_KEY = 'jwt_secret';

/**
 * 从 settings 表读取 JWT Secret，不存在则生成并持久化
 *
 * 该函数幂等：多次调用始终返回相同的 secret。
 * Secret 为 72 字符十六进制字符串（36 字节随机数）。
 */
export function getOrCreateJwtSecret(db: Database): string {
  const existing = getSetting(db, JWT_SECRET_KEY);
  if (existing) return existing;

  const secret = generateJwtSecret();
  setSetting(db, JWT_SECRET_KEY, secret);
  return secret;
}
