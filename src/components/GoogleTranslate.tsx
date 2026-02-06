import { useEffect, useRef } from "react";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate: {
        TranslateElement: new (
          options: {
            pageLanguage: string;
            includedLanguages?: string;
            layout?: number;
            autoDisplay?: boolean;
          },
          elementId: string
        ) => void;
      };
    };
  }
}

interface GoogleTranslateProps {
  className?: string;
  id?: string;
}

const GoogleTranslate = ({ className = "", id = "google_translate_element" }: GoogleTranslateProps) => {
  const initialized = useRef(false);

  useEffect(() => {
    // Only run once
    if (initialized.current) return;
    initialized.current = true;

    // Add Google Translate script if not already added
    if (!document.getElementById("google-translate-script")) {
      const script = document.createElement("script");
      script.id = "google-translate-script";
      script.src =
        "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    }

    // Initialize the translate widget
    window.googleTranslateElementInit = () => {
      // Clear any existing widget
      const element = document.getElementById(id);
      if (element) {
        element.innerHTML = '';
      }
      
      if (window.google?.translate) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            autoDisplay: false,
            layout: 1, // SIMPLE layout - shows dropdown
          },
          id
        );
      }
    };

    // If script already loaded, initialize directly
    if (window.google?.translate) {
      window.googleTranslateElementInit();
    }

    return () => {
      // Don't cleanup on unmount to prevent issues with re-renders
    };
  }, [id]);

  return (
    <div className={className}>
      <div
        id={id}
        className="google-translate-container"
      />
      <style>{`
        .google-translate-container {
          display: inline-block;
          min-width: 120px;
        }
        .goog-te-gadget {
          font-family: inherit !important;
          font-size: 0 !important;
        }
        .goog-te-gadget > span {
          display: none !important;
        }
        .goog-te-gadget .goog-te-combo {
          padding: 8px 12px;
          border: 1px solid hsl(var(--border));
          border-radius: 6px;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-size: 14px;
          cursor: pointer;
          outline: none;
          transition: border-color 0.2s;
          min-width: 120px;
        }
        .goog-te-gadget .goog-te-combo:hover {
          border-color: hsl(var(--primary));
        }
        .goog-te-gadget .goog-te-combo:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);
        }
        .goog-te-banner-frame {
          display: none !important;
        }
        body {
          top: 0 !important;
        }
        .skiptranslate {
          display: none !important;
        }
        .goog-te-spinner-pos {
          display: none !important;
        }
        /* Fix for dropdown options */
        .goog-te-menu-frame {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
          border-radius: 6px !important;
        }
        .goog-te-menu2 {
          background: hsl(var(--background)) !important;
          border: 1px solid hsl(var(--border)) !important;
        }
        .goog-te-menu2-item div, 
        .goog-te-menu2-item:link div, 
        .goog-te-menu2-item:visited div {
          color: hsl(var(--foreground)) !important;
        }
        .goog-te-menu2-item:hover div {
          background: hsl(var(--accent)) !important;
        }
      `}</style>
    </div>
  );
};

export default GoogleTranslate;
