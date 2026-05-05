import React, { useMemo } from 'react';

interface BionicTextProps {
  text: string;
  enabled: boolean;
}

/**
 * Bionic Reading implementation: bolds the first 40-60% of each word.
 * Based on the psychological principle of providing visual anchors (fixation points).
 */
export const BionicText: React.FC<BionicTextProps> = ({ text, enabled }) => {
  const processedText = useMemo(() => {
    if (!enabled) return text;

    return text.split(' ').map((word, index) => {
      if (word.length <= 3) {
        // For very short words, just bold the first character
        return (
          <span key={index}>
            <span className="bionic-bold">{word.substring(0, 1)}</span>
            {word.substring(1)}{' '}
          </span>
        );
      }

      const mid = Math.ceil(word.length * 0.4);
      return (
        <span key={index}>
          <span className="bionic-bold">{word.substring(0, mid)}</span>
          {word.substring(mid)}{' '}
        </span>
      );
    });
  }, [text, enabled]);

  return <>{processedText}</>;
};
