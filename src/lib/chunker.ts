export interface ContentChunk {
  title: string;
  level: number;
  content: string;
}

/**
 * Chunks a markdown string based on H2 (##) or H3 (###) headers.
 * Content before the first header is categorized under an "Introduction" chunk.
 */
export function chunkMarkdown(content: string): ContentChunk[] {
  const headerRegex = /^(#{2,3})\s+(.+)$/gm;
  const chunks: ContentChunk[] = [];
  
  let lastIndex = 0;
  let match;
  
  // Track the current header being processed
  let currentTitle = 'Introduction';
  let currentLevel = 1;

  while ((match = headerRegex.exec(content)) !== null) {
    const headerStart = match.index;
    const headerEnd = match.index + match[0].length;

    // Everything from the end of the last header (or start of file) to the start of this header
    const sectionContent = content.substring(lastIndex, headerStart).trim();
    
    if (sectionContent || (chunks.length === 0 && lastIndex === 0)) {
       chunks.push({
         title: currentTitle,
         level: currentLevel,
         content: sectionContent
       });
    }

    // Set up for the next chunk
    currentLevel = match[1].length;
    currentTitle = match[2].trim();
    lastIndex = headerEnd;
  }

  // Add the final section
  const finalContent = content.substring(lastIndex).trim();
  if (finalContent || chunks.length === 0) {
    chunks.push({
      title: currentTitle,
      level: currentLevel,
      content: finalContent
    });
  }

  return chunks;
}
