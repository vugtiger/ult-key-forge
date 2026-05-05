import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { playButtonClickSound, createSnowBurst } from "@/components/SnowEffect";

const buttonVariants = cva(
  "btn-3d inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-[1px] active:scale-[0.98] min-w-0 max-w-full overflow-hidden text-ellipsis [&>span]:truncate [&>span]:min-w-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.4),0_4px_12px_-2px_hsl(var(--primary)/0.5)] hover:shadow-[0_0_28px_hsl(var(--primary)/0.6),0_6px_16px_-2px_hsl(var(--primary)/0.6)] hover:-translate-y-0.5",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_0_18px_hsl(var(--destructive)/0.4),0_4px_12px_-2px_hsl(var(--destructive)/0.5)] hover:-translate-y-0.5",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-[0_3px_0_0_hsl(var(--border)),0_4px_12px_-2px_hsl(0_0%_0%/0.3)] hover:-translate-y-0.5",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-[0_3px_0_0_hsl(var(--border)),0_4px_12px_-2px_hsl(0_0%_0%/0.3)] hover:-translate-y-0.5",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
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
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      playButtonClickSound();
      createSnowBurst(e.clientX, e.clientY);
      onClick?.(e);
    };
    
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} onClick={asChild ? onClick : handleClick} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
