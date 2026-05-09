import { describe, it, expect } from 'vitest';
import { XP_GAIN } from './progression';
import { RANKS } from './ranks';

describe('XP_GAIN constants', () => {
  it('should have correct XP values for ratings', () => {
    expect(XP_GAIN.RFC_GOD).toBe(20);
    expect(XP_GAIN.ACCEPTABLE).toBe(10);
    expect(XP_GAIN.SKILL_ISSUE).toBe(5);
    expect(XP_GAIN.BRAIN_ROT).toBe(1);
    expect(XP_GAIN.FRAGMENT).toBe(10);
  });
});

describe('Rank Requirements', () => {
  it('should have all ranks in order', () => {
    expect(RANKS.length).toBeGreaterThan(0);
    expect(RANKS[0].id).toBe('PACKET_MONKEY');
    expect(RANKS[RANKS.length - 1].id).toBe('PROTOCOL_WIZARD');
  });

  it('should have increasing XP thresholds', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].xp_threshold).toBeGreaterThan(RANKS[i - 1].xp_threshold);
    }
  });

  it('should have unique rank IDs', () => {
    const ids = RANKS.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have PROTOCOL_WIZARD as the highest rank', () => {
    const wizardIndex = RANKS.findIndex(r => r.id === 'PROTOCOL_WIZARD');
    expect(wizardIndex).toBe(RANKS.length - 1);
  });

  it('should have PACKET_MONKEY as the starting rank', () => {
    expect(RANKS[0].id).toBe('PACKET_MONKEY');
    expect(RANKS[0].xp_threshold).toBe(0);
  });
});
