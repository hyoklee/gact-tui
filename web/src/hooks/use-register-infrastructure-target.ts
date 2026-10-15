import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SshHost } from '@/lib/ssh-hosts';
import { useConnectionSettings } from '@/providers/connection-provider';
import { attachInfrastructureSshTransport } from '@/tauri/ssh-infrastructure-transport';
import {
  sshTargetDefinition,
  targetMatchesHost,
} from '@/components/clio/managed-service-target-utils';
import { useRepository } from './use-repository';

/** Add or reconnect a computer through the same Desktop transport from every view. */
export function useRegisterInfrastructureTarget() {
  const repository = useRepository();
  const client = useQueryClient();
  const { settings } = useConnectionSettings();
  return useMutation({
    mutationFn: async (host: SshHost) => {
      const definition = sshTargetDefinition({ ...host, platform: host.platform ?? 'auto' });
      // Refresh before writing: an unopened/stale inventory must not create a duplicate host.
      const known = await repository.infrastructureTargets();
      const existing = known.find((candidate) => targetMatchesHost(candidate, host));
      // Selecting an imported SSH profile must not erase an existing installation root.
      if (existing && host.installRoot === undefined)
        definition.install_root = existing.install_root;
      const registered = existing
        ? await repository.updateInfrastructureTarget(existing.id, definition)
        : await repository.createInfrastructureTarget(definition);
      const status = await attachInfrastructureSshTransport(
        settings.endpoint,
        settings.token,
        registered,
      );
      await repository.setInfrastructureTransportState(registered.id, status.state);
      return { registered, status };
    },
    onSuccess: async ({ registered }) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['infrastructure-targets', settings.endpoint] }),
        client.invalidateQueries({ queryKey: ['infrastructure-inventory', settings.endpoint] }),
        client.invalidateQueries({
          queryKey: ['managed-service-catalog', settings.endpoint, registered.id],
        }),
      ]);
    },
  });
}
