import { test, expect } from 'bun:test';
import { persistExecutionToken } from './token-issuance';

test('first execution waits for its token before a loader can be returned', async () => {
  let stored = false;
  const issue = persistExecutionToken(async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    stored = true;
    return { error: null };
  }, { token: 'first-execution' });
  expect(stored).toBe(false);
  await issue;
  expect(stored).toBe(true);
});

test('failed token storage cannot produce a loader with an unusable session', async () => {
  await expect(persistExecutionToken(async () => ({ error: new Error('storage unavailable') }), { token: 'invalid' })).rejects.toThrow('Unable to initialise loader session');
});