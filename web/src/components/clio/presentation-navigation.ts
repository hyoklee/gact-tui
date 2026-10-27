import { createContext } from 'react';
import type { ClioConversationProps } from './conversation-types';

type Navigation = Pick<
  ClioConversationProps,
  | 'artifacts'
  | 'resources'
  | 'subagents'
  | 'onOpenArtifact'
  | 'onOpenResource'
  | 'onOpenFile'
  | 'onOpenFolder'
  | 'onOpenFileReference'
  | 'onOpenWork'
  | 'onOpenSubagent'
  | 'onOpenFlow'
> &
  Partial<
    Pick<
      ClioConversationProps,
      | 'surfaces'
      | 'tools'
      | 'workspaceId'
      | 'sessionId'
      | 'messages'
      | 'interactions'
      | 'onInteractionResponse'
    >
  > & {
    /**
     * Whether a folder path can be opened here (an export opens only the folders
     * it includes). Without it, every folder opens when `onOpenFolder` is set.
     */
    folderAvailable?: (path: string) => boolean;
    /** The folder a session worked in, in an isolated run, where this surface records it. */
    nodeFolder?: (sessionId: string) => string | undefined;
  };
export const PresentationNavigation = createContext<Navigation | null>(null);
