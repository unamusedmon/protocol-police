export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

export enum State {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

export interface Card {
  id: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  last_review: Date;
  state: State;
}

const STORAGE_KEY = 'fsrs_cards';

// Default v4 parameters (w0 - w16)
const W = [
  0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61
];
const REQUEST_RETENTION = 0.9;

/**
 * Calculate Retrievability (R) using the power function forgetting curve.
 */
function forgettingCurve(t: number, s: number): number {
  return Math.pow(1 + t / (9 * s), -1);
}

/**
 * Calculate the next interval (I) in days.
 */
function nextInterval(s: number): number {
  const interval = s * 9 * (1 / REQUEST_RETENTION - 1);
  return Math.max(1, Math.round(interval));
}

/**
 * Creates a new card with initial values.
 */
export function createEmptyCard(id: string): Card {
  return {
    id,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    last_review: new Date(),
    state: State.New,
  };
}

/**
 * Records a review and updates the card's DSR values using FSRS v4.
 */
export function recordReview(card: Card, rating: Rating): Card {
  const now = new Date();
  let s = card.stability;
  let d = card.difficulty;
  
  // Calculate days since last review
  const lastReviewDate = new Date(card.last_review);
  const t = card.stability === 0 ? 0 : Math.max(0, (now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24));

  if (card.stability === 0) {
    // Initial review (New -> Review/Learning)
    s = W[rating - 1];
    d = W[4] - W[5] * (rating - 3);
  } else {
    // Subsequent reviews
    const r = forgettingCurve(t, s);
    
    // Update Difficulty
    d = d - W[6] * (rating - 3);
    d = Math.min(Math.max(d, 1), 10); // Clamp Difficulty between 1 and 10

    if (rating === Rating.Again) {
      // Failure (Lapse)
      s = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r));
    } else {
      // Success
      const hardPenalty = rating === Rating.Hard ? W[15] : 1;
      const easyBonus = rating === Rating.Easy ? W[16] : 1;
      
      s = s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hardPenalty * easyBonus);
    }
  }

  const updatedCard: Card = {
    ...card,
    stability: s,
    difficulty: d,
    elapsed_days: t,
    scheduled_days: nextInterval(s),
    last_review: now,
    state: rating === Rating.Again ? State.Relearning : State.Review,
  };

  saveToLocalStorage(updatedCard);
  return updatedCard;
}

/**
 * Saves a card to LocalStorage.
 */
function saveToLocalStorage(card: Card) {
  if (typeof window === 'undefined') return;
  const cards = getAllFromLocalStorage();
  cards[card.id] = card;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

/**
 * Safe JSON parse that returns empty object on error
 */
function safeJsonParse<T>(data: string | null, reviver?: (key: string, value: any) => any): T {
  if (!data) return {} as T;
  try {
    return JSON.parse(data, reviver) as T;
  } catch {
    return {} as T;
  }
}

/**
 * Retrieves all cards from LocalStorage.
 */
function getAllFromLocalStorage(): Record<string, Card> {
  if (typeof window === 'undefined') return {};
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return {};
  
  // Restore Date objects safely
  return safeJsonParse<Record<string, Card>>(data, (key, value) => {
    if (key === 'last_review' && typeof value === 'string') {
      return new Date(value);
    }
    return value;
  });
}

/**
 * Returns cards that are due for review.
 */
export function getUpcomingCards(): Card[] {
  const cards = Object.values(getAllFromLocalStorage());
  const now = new Date();
  
  return cards.filter(card => {
    // New cards are always upcoming if they haven't been reviewed
    if (card.stability === 0) return true;
    
    const lastReview = new Date(card.last_review);
    const dueDate = new Date(lastReview.getTime() + card.scheduled_days * 24 * 60 * 60 * 1000);
    return dueDate <= now;
  });
}
