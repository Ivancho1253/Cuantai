import { describe, it, expect, vi, afterEach } from 'vitest';
import { readWallet } from '@/lib/portfolio-import/wallet';
import { solanaActivity } from '@/lib/portfolio-import/solana-activity';
const address = '11111111111111111111111111111111';
afterEach(() => vi.unstubAllGlobals());
it('reads Ethereum balances by exact contract, with observed token movements', async () => {
  const hash = '0x' + 'a'.repeat(64),
    wallet = '0x' + '1'.repeat(40);
  const token = {
    address_hash: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    name: 'USD Coin',
    type: 'ERC-20',
    decimals: '6',
  };
  const fetcher = vi.fn(
    async (input: string) =>
      new Response(
        JSON.stringify(
          input.endsWith('/token-balances')
            ? [{ value: '12345000', token }]
            : input.endsWith('/token-transfers')
              ? {
                  items: [
                    {
                      transaction_hash: hash,
                      timestamp: '2026-11-12T12:00:00Z',
                      from: { hash: '0x' + '2'.repeat(40) },
                      to: { hash: wallet },
                      token,
                      total: { value: '12345000', decimals: '6' },
                    },
                  ],
                  next_page_params: null,
                }
              : input.endsWith('/transactions')
                ? { items: [] }
                : { coin_balance: '1000000000000000001' },
        ),
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  const result = await readWallet({ chain: 'ethereum', address: wallet });
  expect(result.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        instrumentId: 'COINGECKO:ethereum:USD',
        quantity: '1.000000000000000001',
      }),
      expect.objectContaining({ instrumentId: 'COINGECKO:usd-coin:USD', quantity: '12.345' }),
    ]),
  );
  expect(result.activity[0]).toMatchObject({ kind: 'received' });
  expect(result.historyComplete).toBe(false);
});
it('does not return a complete snapshot if a balance provider fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 503 })),
  );
  await expect(readWallet({ chain: 'ethereum', address: '0x' + '1'.repeat(40) })).rejects.toThrow();
});
it('reads SPL balances and never treats confirmed signatures as proven buys', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options: RequestInit) => {
      const { method } = JSON.parse(options.body as string);
      return new Response(
        JSON.stringify({
          result:
            method === 'getBalance'
              ? { value: 1234567890 }
              : method === 'getTokenAccountsByOwner'
                ? { value: [] }
                : method === 'getSignaturesForAddress'
                  ? [{ signature: 'example', blockTime: 1794484800, err: null }]
                  : null,
        }),
      );
    }),
  );
  const result = await readWallet({ chain: 'solana', address });
  expect(result.rows[0]).toMatchObject({
    instrumentId: 'COINGECKO:solana:USD',
    quantity: '1.23456789',
  });
  expect(result.activity[0].kind).toBe('transaction');
  expect(result.historyComplete).toBe(false);
});
describe('Solana flow interpretation', () => {
  const mint = 'USDC-mint';
  const tx = {
    meta: {
      err: null,
      fee: 5000,
      preBalances: [2000000000],
      postBalances: [999995000],
      preTokenBalances: [],
      postTokenBalances: [
        { owner: address, mint, uiTokenAmount: { amount: '100000000', decimals: 6 } },
      ],
    },
    transaction: { message: { accountKeys: [{ pubkey: address }] } },
  };
  it('preserves precise token changes and subtracts the network fee from the SOL movement', () => {
    expect(solanaActivity(tx, address)).toMatchObject({
      kind: 'swap',
      changes: expect.arrayContaining([
        { asset: mint, quantity: '100' },
        { asset: 'SOL', quantity: '-1' },
      ]),
      fee: '0.000005',
    });
  });
  it('ignores other owners and failed transactions', () => {
    expect(
      solanaActivity({ ...tx, meta: { ...tx.meta, err: { InstructionError: 1 } } }, address),
    ).toBeNull();
    expect(
      solanaActivity(
        {
          ...tx,
          meta: {
            ...tx.meta,
            postTokenBalances: [
              { owner: 'another', mint, uiTokenAmount: { amount: '100', decimals: 0 } },
            ],
          },
        },
        address,
      )?.changes,
    ).toEqual([{ asset: 'SOL', quantity: '-1' }]);
  });
});
