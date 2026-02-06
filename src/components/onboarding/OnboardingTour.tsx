import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Zap,
  Save,
  FileCode,
  Eye,
  Bot,
  MessageSquare,
  BarChart3,
  History,
  Settings,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  GraduationCap,
} from "lucide-react";

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  features: string[];
}

const tourSteps: TourStep[] = [
  {
    id: "keysystem",
    title: "Key System Generator",
    description: "Create custom key systems with unlimited keys for your Roblox scripts. Each key is locked to a single Roblox user ID for maximum security.",
    icon: <Zap className="h-8 w-8" />,
    route: "/dashboard",
    features: [
      "Generate unlimited unique keys",
      "Keys are locked to Roblox User IDs",
      "Custom ASCII art branding",
      "Customizable theme colors",
      "Auto-download Lua file",
    ],
  },
  {
    id: "scripts",
    title: "Script Storage",
    description: "Save and manage your Roblox scripts securely in the cloud. Access them from anywhere and download when needed.",
    icon: <Save className="h-8 w-8" />,
    route: "/scripts",
    features: [
      "Cloud-based script storage",
      "Add descriptions to scripts",
      "Download scripts as .lua files",
      "Delete scripts when needed",
      "Secure and private storage",
    ],
  },
  {
    id: "pastebin",
    title: "Pastebin",
    description: "Upload your Lua scripts and get raw links for loadstring execution. Enable protection with whitelist/blacklist control.",
    icon: <FileCode className="h-8 w-8" />,
    route: "/pastebin",
    features: [
      "Upload code and get raw URLs",
      "Enable script protection",
      "Whitelist specific Roblox users",
      "Blacklist unwanted users",
      "Public protection mode (no whitelist needed)",
      "Hide code from raw URL",
    ],
  },
  {
    id: "scriptsettings",
    title: "Script Settings",
    description: "Monitor who accesses your scripts in real-time. See IP addresses, Roblox profiles, and Discord info. Bind scripts to specific games.",
    icon: <Eye className="h-8 w-8" />,
    route: "/script-settings",
    features: [
      "Live access monitoring",
      "View Roblox profiles of executors",
      "Discord OAuth identification",
      "IP tracking (toggle per paste)",
      "Game binding restrictions",
    ],
  },
  {
    id: "ai",
    title: "AI Assistant",
    description: "Get help generating Roblox scripts, fixing code issues, and learning Lua. The AI can also help build websites!",
    icon: <Bot className="h-8 w-8" />,
    route: "/ai-assistant",
    features: [
      "Generate Roblox scripts",
      "Fix code errors",
      "Learn Lua programming",
      "Build websites with AI",
      "Get coding explanations",
    ],
  },
  {
    id: "discord",
    title: "Discord Bot",
    description: "Control everything from Discord! Create key systems, manage pastes, set up buyer panels with key redemption and role assignment.",
    icon: <MessageSquare className="h-8 w-8" />,
    route: "/discord-bot",
    features: [
      "All features via Discord commands",
      "Control panels with buttons",
      "Generate expiring keys",
      "Auto-whitelist on key redemption",
      "Console blacklist management",
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "Track your usage statistics and see how your scripts and key systems are performing over time.",
    icon: <BarChart3 className="h-8 w-8" />,
    route: "/analytics",
    features: [
      "View execution statistics",
      "Track key usage",
      "Monitor paste accesses",
      "Historical data charts",
    ],
  },
  {
    id: "changelog",
    title: "Changelog",
    description: "Stay updated with the latest features and improvements. See what's new and what's been fixed.",
    icon: <History className="h-8 w-8" />,
    route: "/changelog",
    features: [
      "Latest feature updates",
      "Bug fixes and improvements",
      "Version history",
      "Major release highlights",
    ],
  },
  {
    id: "settings",
    title: "Settings",
    description: "Customize your experience with theme colors, neon effects, and language preferences. Manage your account and sessions.",
    icon: <Settings className="h-8 w-8" />,
    route: "/settings",
    features: [
      "Custom text colors (RGB)",
      "Neon glow effects",
      "ULT LUA bold italic style",
      "Color presets",
      "Multi-language support",
      "Session management",
    ],
  },
];

interface OnboardingTourProps {
  onComplete?: () => void;
}

const OnboardingTour = ({ onComplete }: OnboardingTourProps) => {
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkIfNewUser();
  }, []);

  const checkIfNewUser = async () => {
    // Check localStorage first for quick response
    const tourCompleted = localStorage.getItem("onboarding_tour_completed");
    const tourDismissed = localStorage.getItem("onboarding_tour_dismissed");
    
    if (tourCompleted === "true" || tourDismissed === "true") {
      return;
    }

    // Check database for tutorial_completed flag
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Use explicit any to avoid TypeScript deep instantiation issue with Supabase types
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("tutorial_completed")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.tutorial_completed) {
        localStorage.setItem("onboarding_tour_completed", "true");
        return;
      }
    } catch {
      // Ignore errors - show tour if can't fetch
    }

    // Show welcome dialog for new users
    setIsNewUser(true);
    setShowWelcome(true);
  };

  const handleStartTour = () => {
    setShowWelcome(false);
    setShowTour(true);
    setCurrentStep(0);
    navigate(tourSteps[0].route);
  };

  const handleSkipTour = () => {
    setShowWelcome(false);
    localStorage.setItem("onboarding_tour_dismissed", "true");
    markTourComplete();
  };

  const handleNextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      navigate(tourSteps[nextStep].route);
    } else {
      handleCompleteTour();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      navigate(tourSteps[prevStep].route);
    }
  };

  const handleCompleteTour = async () => {
    setShowTour(false);
    localStorage.setItem("onboarding_tour_completed", "true");
    await markTourComplete();
    onComplete?.();
  };

  const markTourComplete = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase as any)
      .from("profiles")
      .update({ tutorial_completed: true })
      .eq("user_id", user.id);
  };

  const handleCloseTour = () => {
    setShowTour(false);
    localStorage.setItem("onboarding_tour_dismissed", "true");
    markTourComplete();
  };

  const currentTourStep = tourSteps[currentStep];
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  if (!isNewUser) return null;

  return (
    <>
      {/* Welcome Dialog */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 rounded-lg bg-primary/20">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              Welcome to ULT LUA Protects!
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              We're glad to have you here! Would you like a quick tour of all the features?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <Card className="p-4 bg-primary/10 border-primary/30">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Interactive Walkthrough</p>
                  <p className="text-sm text-muted-foreground">
                    Learn about all 9 tabs and their features in just a few minutes
                  </p>
                </div>
              </div>
            </Card>
            
            <p className="text-sm text-muted-foreground">
              You can also access help information anytime by expanding the "Help & Setup Guide" 
              dropdown in each tab.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={handleSkipTour} className="flex-1">
              Skip for now
            </Button>
            <Button onClick={handleStartTour} className="flex-1 cyber-glow">
              <GraduationCap className="mr-2 h-4 w-4" />
              Start Tour
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tour Overlay */}
      {showTour && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {/* Tour Card - Fixed at bottom */}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 pointer-events-auto">
            <Card className="p-6 bg-card/95 backdrop-blur-xl border-primary/50 shadow-2xl shadow-primary/20">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20 text-primary">
                    {currentTourStep.icon}
                  </div>
                  <div>
                    <Badge variant="outline" className="mb-1">
                      Step {currentStep + 1} of {tourSteps.length}
                    </Badge>
                    <h3 className="text-xl font-bold">{currentTourStep.title}</h3>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleCloseTour}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Progress Bar */}
              <Progress value={progress} className="h-1 mb-4" />

              {/* Content */}
              <p className="text-muted-foreground mb-4">{currentTourStep.description}</p>

              {/* Features */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                {currentTourStep.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={currentStep === 0}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                
                <Button onClick={handleNextStep} className="cyber-glow">
                  {currentStep === tourSteps.length - 1 ? (
                    <span className="flex items-center">
                      Finish Tour
                      <Sparkles className="ml-2 h-4 w-4" />
                    </span>
                  ) : (
                    <span className="flex items-center">
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </span>
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
};

export default OnboardingTour;
