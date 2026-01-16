type PropertyGroup = {
  type: string;
  parameters: PropertyItem[];
};

export type PropertyItem = {
  name: string;
  type: string;
  description?: string;
  isOptional?: boolean;
  deprecated?: boolean;
  defaultValue?: string;
  notes?: string;
  properties?: PropertyGroup[];
};

function PropertyTableInner({
  items,
}: {
  items: PropertyItem[];
}) {
  return (
    <div className="divide-y divide-border/60 rounded-lg border border-border/60 text-sm">
      {items.map((item) => (
        <div key={`${item.name}-${item.type}`} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={[
                'font-medium text-foreground',
                item.deprecated ? 'line-through decoration-muted-foreground/60' : '',
              ].join(' ')}
            >
              {item.name}
              {item.isOptional ? '?' : ''}
              {`:`}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {item.type}
            </span>
            {item.deprecated ? (
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                deprecated
              </span>
            ) : null}
            {item.defaultValue ? (
              <span className="text-xs text-muted-foreground">
                Default: <span className="font-mono">{item.defaultValue}</span>
              </span>
            ) : null}
          </div>
          {item.description ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          ) : null}
          {item.notes ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {item.notes}
            </p>
          ) : null}
          {item.properties?.length ? (
            <div className="mt-3 space-y-3">
              {item.properties.map((group) => (
                <div
                  key={`${item.name}-${group.type}`}
                  className="rounded-md border border-border/60 bg-muted/20 p-3"
                >
                  <div className="mb-2 inline-flex rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {group.type}
                  </div>
                  <PropertyTableInner items={group.parameters} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PropertyTable({ content }: { content: PropertyItem[] }) {
  return (
    <div className="not-prose my-4">
      <PropertyTableInner items={content} />
    </div>
  );
}
