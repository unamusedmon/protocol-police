import React from 'react';

interface SanitizedHTMLProps {
  html: string;
  className?: string;
}

/**
 * Component that safely renders pre-sanitized HTML.
 * Note: HTML should be sanitized server-side before being passed to this component.
 * This component uses dangerouslySetInnerHTML but relies on server-side sanitization.
 */
export const SanitizedHTML: React.FC<SanitizedHTMLProps> = ({ html, className }) => {
  // HTML is already sanitized server-side in [slug].astro
  // No client-side sanitization needed for this use case
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

// Export a simpler version for cases where we just need to render sanitized HTML
export default SanitizedHTML;
