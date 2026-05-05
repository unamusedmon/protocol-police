export interface Requirement {
  type: 'rfc' | 'scenario' | 'flashcards';
  id?: string;
  condition?: string;
}

export interface Rank {
  id: string;
  title: string;
  description: string;
  requirements: Requirement[];
  unlocks: { id: string; type: 'rfc' | 'scenario' | 'feature' }[];
  xp_threshold: number;
}

export const RANKS: Rank[] = [
  {
    id: 'PACKET_MONKEY',
    title: 'Packet Monkey',
    description: "You barely know a bit from a byte, but we all start somewhere, rookie.",
    requirements: [],
    unlocks: [],
    xp_threshold: 0
  },
  {
    id: 'FRAME_JOCKEY',
    title: 'Frame Jockey',
    description: "You've survived your first header inspection; don't let it go to your head.",
    requirements: [
      { type: 'rfc', id: 'rfc791', condition: 'completed' }
    ],
    unlocks: [
      { id: '001', type: 'scenario' },
      { id: '003', type: 'scenario' }
    ],
    xp_threshold: 100
  },
  {
    id: 'SEGMENT_SCHOLAR',
    title: 'Segment Scholar',
    description: "Transport layer basics grasped; you're starting to understand flow control.",
    requirements: [
      { type: 'rfc', id: 'rfc9293', condition: 'completed' },
      { type: 'scenario', id: '001', condition: 'completed' },
      { type: 'scenario', id: '003', condition: 'completed' }
    ],
    unlocks: [
      { id: 'rfc8446', type: 'rfc' },
      { id: '002', type: 'scenario' }
    ],
    xp_threshold: 300
  },
  {
    id: 'PROTOCOL_ADEPT',
    title: 'Protocol Adept',
    description: "Encryption layer cracked; you can now secure the payload.",
    requirements: [
      { type: 'rfc', id: 'rfc8446', condition: 'completed' },
      { type: 'scenario', id: '002', condition: 'completed' }
    ],
    unlocks: [
      { id: '004', type: 'scenario' },
      { id: '005', type: 'scenario' }
    ],
    xp_threshold: 600
  },
  {
    id: 'THREAT_ANALYST',
    title: 'Threat Analyst',
    description: "You see the attacks before they land; an asset to the Protocol Police.",
    requirements: [
      { type: 'scenario', id: '004', condition: 'completed' },
      { type: 'scenario', id: '005', condition: 'completed' }
    ],
    unlocks: [
      { id: 'advanced_flashcards', type: 'feature' }
    ],
    xp_threshold: 1000
  },
  {
    id: 'RFC_SOVEREIGN',
    title: 'RFC Sovereign',
    description: "The standards are etched into your mind; your recall is flawless.",
    requirements: [
      { type: 'flashcards', condition: 'all_acceptable_or_god' }
    ],
    unlocks: [
      { id: 'custom_scenarios', type: 'feature' }
    ],
    xp_threshold: 1500
  },
  {
    id: 'PROTOCOL_WIZARD',
    title: 'Protocol Wizard',
    description: "You are the living embodiment of the RFCs; a legend in the network.",
    requirements: [
      { type: 'rfc', id: 'rfc791', condition: 'completed' },
      { type: 'rfc', id: 'rfc9293', condition: 'completed' },
      { type: 'rfc', id: 'rfc8446', condition: 'completed' },
      { type: 'scenario', id: '001', condition: 'completed' },
      { type: 'scenario', id: '002', condition: 'completed' },
      { type: 'scenario', id: '003', condition: 'completed' },
      { type: 'scenario', id: '004', condition: 'completed' },
      { type: 'scenario', id: '005', condition: 'completed' },
      { type: 'flashcards', condition: 'all_acceptable_or_god' }
    ],
    unlocks: [
      { id: 'god_mode', type: 'feature' }
    ],
    xp_threshold: 2500
  }
];