/**
 * HILO card RNG — commit-reveal + HMAC-SHA256 DRBG + rejection sampling.
 *
 * Math.random() is not used. Cards come from a Fisher–Yates shuffle driven by
 * HMAC-SHA256(seed, label||index||counter). Integers in [0, n) are generated
 * with rejection sampling so there is no modulo bias.
 *
 * At round start the seed is committed (SHA-256). Every deal and guess can be
 * re-derived from the seed; verifyGuess + verifyDeck catch a mismatched card.
 */

import { RANKS, SUITS } from './constants.js';

const TE = new TextEncoder();

function asBytes(part) {
  if (typeof part === 'string') return TE.encode(part);
  if (part instanceof Uint8Array) return part;
  throw new Error('rng: bad entropy part');
}

export function concatBytes(...parts) {
  const arrays = parts.map(asBytes);
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

export function bytesToHex(u8) {
  return [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function u32be(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, false);
  return b;
}

export async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

export async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, dataBytes));
}

/** Mix CSPRNG draws with session entropy, then SHA-256. */
export async function harvestSeed({ address = '', extra = '' } = {}) {
  const a = new Uint8Array(32);
  const b = new Uint8Array(32);
  crypto.getRandomValues(a);
  crypto.getRandomValues(b);
  const mix = concatBytes(
    a,
    b,
    (address || '').toLowerCase(),
    String(Date.now()),
    String(typeof performance !== 'undefined' ? performance.now() : 0),
    extra,
    typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : ''
  );
  return sha256(mix);
}

/**
 * Unbiased integer in [0, n).
 * Rejection sampling against 2^32 so x % n is uniform.
 */
export async function uniformInt(seed, label, n, drawIndex) {
  if (!Number.isInteger(n) || n <= 0) throw new Error('rng: bad n');
  const span = 0x100000000;
  const limit = Math.floor(span / n) * n;
  for (let c = 0; c < 64; c++) {
    const block = await hmacSha256(
      seed,
      concatBytes('HILO.u32.v1', label, u32be(drawIndex), u32be(c))
    );
    const x = new DataView(block.buffer, block.byteOffset, 4).getUint32(0, false);
    if (x < limit) return x % n;
  }
  throw new Error('rng: rejection sampling exhausted');
}

export function cardFromIndex(i) {
  const idx = i % 52;
  return {
    id: idx,
    rank: RANKS[idx % 13],
    suit: SUITS[Math.floor(idx / 13)]
  };
}

export async function shuffleDeck(seed) {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i >= 1; i--) {
    const j = await uniformInt(seed, 'fy.v1', i + 1, i);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck.map(cardFromIndex);
}

export async function commitSeed(seed) {
  return bytesToHex(await sha256(concatBytes('HILO.commit.v1', seed)));
}

export async function verifyCommitment(seed, commitment) {
  return (await commitSeed(seed)) === commitment;
}

export async function verifyDeck(seed, deck) {
  const rebuilt = await shuffleDeck(seed);
  if (rebuilt.length !== deck.length) return false;
  return rebuilt.every((c, i) => c.id === deck[i].id);
}

export function rankIdx(rank) {
  return RANKS.indexOf(rank);
}

export function checkGuess(prev, next, higher) {
  const a = rankIdx(prev?.rank);
  const b = rankIdx(next?.rank);
  if (a < 0 || b < 0) return { ok: false, won: false, reason: 'invalid-rank' };
  if (prev.id === next.id) return { ok: false, won: false, reason: 'duplicate-card' };
  const won = higher ? b > a : b < a;
  return {
    ok: true,
    won,
    reason: won ? (higher ? 'higher' : 'lower') : b === a ? 'tie' : 'miss'
  };
}

export async function openRound({ address = '' } = {}) {
  const seed = await harvestSeed({ address, extra: 'open-round' });
  const commitment = await commitSeed(seed);
  const deck = await shuffleDeck(seed);
  const deckOk = await verifyDeck(seed, deck);
  const commitOk = await verifyCommitment(seed, commitment);
  if (!deckOk || !commitOk) throw new Error('rng self-check failed');
  return { seed, commitment, deck, index: 0, verified: true };
}

export function countAbove(rank) {
  return (RANKS.length - 1 - rankIdx(rank)) * 4;
}

export function countBelow(rank) {
  return rankIdx(rank) * 4;
}
