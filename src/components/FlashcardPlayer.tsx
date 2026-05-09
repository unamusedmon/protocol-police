import React, { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Award, ArrowRight, RotateCcw } from 'lucide-react';
import { Rating, type Card, recordReview, createEmptyCard } from '../lib/fsrs';
import flashcardData from '../content/flashcards.json';

interface Flashcard {
  rfc: number;
  id: string;
  question: string;
  answer: string;
}

const typedFlashcards = flashcardData as Flashcard[];

export const FlashcardPlayer: React.FC = () => {
  const [selectedRFC, setSelectedRFC] = useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionCards, setSessionCards] = useState<(Flashcard & { cardState: Card })[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (selectedRFC !== null) {
      // Load card states from LocalStorage or create new ones
      const storedCardsRaw = localStorage.getItem('fsrs_cards');
      const storedCards: Record<string, Card> = storedCardsRaw ? JSON.parse(storedCardsRaw) : {};
      
      const rfcCards = typedFlashcards
        .filter(f => f.rfc === selectedRFC)
        .map(f => ({
          ...f,
          cardState: storedCards[f.id] ? { ...storedCards[f.id], last_review: new Date(storedCards[f.id].last_review) } : createEmptyCard(f.id)
        }));
      
      // Sort: show cards due for review first, then new cards
      const now = new Date();
      const sorted = rfcCards.sort((a, b) => {
        const aDue = new Date(a.cardState.last_review.getTime() + a.cardState.scheduled_days * 24 * 60 * 60 * 1000);
        const bDue = new Date(b.cardState.last_review.getTime() + b.cardState.scheduled_days * 24 * 60 * 60 * 1000);
        return aDue.getTime() - bDue.getTime();
      });

      setSessionCards(sorted);
      setCurrentIndex(0);
      setIsFlipped(false);
    }
  }, [selectedRFC]);

  const handleRate = async (rating: Rating) => {
    const currentFlashcard = sessionCards[currentIndex];
    const updatedCardState = recordReview(currentFlashcard.cardState, rating);
    
    // API Rating Mapping
    const apiRating = {
      [Rating.Again]: 'BRAIN_ROT',
      [Rating.Hard]: 'SKILL_ISSUE',
      [Rating.Good]: 'ACCEPTABLE',
      [Rating.Easy]: 'RFC_GOD'
    }[rating];

    // POST to progress API
    try {
      await fetch('/api/progress/flashcard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: currentFlashcard.id,
          rfcId: `rfc${currentFlashcard.rfc}`,
          rating: apiRating
        })
      });
    } catch (err) {
      console.error("Failed to record progress", err);
    }
    
    // Snarky Feedback: This would ideally be displayed in the UI
    console.log({
      [Rating.Again]: "Total Brain Rot. Have you considered a career in manual routing?",
      [Rating.Hard]: "Skill Issue. It's literally just a packet header.",
      [Rating.Good]: "Acceptable. You've reached the bare minimum requirements.",
      [Rating.Easy]: "RFC God. Go write a new standard or something."
    }[rating]);
    
    // Update local session state
    const newSessionCards = [...sessionCards];
    newSessionCards[currentIndex] = { ...currentFlashcard, cardState: updatedCardState };
    setSessionCards(newSessionCards);

    // ADHD Dopamine Hit: Feedback
    if (rating >= Rating.Good) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1000);
    }

    // Move to next card after a short delay
    setTimeout(() => {
      if (currentIndex < sessionCards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      } else {
        // Session complete
        setCurrentIndex(sessionCards.length);
      }
    }, 600);
  };

  if (selectedRFC === null) {
    return (
      <div className="flex flex-col items-center w-full">
        <div className="flex items-center gap-4 mb-12">
          <div className="h-px w-12 bg-zinc-800"></div>
          <h2 className="text-sm font-black text-white uppercase tracking-[0.4em]">Select an RFC Study Track</h2>
          <div className="h-px w-12 bg-zinc-800"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl">
          {[791, 9293, 8446].map(rfc => (
            <button
              key={rfc}
              onClick={() => setSelectedRFC(rfc)}
              className="group p-10 bg-zinc-900 rounded-[2.5rem] border-2 border-zinc-800 shadow-sm hover:shadow-indigo-900/20 hover:border-indigo-500 transition-all duration-300 text-center"
            >
              <div className="text-4xl font-black text-zinc-800 group-hover:text-indigo-900/30 transition-colors mb-4 uppercase tracking-tighter">RFC</div>
              <div className="text-4xl font-black text-white">#{rfc}</div>
              <div className="mt-6 text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] group-hover:text-indigo-400">
                {rfc === 791 ? 'Internet Protocol' : rfc === 9293 ? 'Transmission Control' : 'Handshake Protocol'}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (currentIndex >= sessionCards.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-12 rounded-3xl shadow-xl border border-slate-100"
        >
          <div className="bg-yellow-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Award className="text-yellow-600" size={40} />
          </div>
          <h2 className="text-3xl font-bold mb-2">Track Complete!</h2>
          <p className="text-slate-500 mb-8">You've reviewed all cards for RFC {selectedRFC}.</p>
          <button
            onClick={() => setSelectedRFC(null)}
            className="flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-slate-800 transition active:scale-95 mx-auto"
          >
            <RotateCcw size={20} /> Start Another Track
          </button>
        </motion.div>
      </div>
    );
  }

  const current = sessionCards[currentIndex];

  return (
    <div className="flex flex-col items-center p-6 max-w-2xl mx-auto w-full">
      {/* Progress Header */}
      <div className="w-full flex justify-between items-center mb-8">
        <button onClick={() => setSelectedRFC(null)} className="text-slate-400 hover:text-slate-600 font-medium flex items-center gap-1">
           Back
        </button>
        <div className="text-slate-400 font-mono text-sm">
          Card {currentIndex + 1} of {sessionCards.length}
        </div>
        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-500" 
            style={{ width: `${((currentIndex + 1) / sessionCards.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Card Display */}
      <div 
        className="relative w-full aspect-[4/3] cursor-pointer perspective-1000"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <AnimatePresence mode="wait">
          <motion.div
          key={currentIndex + (isFlipped ? '-back' : '-front')}
          initial={{ rotateY: isFlipped ? -90 : 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: isFlipped ? 90 : -90, opacity: 0 }}
          transition={{ duration: 0.4 }}
          className={`absolute inset-0 w-full h-full p-12 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center text-center border-4 ${
            isFlipped ? 'bg-zinc-900 border-zinc-800' : 'bg-indigo-600 border-indigo-400'
          }`}
          >
          {isFlipped ? (
            <>
              <div className="text-xs font-black text-indigo-500 uppercase tracking-[0.3em] mb-6">Confession / Answer</div>
              <div className="text-2xl font-bold text-white leading-relaxed">
                {current.answer}
              </div>
            </>
          ) : (
            <>
              <div className="text-xs font-black text-indigo-200 uppercase tracking-[0.3em] mb-6">Interrogation / Question</div>
              <div className="text-3xl font-black text-white leading-tight tracking-tight">
                {current.question}
              </div>
              <div className="mt-12 text-indigo-200 flex items-center gap-2 animate-pulse font-mono text-xs uppercase tracking-widest">
                <RefreshCw size={16} /> Click to Flip Tape
              </div>
            </>
          )}
          </motion.div>        </AnimatePresence>

        {/* Confetti Hit */}
        <AnimatePresence>
          {showConfetti && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1.2 }}
              exit={{ opacity: 0 }}
              className="absolute -top-10 left-1/2 -translate-x-1/2 pointer-events-none"
            >
              <div className="flex gap-2">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ y: [-20, -100], x: [0, (i - 2) * 30], opacity: [1, 0] }}
                    className="w-4 h-4 rounded-full bg-yellow-400"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Rating Controls */}
      <div className="w-full mt-12">
        <AnimatePresence>
          {isFlipped && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="grid grid-cols-4 gap-4"
            >
              <button
                onClick={(e) => { e.stopPropagation(); handleRate(Rating.Again); }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition active:scale-95 border-2 border-transparent hover:border-rose-200"
              >
                <XCircle size={24} />
                <span className="text-[10px] font-black uppercase tracking-tighter">Brain Rot</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleRate(Rating.Hard); }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-amber-50 text-amber-600 hover:bg-amber-100 transition active:scale-95 border-2 border-transparent hover:border-amber-200"
              >
                <AlertCircle size={24} />
                <span className="text-[10px] font-black uppercase tracking-tighter">Skill Issue</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleRate(Rating.Good); }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition active:scale-95 border-2 border-transparent hover:border-indigo-200"
              >
                <CheckCircle size={24} />
                <span className="text-[10px] font-black uppercase tracking-tighter">Acceptable</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleRate(Rating.Easy); }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition active:scale-95 border-2 border-transparent hover:border-emerald-200"
              >
                <Award size={24} />
                <span className="text-[10px] font-black uppercase tracking-tighter">RFC God</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {!isFlipped && (
          <div className="text-center text-slate-400 animate-bounce">
            <ArrowRight className="mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
};
