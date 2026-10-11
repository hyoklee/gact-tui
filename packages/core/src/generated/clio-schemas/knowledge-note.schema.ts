/**
 * Generated from clio-schemas JSON Schema. Do not edit by hand.
 * Source: knowledge_note.json
 */
import { z } from 'zod';
import type { KnowledgeNote } from './_models.js';

export const knowledgeNoteGeneratedSchema: z.ZodType<KnowledgeNote> = z
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
  .strict();
