import { useEffect, useState } from "react";

const KeySystemPreview = () => {
  const [keyInput, setKeyInput] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [status, setStatus] = useState<"idle" | "typing" | "verifying" | "loaded">("idle");
  const [progress, setProgress] = useState(0);
  const [logLines, setLogLines] = useState<string[]>(["> waiting for key input"]);

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
      setProgress(0);
      setLogLines(["> awaiting executor handshake"]);

      queueTimeout(() => {
        setStatus("typing");
        const key = "X8K3F";
        let i = 0;

        const typeInterval = window.setInterval(() => {
          if (i < key.length) {
            setKeyInput(key.substring(0, i + 1));
            i++;
          } else {
            clearInterval(typeInterval);

            queueTimeout(() => {
              setStatus("verifying");
              setLogLines([
                "> key accepted",
                "> verifying secure route",
                "> fetching protected payload",
              ]);

              let value = 0;
              const progressInterval = window.setInterval(() => {
                value += 10;
                setProgress(Math.min(value, 100));

                if (value >= 40) {
                  setLogLines([
                    "> key accepted",
                    "> secure route verified",
                    "> streaming payload to executor",
                  ]);
                }

                if (value >= 100) {
                  clearInterval(progressInterval);
                  setStatus("loaded");
                  setLogLines([
                    "> key accepted",
                    "> secure route verified",
                    "> payload synced instantly",
                    "> console: load complete",
                  ]);
                  queueTimeout(demoLoop, 2600);
                }
              }, 90);

              intervals.push(progressInterval);
            }, 250);
          }
        }, 85);

        intervals.push(typeInterval);
      }, 800);
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
    <div className="relative w-full max-w-[760px] mx-auto px-2">
      <div className="relative overflow-hidden rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl">

        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-primary/70" />
            <span className="h-3 w-3 rounded-full bg-foreground/20" />
            <span className="h-3 w-3 rounded-full bg-foreground/10" />
          </div>
          <div className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">
            Ult Loader v6.1
          </div>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-[1.15fr_0.85fr] md:p-7">
          <div className="space-y-5 rounded-[1.5rem] border border-border/60 bg-background/55 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-primary">Instant delivery</p>
                <h3 className="mt-2 text-2xl font-black tracking-[0.18em] text-foreground">ULT CLOUD</h3>
              </div>
              <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-primary">
                {status === "loaded" ? "Synced" : status === "verifying" ? "Loading" : "Ready"}
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-primary/20 bg-primary/10 px-4 py-4 font-mono text-base text-foreground sm:text-lg">
              <span className="text-muted-foreground">Enter your key {'>'} </span>
              <span>{keyInput}</span>
              {(status === "idle" || status === "typing") && (
                <span className={`ml-1 ${showCursor ? "opacity-100" : "opacity-0"}`}>|</span>
              )}
              {status === "verifying" && <span className="ml-2 text-primary">-- verifying...</span>}
              {status === "loaded" && <span className="ml-2 text-primary">-- script loaded instantly</span>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-muted-foreground">
                <span>Animated verification progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary/60 via-primary to-foreground/90 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Response", value: "0.2s" },
                { label: "Payload", value: "Encrypted" },
                { label: "Console", value: "Live" },
              ].map((item) => (
                <div key={item.label} className="rounded-[1rem] border border-border/50 bg-card/70 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-border/60 bg-secondary/70 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Console feedback</p>
              <div className="rounded-full border border-primary/30 bg-background/60 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-primary">
                secure route
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs sm:text-sm">
              {logLines.map((line, index) => (
                <div key={`${line}-${index}`} className="rounded-[1rem] border border-border/50 bg-background/50 px-4 py-3 text-foreground/90">
                  {line}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1rem] border border-dashed border-primary/25 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
              As soon as the URL is executed, the protected code resolves fast, the console updates live, and the loader finishes without dead wait time.
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground mt-4">
        Live preview of the faster loader flow your users see before the protected script is delivered.
      </p>
    </div>
  );
};

export default KeySystemPreview;
