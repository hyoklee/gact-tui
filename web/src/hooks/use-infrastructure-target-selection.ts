import type { InfrastructureTarget } from '@clio/core/v3';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SshHost } from '@/lib/ssh-hosts';
import {
  attachInfrastructureSshTransport,
  type SshTransportStatus,
  type SshStateEvent,
} from '@/tauri/ssh-infrastructure-transport';
import { inTauri } from '@/lib/transport/tauri-runtime';
import { useRepository } from './use-repository';
import { useConnectionSettings } from '@/providers/connection-provider';
import { useInfrastructureState } from './use-infrastructure-state';
import { useQueryClient } from '@tanstack/react-query';

/** Services, model files and inspection share one computer within this agent connection. */
export function useInfrastructureTargetSelection(targets: readonly InfrastructureTarget[]) {
  const { settings, isManagedConnection } = useConnectionSettings();
  const repository = useRepository();
  const queryClient = useQueryClient();
  const [connectionError, setConnectionError] = useState<string>();
  const attached = useRef('');
  const [targetId, setTargetId] = useInfrastructureState(settings.endpoint, 'target-id', 'local');
  const [target, setTarget] = useInfrastructureState<'local' | 'ssh'>(
    settings.endpoint,
    'target-kind',
    'local',
  );
  const [sshHost, setSshHost] = useInfrastructureState<SshHost | undefined>(
    settings.endpoint,
    'ssh-host',
    undefined,
  );
  const [transportStatus, setTransportStatus] = useInfrastructureState<
    SshTransportStatus | undefined
  >(settings.endpoint, 'transport', undefined);
  const currentTarget = targets.find((row) => row.id === targetId);
  const attachment = currentTarget
    ? JSON.stringify({ ...currentTarget, transport_state: 'state_unknown', updated_at: '' })
    : '';
  useEffect(() => {
    if (!inTauri() || !isManagedConnection || !attachment) return;
    const selected = JSON.parse(attachment) as InfrastructureTarget;
    if (selected.kind !== 'ssh') return;
    const key = JSON.stringify([settings.endpoint, targetId, selected.ssh]);
    if (attached.current === key) return;
    attached.current = key;
    let active = true;
    void attachInfrastructureSshTransport(settings.endpoint, settings.token, selected)
      .then(async (status) => {
        if (active) {
          setConnectionError(undefined);
          setTransportStatus(status);
        }
        await repository.setInfrastructureTransportState(selected.id, status.state);
        if (active && status.state === 'connected') {
          await queryClient.invalidateQueries({
            queryKey: ['managed-service-catalog', settings.endpoint, selected.id],
          });
        }
      })
      .catch((error: unknown) => {
        if (active) setConnectionError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      active = false;
      attached.current = '';
    };
  }, [
    attachment,
    isManagedConnection,
    repository,
    settings.endpoint,
    settings.token,
    targetId,
    setTransportStatus,
    queryClient,
  ]);
  const sessionId = transportStatus?.session_id;
  useEffect(() => {
    if (!inTauri() || !sessionId) return;
    let active = true;
    let stop: (() => void) | undefined;
    void import('@tauri-apps/api/event').then(async ({ listen }) => {
      const unlisten = await listen<SshStateEvent>('clio:ssh-transport-state', ({ payload }) => {
        if (!active || payload.session_id !== sessionId) return;
        setTransportStatus((current) =>
          current ? { ...current, state: payload.state, prompt: payload.prompt } : current,
        );
        void repository.setInfrastructureTransportState(targetId, payload.state);
        if (payload.state === 'connected' && attachment) {
          const selected = JSON.parse(attachment) as InfrastructureTarget;
          void attachInfrastructureSshTransport(settings.endpoint, settings.token, selected)
            .then((status) => {
              if (active) setTransportStatus(status);
              if (active && status.state === 'connected')
                void queryClient.invalidateQueries({
                  queryKey: ['managed-service-catalog', settings.endpoint, targetId],
                });
            })
            .catch((error: unknown) => {
              if (active)
                setConnectionError(error instanceof Error ? error.message : String(error));
            });
        }
      });
      if (active) stop = unlisten;
      else unlisten();
    });
    return () => {
      active = false;
      stop?.();
    };
  }, [
    sessionId,
    setTransportStatus,
    repository,
    targetId,
    attachment,
    settings.endpoint,
    settings.token,
    queryClient,
  ]);
  const selectTarget = useCallback(
    (id: string) => {
      const selected = targets.find((row) => row.id === id);
      if ((!selected && id !== 'local') || selected?.kind === 'direct') return;
      if (id !== targetId) setTransportStatus(undefined);
      setTargetId(id);
      setTarget(selected?.kind ?? 'local');
      setSshHost(
        selected?.ssh
          ? {
              id: selected.id,
              label: selected.label,
              profile: selected.ssh.profile,
              host: selected.ssh.host,
              user: selected.ssh.user,
              port: selected.ssh.port,
              jumpHosts: selected.ssh.jump_hosts,
              identityFile: selected.ssh.identity_file,
              platform: selected.ssh.platform,
              installRoot: selected.install_root,
            }
          : undefined,
      );
    },
    [targets, targetId, setTargetId, setTarget, setSshHost, setTransportStatus],
  );
  return {
    targetId,
    target,
    sshHost,
    transportStatus,
    connectionError,
    selectTarget,
    setTargetId,
    setTarget,
    setSshHost,
    setTransportStatus,
  };
}
