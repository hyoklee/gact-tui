import { ChevronDownIcon } from 'lucide-react';
import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
import { IconTile } from '@/components/reui/icon-tile';
import { cn } from '@/lib/utils';
import type { ProviderFamilyNodeData } from './model-picker-model';
import { ProviderEyeToggle } from './provider-eye-toggle';
import { ProviderHeartbeat } from './provider-heartbeat';

/** Inline expansion keeps server choices in the provider column on both layouts. */
export function ProviderFamilyRow({
  data,
  hidden,
  eyeAsStaticElement,
  onToggleVisibility,
}: {
  data: ProviderFamilyNodeData;
  hidden: boolean;
  eyeAsStaticElement: boolean;
  onToggleVisibility?: () => void;
}) {
  return (
    <>
      <IconTile aria-hidden="true" size="sm" variant="outline">
        <ModelSelectorLogo className="size-5" provider="argonne" />
      </IconTile>
      <span className="min-w-0 flex-1 truncate text-start font-medium">{data.group.name}</span>
      {onToggleVisibility ? (
        <ProviderEyeToggle
          asStaticElement={eyeAsStaticElement}
          group={data.group}
          hidden={hidden}
          onToggle={onToggleVisibility}
        />
      ) : null}
      <ProviderHeartbeat group={data.group} />
      <ChevronDownIcon
        aria-hidden="true"
        className={cn(
          'size-4 shrink-0 text-muted-foreground',
          !data.expanded && '-rotate-90 rtl:rotate-90',
        )}
      />
      <span className="sr-only">{data.expanded ? 'Expanded' : 'Collapsed'}</span>
    </>
  );
}
