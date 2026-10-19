import type { SshProfile } from '@/tauri/ssh-profiles';
import type { SshRoute } from '@clio/core/v3';

export type SshHost = {
  id: string;
  label: string;
  profile?: string;
  host?: string;
  user?: string;
  port: number;
  identityFile?: string;
  jumpHosts?: string[];
  platform?: 'auto' | 'linux' | 'windows';
  installRoot?: string;
  managed?: boolean;
};

function cleanOptional(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function validPort(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 65_535
    ? value
    : 22;
}

/** Convert OpenSSH config entries into the same picker model as manual hosts. */
export function profileSshHosts(profiles: readonly SshProfile[]): SshHost[] {
  return profiles.map((profile) => ({
    id: `profile:${profile.name}`,
    label: profile.label || profile.name,
    profile: profile.name,
    host: profile.hostname,
    user: profile.user,
    port: profile.port ?? 22,
    identityFile: profile.identity_file,
    jumpHosts: profile.jump_hosts ?? [],
    platform: profile.platform ?? 'auto',
    installRoot: profile.install_root,
    managed: profile.managed ?? false,
  }));
}

export function sshHostDestination(host: SshHost): string {
  if (host.profile) return host.profile;
  const address = host.host?.includes(':') ? `[${host.host}]` : (host.host ?? '');
  return `${host.user ? `${host.user}@` : ''}${address}${host.port !== 22 ? `:${host.port}` : ''}`;
}

/** Adapt a shared wire route to the editor without losing custom destination fields. */
export function sshRouteHost(route: Partial<SshRoute>, label?: string): SshHost {
  const destination = route.profile || route.host || '';
  return {
    id: route.profile
      ? `profile:${route.profile}`
      : `route:${route.user ?? ''}@${destination}:${route.port ?? 22}`,
    label: label || destination,
    profile: route.profile || undefined,
    host: route.host || undefined,
    user: route.user || undefined,
    port: route.port ?? 22,
    jumpHosts: route.jump_hosts ?? [],
    identityFile: route.identity_file || undefined,
    platform: route.platform ?? 'auto',
  };
}

/** Whether removing a saved alias invalidates this draft's destination or a jump hop. */
export function sshHostUsesProfile(host: SshHost | undefined, profile: string): boolean {
  const name = profile.toLowerCase();
  return Boolean(
    host &&
      [host.profile, ...(host.jumpHosts ?? [])].some(
        (reference) =>
          reference
            ?.replace(/^[^@]+@/u, '')
            .replace(/:\d+$/u, '')
            .toLowerCase() === name,
      ),
  );
}

export function createSavedSshHost(input: {
  host: string;
  identityFile?: string;
  label?: string;
  installRoot?: string;
  port?: number;
  user?: string;
}): SshHost {
  const address = input.host.trim();
  if (!address) throw new Error('Enter the SSH host address.');
  const port = validPort(input.port);
  const user = cleanOptional(input.user);
  const destination = `${user ? `${user}@` : ''}${address}`;
  return {
    id: `manual:${destination}:${port}`,
    label: cleanOptional(input.label) ?? destination,
    host: address,
    user,
    port,
    identityFile: cleanOptional(input.identityFile),
    jumpHosts: [],
    platform: 'auto',
    installRoot: cleanOptional(input.installRoot),
  };
}
