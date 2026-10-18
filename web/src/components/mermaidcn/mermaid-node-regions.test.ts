import { describe, expect, it } from 'vitest';
import { mermaidNodeRegions } from './mermaid-node-regions';

describe('mermaidNodeRegions', () => {
  it('uses Pele semantic IDs and parent translations, independent of metadata order', () => {
    const svg =
      '<svg viewBox="0 0 300 90"><g transform="translate(8,10)"><g class="pele-node pele-shape-rect" data-id="results" transform="translate(150,30)"><rect x="-40" y="-20" width="80" height="40" /></g><g class="pele-node" data-id="raw" transform="translate(50,30)"><rect x="-40" y="-20" width="80" height="40" /></g></g></svg>';
    expect(mermaidNodeRegions(svg, [{ id: 'raw' }, { id: 'results' }])).toEqual([
      { id: 'results', x: 118, y: 20, width: 80, height: 40 },
      { id: 'raw', x: 18, y: 20, width: 80, height: 40 },
    ]);
  });
  it('maps rendered workflow rectangles to the producer node IDs', () => {
    const svg =
      '<svg viewBox="0 0 200 80"><g class="node default" id="mermaid-abc-flowchart-node0-0" transform="translate(55, 30)"><rect class="label-container" x="-45" y="-20" width="90" height="40" /></g><g class="node default" id="mermaid-abc-flowchart-node1-1" transform="translate(150, 30)"><rect class="label-container" x="-40" y="-20" width="80" height="40" /></g></svg>';
    expect(mermaidNodeRegions(svg, [{ id: 'collect' }, { id: 'review' }])).toEqual([
      { id: 'collect', x: 10, y: 10, width: 90, height: 40 },
      { id: 'review', x: 110, y: 10, width: 80, height: 40 },
    ]);
  });

  it('ignores a node without a valid rectangle', () => {
    expect(
      mermaidNodeRegions('<svg><g class="node" id="flowchart-node0-0" /></svg>', [{ id: 'a' }]),
    ).toEqual([]);
  });
});
