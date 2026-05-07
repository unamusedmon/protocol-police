import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getRankProgress } from './progression';
import { RANKS } from './ranks';

// Mock the DB and queries
vi.mock('./db', () => ({
  db: {
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      get: vi.fn()
    })
  },
  queries: {
    getRank: {
      get: vi.fn()
    },
    getUnlocks: {
      all: vi.fn()
    }
  }
}));

import { queries } from './db';

describe('Rank Progression Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return initial rank for new users', () => {
    (queries.getRank.get as any).mockReturnValue(undefined);

    const progress = getRankProgress(1);
    
    expect(progress.rank.id).toBe('PACKET_MONKEY');
    expect(progress.xp).toBe(0);
    expect(progress.nextRank?.id).toBe('FRAME_JOCKEY');
    expect(progress.percentage).toBe(0);
  });

  it('should calculate percentage correctly between ranks', () => {
    (queries.getRank.get as any).mockReturnValue({
      current_rank: 'PACKET_MONKEY',
      xp: 50
    });

    const progress = getRankProgress(1);
    
    // PACKET_MONKEY (0) -> FRAME_JOCKEY (100)
    // XP is 50, so percentage should be 50
    expect(progress.percentage).toBe(50);
  });

  it('should cap percentage at 100 for max rank', () => {
    (queries.getRank.get as any).mockReturnValue({
      current_rank: 'PROTOCOL_WIZARD',
      xp: 5000
    });

    const progress = getRankProgress(1);
    
    expect(progress.nextRank).toBeNull();
    expect(progress.percentage).toBe(100);
  });
});
