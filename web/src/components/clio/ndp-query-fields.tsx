import { useState } from 'react';
import { AddIcon, CloseIcon } from '@/lib/icon-vocabulary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { NDPRecord } from './ndp-endpoint-data';

/** Query pairs support service APIs without asking users to author JSON. */
export function NDPQueryFields({
  onChange,
  title = 'Service filters',
}: {
  onChange: (value: NDPRecord) => void;
  title?: string;
}) {
  const [rows, setRows] = useState([{ key: '', value: '' }]);
  const update = (next: typeof rows) => {
    setRows(next);
    onChange(Object.fromEntries(next.filter((row) => row.key).map((row) => [row.key, row.value])));
  };
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{title}</legend>
      {title === 'Service filters' ? (
        <p className="text-xs text-muted-foreground">
          For a station service, use net for network, sta for station, and format=text.
        </p>
      ) : null}
      {rows.map((row, index) => (
        <div key={index} className="flex gap-2">
          <Input
            aria-label={`Filter name ${index + 1}`}
            placeholder="Filter name"
            value={row.key}
            onChange={(event) =>
              update(
                rows.map((item, i) => (i === index ? { ...item, key: event.target.value } : item)),
              )
            }
          />
          <Input
            aria-label={`Filter value ${index + 1}`}
            placeholder="Value"
            value={row.value}
            onChange={(event) =>
              update(
                rows.map((item, i) =>
                  i === index ? { ...item, value: event.target.value } : item,
                ),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove filter ${index + 1}`}
            onClick={() => update(rows.filter((_, i) => i !== index))}
          >
            <CloseIcon />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setRows([...rows, { key: '', value: '' }])}
      >
        <AddIcon /> Add filter
      </Button>
    </fieldset>
  );
}
