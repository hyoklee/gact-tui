import type { AttentionSessionAvailability } from '@clio/core/v3';
import { createContext, useContext } from 'react';

export interface SessionAttentionCapability {
  sessionId: string;
  available: boolean;
}

export const AttentionAvailabilityContext = createContext<SessionAttentionCapability | undefined>(
  undefined,
);

/** Offer attention inspection only when the service reports actual captured answers. */
export function hasAttentionCaptures(availability?: AttentionSessionAvailability): boolean {
  return availability?.enabled === true && Object.values(availability.messages).some(Boolean);
}

/** Capability belongs to the active session; an absent or foreign scope stays hidden. */
export function useAttentionAvailable(sessionId: string): boolean {
  const capability = useContext(AttentionAvailabilityContext);
  return capability?.sessionId === sessionId && capability.available;
}
