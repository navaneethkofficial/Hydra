import { Button } from "@/components/ui/button";

/** Shown only when the deployment has Google credentials configured. */
export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <Button asChild variant="outline" size="lg" block>
      <a href="/api/auth/google">
        <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
          <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
        </svg>
        {label}
      </a>
    </Button>
  );
}

/** A labelled rule between the OAuth button and the email form. */
export function AuthDivider() {
  return (
    <div className="relative py-1 text-center">
      <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <span className="relative bg-background px-3 text-xs text-muted-foreground">or</span>
    </div>
  );
}
