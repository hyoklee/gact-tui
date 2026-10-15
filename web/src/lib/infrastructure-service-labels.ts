import { vocab } from './brand-vocabulary';

/** Product names for the installed services exposed in the inventory. */
export function infrastructureServiceName(id: string): string {
  const names: Record<string, string> = {
    searxng: 'SearXNG',
    web_search: `${vocab.agent} Web Search`,
    relay: `${vocab.agent} Relay`,
    vllm: 'vLLM',
    llama_cpp: 'llama.cpp',
    ollama: 'Ollama',
    flowcept: 'Flowcept',
    cmf: 'HPE CMF',
  };
  return names[id] ?? id.replaceAll('_', ' ');
}
