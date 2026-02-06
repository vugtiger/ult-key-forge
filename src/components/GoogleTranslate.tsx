import { useEffect } from "react";

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
}

const GoogleTranslate = ({ className = "" }: GoogleTranslateProps) => {
  useEffect(() => {
    // Check if already initialized
    if (document.getElementById("google-translate-script")) {
      return;
    }

    // Add Google Translate script
    const script = document.createElement("script");
    script.id = "google-translate-script";
    script.src =
      "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);

    // Initialize the translate widget
    window.googleTranslateElementInit = () => {
      if (window.google?.translate) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: "en",
            autoDisplay: false,
            layout: 1, // SIMPLE layout
          },
          "google_translate_element"
        );
      }
    };

    return () => {
      // Cleanup
      delete window.googleTranslateElementInit;
    };
  }, []);

  return (
    <div className={className}>
      <div
        id="google_translate_element"
        className="google-translate-container"
      />
      <style>{`
        .google-translate-container {
          display: inline-block;
        }
        .goog-te-gadget {
          font-family: inherit !important;
          font-size: 0 !important;
        }
        .goog-te-gadget > span {
          display: none !important;
        }
        .goog-te-gadget .goog-te-combo {
          padding: 6px 12px;
          border: 1px solid hsl(var(--border));
          border-radius: 6px;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          font-size: 14px;
          cursor: pointer;
          outline: none;
          transition: border-color 0.2s;
        }
        .goog-te-gadget .goog-te-combo:hover {
          border-color: hsl(var(--primary));
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
      `}</style>
    </div>
  );
};

export default GoogleTranslate;
