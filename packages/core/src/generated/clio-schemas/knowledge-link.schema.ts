/**
 * Generated from clio-schemas JSON Schema. Do not edit by hand.
 * Source: knowledge_link.json
 */
import { z } from 'zod';
import type { KnowledgeLink } from './_models.js';

export const knowledgeLinkGeneratedSchema: z.ZodType<KnowledgeLink> = z
  .object({
    candidates: z.array(z.string()).optional(),
    kind: z.enum(['link', 'embed']).default('link'),
    selector: z.string().default(''),
    source: z.string(),
    status: z.enum(['resolved', 'unresolved', 'ambiguous', 'external']).default('resolved'),
    target: z.string(),
  })
  .strict();
