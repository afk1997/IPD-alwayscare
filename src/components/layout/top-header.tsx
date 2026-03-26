import { getSession } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

interface TopHeaderProps {
  title?: string;
}

export async function TopHeader({ title = "Always Care IPD" }: TopHeaderProps) {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-white px-4 shadow-sm">
      <span className="text-base font-semibold text-foreground">{title}</span>

      {session && (
        <div className="flex items-center gap-2">
          <span className="hidden text-sm font-medium text-foreground sm:block">
            {session.name}
          </span>
          <Badge
            className="bg-clinic-teal text-white"
            variant="default"
          >
            {session.role}
          </Badge>
        </div>
      )}
    </header>
  );
}
