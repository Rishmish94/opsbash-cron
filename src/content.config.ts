import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().max(80),
    description: z.string().max(160),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string(),
    heroImageAlt: z.string(),
    category: z.enum(['How-To', 'Best-Tools', 'Explainer', 'Tutorial', 'News']),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    author: z.string().default('Rishabh'),
    canonicalUrl: z.string().url().optional(),
  }),
});

export const collections = { blog };
