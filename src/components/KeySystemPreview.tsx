import { useEffect, useState } from "react";

const KeySystemPreview = () => {
  const [keyInput, setKeyInput] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [status, setStatus] = useState<"idle" | "typing" | "validating" | "success" | "resetting">("idle");
  const [statusText, setStatusText] = useState("");

  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);

    const timeouts: number[] = [];
    const intervals: number[] = [];

    const queueTimeout = (callback: () => void, delay: number) => {
      const id = window.setTimeout(callback, delay);
      timeouts.push(id);
    };

    const demoLoop = () => {
      setStatus("idle");
      setKeyInput("");
      setStatusText("");

      queueTimeout(() => {
        setStatus("typing");
        const key = "X8K3F-9mW2q-bR7nL";
        let i = 0;

        const typeInterval = window.setInterval(() => {
          if (i < key.length) {
            setKeyInput(key.substring(0, i + 1));
            i++;
          } else {
            clearInterval(typeInterval);

            queueTimeout(() => {
              setStatus("validating");
              setStatusText("Validating...");

              queueTimeout(() => {
                setStatusText("Connecting to server...");

                queueTimeout(() => {
                  setStatus("success");
                  setStatusText("Key accepted — loading script");

                  queueTimeout(demoLoop, 2600);
                }, 800);
              }, 700);
            }, 400);
          }
        }, 65);

        intervals.push(typeInterval);
      }, 1000);
    };

    const startDemo = window.setTimeout(demoLoop, 1200);
    timeouts.push(startDemo);

    return () => {
      clearInterval(cursorInterval);
      timeouts.forEach((timeout) => clearTimeout(timeout));
      intervals.forEach((interval) => clearInterval(interval));
    };
  }, []);

  return (
    <div className="relative w-full max-w-[480px] mx-auto px-2">
      {/* Glow behind */}
      <div className="absolute inset-4 rounded-2xl bg-primary/15 blur-3xl" />

      {/* Main modal — mimics actual in-game key system */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-[#1a1a1e] shadow-[0_25px_80px_hsl(var(--primary)/0.25)]">

        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <span className="text-sm font-semibold text-white/90 tracking-wide">
            {status === "success" ? "Script Loaded" : "ULT Key System"}
          </span>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-rose-500" />
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Label */}
          <p className="text-xs text-white/40 tracking-wide">Enter your key</p>

          {/* Input field */}
          <div className="rounded-lg bg-black/60 border border-white/[0.06] px-4 py-3.5 font-mono text-sm text-white/80">
            {keyInput ? (
              <span>{keyInput}</span>
            ) : (
              <span className="text-white/20">XXXXX-XXXXX-XXXXX</span>
            )}
            {(status === "idle" || status === "typing") && (
              <span className={`ml-0.5 ${showCursor ? "opacity-100" : "opacity-0"}`}>|</span>
            )}
          </div>

          {/* Validate button */}
          <button
            className={`w-full rounded-lg py-3 text-sm font-semibold transition-all ${
              status === "success"
                ? "bg-emerald-500 text-white"
                : status === "validating"
                ? "bg-white/80 text-black/60"
                : "bg-white text-black hover:bg-white/90"
            }`}
          >
            {status === "validating" ? "Validating..." : status === "success" ? "Validated" : "Validate"}
          </button>

          {/* Status text */}
          {statusText && (
            <p className={`text-xs text-center transition-all ${
              status === "success" ? "text-emerald-400" : "text-white/40"
            }`}>
              {statusText}
            </p>
          )}

          {/* Powered by */}
          <p className="text-[10px] text-white/20 text-right tracking-wider">powered by ULT</p>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Live preview of the key system UI your users see in-game
      </p>
    </div>
  );
};

export default KeySystemPreview;
