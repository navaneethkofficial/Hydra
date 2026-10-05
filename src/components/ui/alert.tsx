import { AlertCircle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

const TONES = {
  error: { className: "bg-destructive-soft text-destructive", Icon: AlertCircle, role: "alert" },
  success: { className: "bg-success-soft text-success", Icon: CheckCircle2, role: "status" },
  info: { className: "bg-primary-soft text-primary", Icon: Info, role: "status" },
} as const;

/**
 * Inline feedback. Always paired with an icon so the meaning does not rest on
 * colour alone, and always announced to assistive technology.
 */
export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: React.ReactNode;
  className?: string;
}) {
  const { className: toneClass, Icon, role } = TONES[tone];

  return (
    <div
      role={role}
      className={cn("flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm", toneClass, className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="text-pretty">{children}</span>
    </div>
  );
}
