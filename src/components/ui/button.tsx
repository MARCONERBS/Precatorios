import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-xs font-bold uppercase tracking-widest ring-offset-background transition-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border-2 border-border shadow-card hover:bg-primary/90 hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-card-hover",
        destructive: "bg-destructive text-destructive-foreground border-2 border-border shadow-card hover:bg-destructive/90 hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-card-hover",
        outline: "border-2 border-border bg-background shadow-card hover:bg-accent hover:text-accent-foreground hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-card-hover",
        secondary: "bg-secondary text-secondary-foreground border-2 border-border shadow-card hover:bg-secondary/80 hover:-translate-y-[1px] hover:-translate-x-[1px] hover:shadow-card-hover",
        ghost: "hover:bg-accent hover:text-accent-foreground border-2 border-transparent",
        link: "text-primary underline-offset-4 hover:underline tracking-normal font-medium normal-case",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10 border-2 border-border shadow-card",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
