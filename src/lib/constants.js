export const ENTRY_USD = 20;
export const ENTRY_HILO = 1;
export const PEG_USD = 20;
export const START_POINTS = 20;
export const POINT_DELTA = 3;
export const TENTH_HILO = 10n ** 17n; // 3 points = 0.1 HILO

export function pointsToHiloWei(points) {
  const n = Number(points);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  return (BigInt(n) * TENTH_HILO) / 3n;
}
export const DECISION_SECS = 20;
export const FEE_ADDRESS = '0x974aB06E37dfD2d27FAc09c0E6194d2E13042DcC';
export const HILO_CA = '0x19E1BE6480364b81ec0B6E5919c2EfaBe55ABE54';
export const VAULT_CA = '0xF16d0fFF51DeFfB3A2c3542661183d4A06c7f5Be';
export const ONE_HILO = 10n ** 18n;
export const FEE_HILO = (ONE_HILO * 20n) / 100n;
export const VAULTED_HILO = ONE_HILO - FEE_HILO;

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = [
  { sym: '♠', color: 'black' },
  { sym: '♥', color: 'red' },
  { sym: '♦', color: 'red' },
  { sym: '♣', color: 'black' }
];

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  }
];

export const VAULT_ABI = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'lose',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    type: 'function',
    name: 'tokenBalance',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'tokenReserve',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }]
  }
];
