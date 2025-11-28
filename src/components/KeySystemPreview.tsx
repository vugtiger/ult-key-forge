import { useState, useEffect } from "react";

const KeySystemPreview = () => {
  const [keyInput, setKeyInput] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const [status, setStatus] = useState<"idle" | "typing" | "success" | "error">("idle");
  const [logoOpacity, setLogoOpacity] = useState(1);

  useEffect(() => {
    // Cursor blink
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    // Logo flicker effect
    const flickerTimeout = setTimeout(() => {
      let flickerCount = 0;
      const flickerInterval = setInterval(() => {
        setLogoOpacity(Math.random() * 0.6 + 0.4);
        flickerCount++;
        if (flickerCount > 15) {
          clearInterval(flickerInterval);
          setLogoOpacity(1);
        }
      }, 80);
    }, 500);

    // Demo animation loop
    const demoLoop = () => {
      setStatus("idle");
      setKeyInput("");
      
      setTimeout(() => {
        setStatus("typing");
        const key = "X8K3F";
        let i = 0;
        const typeInterval = setInterval(() => {
          if (i < key.length) {
            setKeyInput(key.substring(0, i + 1));
            i++;
          } else {
            clearInterval(typeInterval);
            setTimeout(() => {
              setStatus("success");
              setTimeout(() => {
                demoLoop();
              }, 3000);
            }, 500);
          }
        }, 200);
      }, 1000);
    };

    const startDemo = setTimeout(demoLoop, 2000);

    return () => {
      clearInterval(cursorInterval);
      clearTimeout(flickerTimeout);
      clearTimeout(startDemo);
    };
  }, []);

  return (
    <div className="relative w-full max-w-[680px] mx-auto">
      {/* Window */}
      <div 
        className="relative bg-[rgb(20,20,20)]/75 rounded-lg overflow-hidden"
        style={{
          boxShadow: `
            0 0 0 2px rgba(255,255,255,0.8),
            0 0 20px rgba(255,255,255,0.3),
            inset 0 0 30px rgba(255,255,255,0.05)
          `
        }}
      >
        {/* Glow outline */}
        <div className="absolute inset-0 rounded-lg pointer-events-none" style={{
          boxShadow: '0 0 15px rgba(255,255,255,0.2)'
        }} />
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* ASCII Logo */}
          <div 
            className="text-white font-mono text-[10px] sm:text-xs leading-tight text-center whitespace-pre transition-opacity duration-100"
            style={{ opacity: logoOpacity }}
          >
{`██╗   ██╗██╗  ████████╗
██║   ██║██║  ╚══██╔══╝
██║   ██║██║     ██║   
██║   ██║██║     ██║   
╚██████╔╝███████╗██║   
 ╚═════╝ ╚══════╝╚═╝   `}
          </div>

          {/* Input Area */}
          <div className="pt-4">
            <div className="flex items-center font-mono text-lg sm:text-xl text-white">
              <span className="opacity-80">Enter your key {">"} </span>
              <span className={status === "success" ? "text-green-500" : status === "error" ? "text-red-500" : ""}>
                {status === "success" ? "Key Accepted! Loading..." : 
                 status === "error" ? "Invalid Key!" : keyInput}
              </span>
              {status !== "success" && status !== "error" && (
                <span className={`ml-0.5 ${showCursor ? 'opacity-100' : 'opacity-0'}`}>|</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className="text-center text-sm text-muted-foreground mt-4">
        Live preview of the key system UI your users will see
      </p>
    </div>
  );
};

export default KeySystemPreview;
