import { Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "./button";

export interface SubmitButtonProps extends Omit<ButtonProps, "type" | "asChild"> {
  /** A submission is in flight: shows a spinner and blocks double submits. */
  pending: boolean;
  /**
   * The form's submit handler is attached (see `useFormSubmit().isReady`).
   * Until then the button stays disabled, which also blocks the browser's
   * Enter-key submission, so nothing can be sent before the page is ready.
   */
  ready?: boolean;
  /** Label while pending. Defaults to the normal label. */
  pendingLabel?: React.ReactNode;
}

/** The primary button of a form, with the pending and not-yet-ready states built in. */
export function SubmitButton({
  pending,
  ready = true,
  pendingLabel,
  disabled,
  children,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={disabled || pending || !ready} aria-busy={pending || undefined} {...props}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
