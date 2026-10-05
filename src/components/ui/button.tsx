import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Tap targets are at least 44px tall in every size except `sm`, which is only
 * used for inline actions that sit beside a larger primary control.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06)] hover:brightness-[1.06]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        outline:
          "border border-border bg-card text-foreground hover:bg-secondary hover:border-primary/30",
        ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
        soft: "bg-primary-soft text-primary hover:brightness-[0.98]",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-[1.06]",
        link: "text-primary underline-offset-4 hover:underline rounded-sm",
      },
      size: {
        sm: "h-9 px-3.5 text-[13px] [&_svg]:size-4",
        default: "h-11 px-5 [&_svg]:size-4",
        lg: "h-12 px-7 text-[15px] [&_svg]:size-[18px]",
        icon: "size-11 [&_svg]:size-[18px]",
        "icon-sm": "size-9 [&_svg]:size-4",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "default", size: "default", block: false },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

function Button({ className, variant, size, block, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
