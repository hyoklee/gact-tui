import { layoutKnowledgeGraph, type KnowledgeGraphLayout } from './knowledge-graph-layout';

self.onmessage = (event: MessageEvent<KnowledgeGraphLayout>) => {
  try {
    self.postMessage({ graph: layoutKnowledgeGraph(event.data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Graph layout failed' });
  }
};
