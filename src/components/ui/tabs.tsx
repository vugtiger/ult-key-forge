import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-12 items-center justify-center gap-1 rounded-2xl bg-gradient-to-b from-muted/40 to-muted/70 backdrop-blur-2xl p-1.5 text-muted-foreground border border-border/50 shadow-[inset_0_2px_4px_0_hsl(0_0%_0%/0.4),inset_0_-1px_0_0_hsl(var(--foreground)/0.05),0_8px_24px_-8px_hsl(0_0%_0%/0.5)]",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ring-offset-background transition-all duration-200 hover:text-foreground hover:bg-foreground/5 data-[state=active]:bg-gradient-to-b data-[state=active]:from-background data-[state=active]:to-background/80 data-[state=active]:text-foreground data-[state=active]:shadow-[0_3px_0_0_hsl(var(--primary)/0.4),0_6px_16px_-4px_hsl(var(--primary)/0.35),inset_0_1px_0_0_hsl(var(--foreground)/0.12)] data-[state=active]:-translate-y-0.5 data-[state=active]:border data-[state=active]:border-primary/30 active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
