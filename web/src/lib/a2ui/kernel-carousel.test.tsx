import { Catalog, MessageProcessor, type A2uiMessage } from '@a2ui/web_core/v0_9';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { A2uiSurface, KERNEL_COMPONENTS, KERNEL_FUNCTIONS } from './kernel-catalog';

// This suite checks child lifecycle and kernel wiring. The shared media suite
// separately exercises authenticated byte resolution, errors and real controls.
vi.mock('@/components/clio/a2ui-media', () => ({
  A2uiMedia: ({ kind, label, url }: { kind: string; label?: string; url: string }) => (
    <div data-testid={`media-${kind}`} data-url={url}>
      {label}
    </div>
  ),
}));

afterEach(cleanup);

function guide(activeChild?: unknown) {
  const catalog = new Catalog(
    'test://carousel',
    [...KERNEL_COMPONENTS.values()],
    [...KERNEL_FUNCTIONS.values()],
  );
  const processor = new MessageProcessor([catalog], async () => undefined, { version: 'v0.9.1' });
  processor.processMessages([
    { version: 'v0.9.1', createSurface: { surfaceId: 'guide', catalogId: catalog.id } },
    { version: 'v0.9.1', updateDataModel: { surfaceId: 'guide', path: '/slide', value: 'first' } },
    { version: 'v0.9.1', updateDataModel: { surfaceId: 'guide', path: '/note', value: '' } },
    {
      version: 'v0.9.1',
      updateComponents: {
        surfaceId: 'guide',
        components: [
          {
            id: 'root',
            component: 'Carousel',
            children: ['first', 'second', 'third'],
            ...(activeChild === undefined ? {} : { activeChild }),
            accessibility: { label: 'Visual guide' },
          },
          { id: 'first', component: 'Column', children: ['picture', 'caption'] },
          {
            id: 'picture',
            component: 'Image',
            url: 'artifact://artifact_image',
            description: 'Find a message',
            fit: 'contain',
          },
          { id: 'caption', component: 'Text', text: 'Open the source message.' },
          { id: 'second', component: 'TextField', label: 'Your note', value: { path: '/note' } },
          {
            id: 'third',
            component: 'Video',
            url: 'artifact://artifact_video',
            accessibility: { label: 'Export the conversation' },
          },
        ],
      },
    },
  ] as A2uiMessage[]);
  const surface = processor.model.getSurface('guide');
  if (!surface) throw new Error('Missing guide surface');
  render(<A2uiSurface surface={surface} />);
  return processor;
}

describe('Carousel kernel composition', () => {
  it('navigates captioned images and video without mounting hidden children', async () => {
    const user = userEvent.setup();
    guide();
    expect(screen.getByText('1 of 3')).toBeVisible();
    expect(screen.getByTestId('media-image')).toHaveAttribute(
      'data-url',
      'artifact://artifact_image',
    );
    expect(screen.getByText('Open the source message.')).toBeVisible();
    expect(screen.queryByTestId('media-video')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByRole('textbox', { name: 'Your note' })).toBeVisible();
    expect(screen.queryByTestId('media-image')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByTestId('media-video')).toHaveAttribute(
      'data-url',
      'artifact://artifact_video',
    );
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(screen.queryByTestId('media-video')).not.toBeInTheDocument();
  });

  it('honors agent-driven bound navigation and reports an unavailable child', async () => {
    const processor = guide({ path: '/slide' });
    act(() =>
      processor.processMessages([
        {
          version: 'v0.9.1',
          updateDataModel: { surfaceId: 'guide', path: '/slide', value: 'third' },
        },
      ] as A2uiMessage[]),
    );
    expect(await screen.findByTestId('media-video')).toBeVisible();
    act(() =>
      processor.processMessages([
        {
          version: 'v0.9.1',
          updateDataModel: { surfaceId: 'guide', path: '/slide', value: 'missing' },
        },
      ] as A2uiMessage[]),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The selected slide is unavailable.',
    );
  });

  it('uses arrows on the carousel without stealing them from editable content', async () => {
    guide();
    const carousel = screen.getByRole('region', { name: 'Visual guide' });
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });
    const input = await screen.findByRole('textbox', { name: 'Your note' });
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(screen.getByText('2 of 3')).toBeVisible();
    expect(screen.queryByTestId('media-video')).not.toBeInTheDocument();
    fireEvent.keyDown(carousel, { key: 'ArrowRight' });
    expect(await screen.findByTestId('media-video')).toBeVisible();
  });
});
