import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate: {
        TranslateElement: new (
          options: {
            pageLanguage: string;
            includedLanguages?: string;
            layout?: unknown;
            autoDisplay?: boolean;
          },
          elementId: string
        ) => void;
      };
    };
  }
}

const SCRIPT_ID = "google-translate-script";

const GoogleTranslate = () => {
  const [loaded, setLoaded] = useState(false);
  const [showWidget, setShowWidget] = useState(false);

  useEffect(() => {
    // Check if already loaded
    if (document.getElementById(SCRIPT_ID)) {
      setLoaded(true);
      return;
    }

    // Define the callback
    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            autoDisplay: false,
          },
          "google_translate_element"
        );
        setLoaded(true);
      }
    };

    // Load the script
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src =
      "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup handled by browser
    };
  }, []);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setShowWidget(!showWidget)}
        className="relative"
        title="Translate"
      >
        <Globe className="h-5 w-5" />
      </Button>

      {/* Hidden Google Translate widget - shown when button clicked */}
      <div
        id="google_translate_element"
        className={`absolute right-0 top-full mt-2 z-50 bg-card border border-border rounded-lg p-2 shadow-lg ${
          showWidget ? "block" : "hidden"
        }`}
        style={{ minWidth: "200px" }}
      />

      {/* Hide Google Translate branding via CSS */}
      <style>{`
        .goog-te-banner-frame { display: none !important; }
        body { top: 0 !important; }
        .goog-te-gadget { font-family: inherit !important; }
        .goog-te-gadget-simple { 
          background-color: transparent !important;
          border: none !important;
          padding: 0 !important;
        }
        .goog-te-gadget-simple .goog-te-menu-value {
          color: inherit !important;
        }
        .goog-te-gadget-simple .goog-te-menu-value span {
          color: inherit !important;
        }
        .goog-te-menu-frame { box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important; }
        .skiptranslate { display: none !important; }
        #goog-gt-tt { display: none !important; }
        .goog-te-spinner-pos { display: none !important; }
      `}</style>
    </div>
  );
};

export default GoogleTranslate;
