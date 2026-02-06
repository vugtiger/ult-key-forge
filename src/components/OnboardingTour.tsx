import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step, ACTIONS } from "react-joyride";
import { useLocation } from "react-router-dom";

const TOUR_COMPLETED_KEY = "ult_lua_tour_completed";

const steps: Step[] = [
  {
    target: "body",
    content: (
      <div className="text-center">
        <h3 className="text-lg font-bold mb-2">Welcome to ULT LUA PROTECTS! 🎮</h3>
        <p>Let me give you a quick tour of the platform.</p>
      </div>
    ),
    placement: "center",
    disableBeacon: true,
  },
  {
    target: '[href="/dashboard"]',
    content: (
      <div>
        <h4 className="font-bold mb-1">Key System Generator</h4>
        <p>Create unlimited key systems with custom colors, ASCII art, and user-locked keys.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: '[href="/pastebin"]',
    content: (
      <div>
        <h4 className="font-bold mb-1">Pastebin</h4>
        <p>Upload your Lua scripts and get raw links. Enable protection, whitelisting, and more!</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: '[href="/script-settings"]',
    content: (
      <div>
        <h4 className="font-bold mb-1">Script Settings</h4>
        <p>Monitor who's accessing your scripts in real-time with IP tracking and game bindings.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: '[href="/ai-assistant"]',
    content: (
      <div>
        <h4 className="font-bold mb-1">AI Assistant</h4>
        <p>Get help with Roblox scripting, generate code, and build websites with AI.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: '[href="/discord-bot"]',
    content: (
      <div>
        <h4 className="font-bold mb-1">Discord Bot</h4>
        <p>Control everything from Discord! Create panels, generate keys, and manage whitelists.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: '[href="/settings"]',
    content: (
      <div>
        <h4 className="font-bold mb-1">Settings</h4>
        <p>Customize your text colors, enable neon effects, and manage your account.</p>
      </div>
    ),
    placement: "right",
  },
  {
    target: "body",
    content: (
      <div className="text-center">
        <h3 className="text-lg font-bold mb-2">You're all set! 🚀</h3>
        <p>Join our Discord for support and updates. Happy scripting!</p>
      </div>
    ),
    placement: "center",
  },
];

const OnboardingTour = () => {
  const [run, setRun] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Only show on dashboard routes
    if (!location.pathname.startsWith("/dashboard") && location.pathname !== "/dashboard") {
      return;
    }

    // Check if tour was already completed
    const completed = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!completed) {
      // Show prompt after a short delay
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  const handleStartTour = () => {
    setShowPrompt(false);
    setRun(true);
  };

  const handleSkipTour = () => {
    setShowPrompt(false);
    localStorage.setItem(TOUR_COMPLETED_KEY, "true");
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, action } = data;

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    }

    if (action === ACTIONS.CLOSE) {
      setRun(false);
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    }
  };

  return (
    <>
      {/* Initial prompt */}
      {showPrompt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md text-center shadow-xl">
            <h2 className="text-2xl font-bold mb-2">Welcome to ULT LUA! 👋</h2>
            <p className="text-muted-foreground mb-6">
              Would you like a quick tour of the platform? It only takes a minute.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleSkipTour}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Skip Tour
              </button>
              <button
                onClick={handleStartTour}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Start Tour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Joyride tour */}
      <Joyride
        steps={steps}
        run={run}
        continuous
        showProgress
        showSkipButton
        scrollToFirstStep
        disableOverlayClose
        callback={handleJoyrideCallback}
        styles={{
          options: {
            arrowColor: "hsl(var(--card))",
            backgroundColor: "hsl(var(--card))",
            primaryColor: "hsl(var(--primary))",
            textColor: "hsl(var(--foreground))",
            overlayColor: "rgba(0, 0, 0, 0.7)",
            zIndex: 10001,
          },
          tooltip: {
            borderRadius: 12,
            padding: 16,
          },
          buttonNext: {
            backgroundColor: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
            borderRadius: 8,
            padding: "8px 16px",
          },
          buttonBack: {
            color: "hsl(var(--muted-foreground))",
            marginRight: 8,
          },
          buttonSkip: {
            color: "hsl(var(--muted-foreground))",
          },
        }}
      />
    </>
  );
};

export default OnboardingTour;
