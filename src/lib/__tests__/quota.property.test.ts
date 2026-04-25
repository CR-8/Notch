/**
 * Property 20: Storage Quota Warning Threshold
 *
 * For any usage/quota pair where usage/quota > 0.9, `checkStorageQuota`
 * SHALL emit a STORAGE_QUOTA_WARNING message.
 * For usage/quota <= 0.9, it SHALL NOT emit the warning.
 *
 * Validates: Requirements 14.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { checkStorageQuota } from '../storage';

const mockSendMessage = vi.fn();

global.chrome = {
  storage: { local: { getBytesInUse: vi.fn(async () => 0) } },
  runtime: { sendMessage: mockSendMessage },
} as unknown as typeof chrome;

describe('Property 20: Storage Quota Warning Threshold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits STORAGE_QUOTA_WARNING when usage > 90% of quota', async () => {
    await fc.assert(
      fc.asyncProperty(
        // quota between 10 MB and 100 MB, usage > 90%
        fc.integer({ min: 10_000_000, max: 100_000_000 }).chain(quota =>
          fc.integer({ min: Math.floor(quota * 0.91), max: quota }).map(usage => ({ usage, quota }))
        ),
        async ({ usage, quota }) => {
          vi.clearAllMocks();
          vi.stubGlobal('navigator', {
            storage: { estimate: vi.fn().mockResolvedValue({ usage, quota }) },
          });

          await checkStorageQuota();

          expect(mockSendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'STORAGE_QUOTA_WARNING' })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does NOT emit STORAGE_QUOTA_WARNING when usage <= 90% of quota', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10_000_000, max: 100_000_000 }).chain(quota =>
          fc.integer({ min: 0, max: Math.floor(quota * 0.9) }).map(usage => ({ usage, quota }))
        ),
        async ({ usage, quota }) => {
          vi.clearAllMocks();
          vi.stubGlobal('navigator', {
            storage: { estimate: vi.fn().mockResolvedValue({ usage, quota }) },
          });

          await checkStorageQuota();

          expect(mockSendMessage).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
