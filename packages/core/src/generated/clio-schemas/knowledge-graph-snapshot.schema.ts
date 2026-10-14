/**
 * Generated from clio-schemas JSON Schema. Do not edit by hand.
 * Source: knowledge_graph_snapshot.json
 */
import { z } from 'zod';
import type { KnowledgeGraphSnapshot } from './_models.js';

export const knowledgeGraphSnapshotGeneratedSchema: z.ZodType<KnowledgeGraphSnapshot> = z
  .object({
    links: z
      .array(
        z
          .object({
            candidates: z.array(z.string()).optional(),
            kind: z.enum(['link', 'embed']).default('link'),
            selector: z.string().default(''),
            source: z.string(),
            status: z.enum(['resolved', 'unresolved', 'ambiguous', 'external']).default('resolved'),
            target: z.string(),
          })
          .strict(),
      )
      .max(20000),
    next_offset: z.union([z.number().int(), z.null()]).default(null),
    notes: z
      .array(
        z
          .object({
            aliases: z.array(z.string()).optional(),
            blocks: z.array(z.string()).optional(),
            excerpt: z.string().default(''),
            headings: z.array(z.string()).optional(),
            kind: z.enum(['note', 'attachment']).default('note'),
            path: z.string().min(1),
            revision: z.string(),
            tags: z.array(z.string()).optional(),
            title: z.string(),
          })
          .strict(),
      )
      .max(5000),
    offset: z.number().int().gte(0).default(0),
    relationships_truncated: z.boolean().default(false),
    revision: z.string(),
    source_id: z.string(),
    state: z.enum(['ready', 'indexing', 'failed']).default('ready'),
    total: z.number().int().gte(0),
    truncated: z.boolean().default(false),
    warnings: z.array(z.string()).optional(),
  })
  .strict();
