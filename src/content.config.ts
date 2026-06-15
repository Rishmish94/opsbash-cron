import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: ['*.md', '!_*.md'], base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    date: z.string().default('2026-06-15'),
    image: z.string(),
    category: z.string(),
    tool: z.object({
      name: z.string(),
      url: z.string(),
    }),
  }),
});

export const collections = { blog };
