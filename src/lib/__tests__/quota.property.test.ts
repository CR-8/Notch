/**
 * Property 20: Storage Quota Warning Threshold
 *
 * For any usage value > 9,437,184 bytes (9 * 1024 * 1024), `checkStorageQuota`
 * SHALL emit a STORAGE_QUOTA_WARNING message. For any usage value <= 9,437,184,
 * it SHALL NOT emit the warning.
 *
 * Validates: Requirements 14.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { checkStorageQuota } from '../storage';

const QUOTA_WARNING_THRESHOLD = 9 * 1024 * 1024; // 9,437,184 bytes

// --- Chrome mock ---

const mockGetBytesInUse = vi.fn<() => Promise<number>>();
const mockSendMessage = vi.fn();

global.chrome = {
  storage: {
    local: {
      getBytesInUse: mockGetBytesInUse,
    },
  },
  runtime: {
    sendMessage: mockSendMessage,
  },
} as unknown as typeof chrome;

// --- Tests ---

describe('Property 20: Storage Quota Warning Threshold', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits STORAGE_QUOTA_WARNING for any usage value above the threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: QUOTA_WARNING_THRESHOLD + 1, max: 10_485_760 }),
        async (usage) => {
          vi.clearAllMocks();
          mockGetBytesInUse.mockResolvedValue(usage);

          await checkStorageQuota();

          expect(mockSendMessage).toHaveBeenCalledOnce();
          expect(mockSendMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'STORAGE_QUOTA_WARNING' })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it('does NOT emit STORAGE_QUOTA_WARNING for any usage value at or below the threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: QUOTA_WARNING_THRESHOLD }),
        async (usage) => {
          vi.clearAllMocks();
          mockGetBytesInUse.mockResolvedValue(usage);

          await checkStorageQuota();

          expect(mockSendMessage).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });
});
