import { cn } from "@/lib/utils";

const riskConfig: Record<string, { label: string; className: string }> = {
  classic: { label: "קלאסי", className: "bg-risk-classic/15 text-risk-classic border-risk-classic/30" },
  needs_attention: { label: "דורש תשומת לב", className: "bg-risk-attention/15 text-risk-attention border-risk-attention/30" },
  report_received: { label: "התקבל דיווח", className: "bg-risk-report/15 text-risk-report border-risk-report/30" },
  needs_treatment: { label: "דורש טיפול", className: "bg-risk-treatment/15 text-risk-treatment border-risk-treatment/30" },
};

export function RiskBadge({ level }: { level: string }) {
  const config = riskConfig[level] || { label: level, className: "" };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border", config.className)}>
      {config.label}
    </span>
  );
}
