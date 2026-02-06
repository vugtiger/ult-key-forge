import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, BookOpen, CheckCircle2, Lightbulb } from "lucide-react";

interface HelpStep {
  title: string;
  description: string;
}

interface HelpTip {
  text: string;
}

interface TabHelpSectionProps {
  title: string;
  description: string;
  steps: HelpStep[];
  tips?: HelpTip[];
  features?: string[];
}

const TabHelpSection = ({
  title,
  description,
  steps,
  tips = [],
  features = [],
}: TabHelpSectionProps) => {
  const [isOpen, setIsOpen] = useState<string | undefined>(undefined);

  return (
    <Card className="border-border/50 bg-card/30 backdrop-blur-sm mb-6">
      <Accordion
        type="single"
        collapsible
        value={isOpen}
        onValueChange={setIsOpen}
      >
        <AccordionItem value="help" className="border-none">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-md bg-primary/20">
                <HelpCircle className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium">Help & Setup Guide</span>
              <Badge variant="outline" className="text-xs">
                {steps.length} steps
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-6 pt-2">
              {/* Description */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <BookOpen className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-medium mb-1">{title}</h4>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              </div>

              {/* Features (if provided) */}
              {features.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-muted-foreground">What you can do here:</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Setup Steps */}
              <div className="space-y-3">
                <h5 className="text-sm font-medium text-muted-foreground">How to use:</h5>
                <div className="space-y-2">
                  {steps.map((step, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                        {index + 1}
                      </div>
                      <div>
                        <h6 className="font-medium text-sm">{step.title}</h6>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tips (if provided) */}
              {tips.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    Pro Tips
                  </h5>
                  <div className="space-y-1.5">
                    {tips.map((tip, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="text-primary">•</span>
                        <span>{tip.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
};

export default TabHelpSection;
