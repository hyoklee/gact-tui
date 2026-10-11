import { z } from 'zod';
import { knowledgeSnapshotGeneratedSchema } from '../generated/clio-schemas/knowledge-snapshot.schema.js';
import { knowledgeNoteGeneratedSchema } from '../generated/clio-schemas/knowledge-note.schema.js';
import { knowledgeLinkGeneratedSchema } from '../generated/clio-schemas/knowledge-link.schema.js';
import { workspaceResourceSchema } from './composer-schemas.js';

export const knowledgeSnapshotSchema = knowledgeSnapshotGeneratedSchema;
export type KnowledgeSnapshot = z.infer<typeof knowledgeSnapshotSchema>;
export type KnowledgeNote = KnowledgeSnapshot['notes'][number];
export const knowledgeOpenSchema = z.object({
  source_id: z.string(),
  note: knowledgeNoteGeneratedSchema,
  text: z.string(),
  properties: z.record(z.unknown()),
  resource: workspaceResourceSchema,
  links: z.array(knowledgeLinkGeneratedSchema).max(2000),
  relationships_truncated: z.boolean().default(false),
  link_revision: z.string(),
  access: z.enum(['read_only', 'publish_later', 'write_through']),
});
export const knowledgeSyncSchema = z.object({
  state: z.enum(['running', 'stopped', 'failed']),
  mode: z.enum(['pull-only', 'bidirectional']),
  connection: z.string(),
  error: z.string().nullable(),
});
