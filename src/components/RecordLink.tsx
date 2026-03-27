import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface RecordLinkProps {
  children: ReactNode;
  className?: string;
  nationalId?: string | null;
  recordId?: string | null;
}

export function RecordLink({ children, className, nationalId, recordId }: RecordLinkProps) {
  const params = new URLSearchParams();

  if (recordId) params.set("record", recordId);
  if (nationalId) params.set("nationalId", nationalId);

  return (
    <Link
      to={`/records?${params.toString()}`}
      className={cn(
        "inline-flex items-center rounded-md text-right font-medium text-primary underline-offset-4 transition-colors hover:text-primary/80 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
    </Link>
  );
}