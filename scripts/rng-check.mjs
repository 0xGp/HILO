import { checkGuess, openRound, rankIdx, verifyCommitment, verifyDeck } from '../src/lib/rng.js';

const round = await openRound({ address: '0x974aB06E37dfD2d27FAc09c0E6194d2E13042DcC' });
if (!(await verifyCommitment(round.seed, round.commitment))) throw new Error('commit');
if (!(await verifyDeck(round.seed, round.deck))) throw new Error('deck');
if (round.deck.length !== 52) throw new Error('len');
const ids = new Set(round.deck.map((c) => c.id));
if (ids.size !== 52) throw new Error('dupes');

const a = round.deck[0];
const b = round.deck[1];
const higher = rankIdx(b.rank) > rankIdx(a.rank);
const v = checkGuess(a, b, true);
if (!v.ok) throw new Error('check');
if (v.won !== higher) throw new Error('higher mismatch');
const v2 = checkGuess(a, b, false);
if (v2.won !== !higher && rankIdx(a.rank) !== rankIdx(b.rank)) {
  /* if tie, both false */
}
if (rankIdx(a.rank) === rankIdx(b.rank) && (v.won || v2.won)) throw new Error('tie should miss');

console.log('rng ok  commit', round.commitment.slice(0, 16), 'first', a.rank + a.suit.sym);
