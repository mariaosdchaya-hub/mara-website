import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Cases = one markdown file per project in src/content/cases/.
 * Add a case: drop a new .md file (or use /admin) — it appears on the site automatically.
 */
const cases = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/cases" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string(),
      tags: z.array(z.string()).default([]),
      cover: image(),
      coverAlt: z.string().default(""),
      link: z.string().default("#"),
      order: z.number().default(100),
      featured: z.boolean().default(true),
      draft: z.boolean().default(false),
    }),
});

export const collections = { cases };
