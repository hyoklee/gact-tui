import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { ScienceLogView } from '../../src/components/clio/science-log-tab';
import { studyGraphFixture } from '../fixtures/science-log-graph';

// Render the production component without network stubs. This fixture is not
// used as a presentation screenshot or evidence of an agent's scientific work.
createRoot(document.getElementById('root')!).render(
  <main className="h-dvh bg-background p-4 text-foreground">
    <header className="px-3 pb-2">
      <h1 className="text-lg font-semibold">Science log graph</h1>
      <p className="text-xs text-muted-foreground">Component review with test data</p>
    </header>
    <ScienceLogView study={studyGraphFixture} sessionId="root" />
  </main>,
);
