import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const rfcs = defineCollection({
  // Use the glob loader to load markdown files from src/content/rfcs/
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/rfcs' }),
  schema: z.object({
    title: z.string(),
    number: z.number(),
    description: z.string(),
  }),
});

export const collections = {
  rfcs,
};
