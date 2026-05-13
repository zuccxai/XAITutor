import { Badge } from "@/components/ui/Badge";

export function TopBar({
  title,
  subtitle,
  status
}: {
  title: string;
  subtitle?: string;
  status?: string;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-borderline bg-white px-5">
      <div>
        <h1 className="text-base font-semibold">{title}</h1>
        {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
      </div>
      {status ? <Badge tone={status === "connected" ? "success" : "neutral"}>{status}</Badge> : null}
    </header>
  );
}
