import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

type JarvisState = "idle" | "listening" | "processing" | "speaking";

const JarvisVoice = () => {
  const [state, setState] = useState<JarvisState>("idle");
  const [wakeWordActive, setWakeWordActive] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [showPulse, setShowPulse] = useState(false);
  const recognitionRef = useRef<any>(null);
  const wakeRecognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Get the best British male voice available
  const getBritishVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    // Priority order for JARVIS-like voice
    const preferred = [
      "Daniel", "Google UK English Male", "Microsoft George",
      "Microsoft Ryan", "Arthur", "James", "Oliver"
    ];
    for (const name of preferred) {
      const found = voices.find(v => v.name.includes(name));
      if (found) return found;
    }
    // Fallback: any British English voice
    const british = voices.find(v => v.lang === "en-GB" || v.lang === "en_GB");
    if (british) return british;
    // Fallback: any English male-sounding voice
    return voices.find(v => v.lang.startsWith("en")) || voices[0];
  }, []);

  // Speak with JARVIS voice
  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getBritishVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 0.92;
    utterance.pitch = 0.82;
    utterance.volume = 1;

    utterance.onstart = () => setState("speaking");
    utterance.onend = () => {
      setState("idle");
      // Restart wake word listening after speaking
      if (wakeWordActive) startWakeWordListening();
    };
    utterance.onerror = () => setState("idle");
    
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [getBritishVoice, wakeWordActive]);

  // Execute JARVIS action
  const executeAction = useCallback((action: any) => {
    if (!action) return;
    
    switch (action.type) {
      case "navigate":
        if (action.params?.path) {
          navigate(action.params.path);
        }
        break;
      case "toggle_protection":
        if (action.params?.slug) {
          supabase.from('pastes')
            .update({ protection_enabled: action.params.enabled })
            .eq('slug', action.params.slug)
            .then(({ error }) => {
              if (error) console.error('Protection toggle error:', error);
            });
        }
        break;
      case "toggle_tracking":
        if (action.params?.slug) {
          supabase.from('pastes')
            .update({ ip_tracking_enabled: action.params.enabled })
            .eq('slug', action.params.slug)
            .then(({ error }) => {
              if (error) console.error('Tracking toggle error:', error);
            });
        }
        break;
      case "create_paste":
        navigate("/pastebin");
        break;
    }
  }, [navigate]);

  // Send command to JARVIS backend
  const processCommand = useCallback(async (text: string) => {
    setState("processing");
    setLastTranscript(text);
    setShowPulse(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const { data, error } = await supabase.functions.invoke('jarvis-voice', {
        body: { 
          message: text,
          context: { currentPage: location.pathname }
        },
      });

      if (error) throw error;
      
      const speech = data?.speech || "I didn't quite catch that, sir.";
      const action = data?.action || null;

      // Execute action first, then speak
      if (action) executeAction(action);
      speak(speech);
      
    } catch (err: any) {
      console.error('JARVIS error:', err);
      speak("My apologies, sir. I encountered a technical difficulty.");
    }
  }, [location.pathname, executeAction, speak]);

  // Active listening (push-to-talk or after wake word)
  const startActiveListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Not Supported", description: "Speech recognition not available.", variant: "destructive" });
      return;
    }

    // Stop wake word listening while actively listening
    wakeRecognitionRef.current?.stop();

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      processCommand(transcript);
    };

    recognition.onerror = (e: any) => {
      console.error('Recognition error:', e.error);
      setState("idle");
      if (wakeWordActive) startWakeWordListening();
    };

    recognition.onend = () => {
      if (state === "listening") {
        setState("idle");
        if (wakeWordActive) startWakeWordListening();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setState("listening");
    
    // Play a subtle activation sound
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.08;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  }, [processCommand, wakeWordActive, toast, state]);

  // Wake word listening (continuous, low-key)
  const startWakeWordListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try { wakeRecognitionRef.current?.stop(); } catch {}

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        if (transcript.includes("jarvis") || transcript.includes("jarv")) {
          // Stop wake word listening, start active listening
          recognition.stop();
          
          // Check if there's a command after "jarvis"
          const afterJarvis = transcript.split(/jarv(?:is)?/i).pop()?.trim();
          if (afterJarvis && afterJarvis.length > 3 && event.results[i].isFinal) {
            processCommand(afterJarvis);
          } else {
            // Just heard the wake word, start listening for command
            speak("Yes, sir?");
            setTimeout(() => startActiveListening(), 800);
          }
          return;
        }
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.error('Wake word error:', e.error);
      }
    };

    recognition.onend = () => {
      // Restart if still in wake word mode
      if (wakeWordActive) {
        setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 100);
      }
    };

    wakeRecognitionRef.current = recognition;
    try { recognition.start(); } catch {}
  }, [wakeWordActive, processCommand, speak, startActiveListening]);

  // Toggle wake word
  const toggleWakeWord = useCallback(() => {
    if (wakeWordActive) {
      setWakeWordActive(false);
      try { wakeRecognitionRef.current?.stop(); } catch {}
      toast({ title: "JARVIS wake word disabled" });
    } else {
      setWakeWordActive(true);
      toast({ title: "JARVIS listening for wake word", description: "Say 'JARVIS' to activate" });
    }
  }, [wakeWordActive, toast]);

  // Start/stop wake word listening when toggled
  useEffect(() => {
    if (wakeWordActive) {
      startWakeWordListening();
    } else {
      try { wakeRecognitionRef.current?.stop(); } catch {}
    }
    return () => {
      try { wakeRecognitionRef.current?.stop(); } catch {}
    };
  }, [wakeWordActive, startWakeWordListening]);

  // Load voices
  useEffect(() => {
    window.speechSynthesis?.getVoices();
    window.speechSynthesis?.addEventListener?.('voiceschanged', () => {
      window.speechSynthesis.getVoices();
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch {}
      try { wakeRecognitionRef.current?.stop(); } catch {}
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Hide pulse after animation
  useEffect(() => {
    if (showPulse) {
      const t = setTimeout(() => setShowPulse(false), 3000);
      return () => clearTimeout(t);
    }
  }, [showPulse]);

  // Push-to-talk handler
  const handleOrbClick = useCallback(() => {
    if (state === "listening") {
      recognitionRef.current?.stop();
      setState("idle");
    } else if (state === "speaking") {
      window.speechSynthesis.cancel();
      setState("idle");
    } else if (state === "idle") {
      startActiveListening();
    }
  }, [state, startActiveListening]);

  const stateColors = {
    idle: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30",
    listening: "from-cyan-400/40 to-blue-500/30 border-cyan-400/60",
    processing: "from-amber-400/30 to-orange-500/20 border-amber-400/50",
    speaking: "from-cyan-400/50 to-blue-400/30 border-cyan-300/70",
  };

  const glowColors = {
    idle: "shadow-cyan-500/10",
    listening: "shadow-cyan-400/40",
    processing: "shadow-amber-400/30",
    speaking: "shadow-cyan-300/50",
  };

  return (
    <>
      {/* Floating JARVIS Orb */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
        {/* Status text */}
        {state !== "idle" && (
          <div className="px-3 py-1.5 rounded-lg bg-background/90 backdrop-blur-xl border border-cyan-500/20 text-[10px] font-mono tracking-widest text-cyan-400/80 uppercase animate-in fade-in slide-in-from-bottom-2 duration-200">
            {state === "listening" ? "Listening..." : state === "processing" ? "Processing..." : "Speaking..."}
          </div>
        )}

        {/* Last transcript */}
        {lastTranscript && showPulse && (
          <div className="px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-xl border border-border/30 text-xs text-muted-foreground max-w-[200px] truncate animate-in fade-in slide-in-from-bottom-2 duration-200">
            "{lastTranscript}"
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Wake word toggle */}
          <button
            onClick={toggleWakeWord}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 text-[10px] font-bold tracking-wider border ${
              wakeWordActive
                ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-400"
                : "bg-background/60 border-border/30 text-muted-foreground/50 hover:text-muted-foreground"
            }`}
            title={wakeWordActive ? "Disable wake word" : "Enable wake word 'JARVIS'"}
          >
            W
          </button>

          {/* Main orb */}
          <button
            onClick={handleOrbClick}
            className={`relative w-14 h-14 rounded-full bg-gradient-to-br ${stateColors[state]} border-2 shadow-lg ${glowColors[state]} transition-all duration-500 hover:scale-105 active:scale-95`}
            title={state === "idle" ? "Click to talk to JARVIS" : state === "listening" ? "Click to cancel" : "JARVIS is active"}
          >
            {/* Outer ring */}
            <div className={`absolute inset-0 rounded-full border border-cyan-400/20 ${
              state === "listening" || state === "speaking" ? "animate-spin" : ""
            }`} style={{ animationDuration: "4s" }} />
            
            {/* Inner ring */}
            <div className={`absolute inset-1 rounded-full border border-cyan-400/15 ${
              state === "speaking" ? "animate-spin" : ""
            }`} style={{ animationDuration: "3s", animationDirection: "reverse" }} />

            {/* Core */}
            <div className={`absolute inset-3 rounded-full bg-gradient-to-br from-cyan-400/30 to-blue-500/20 flex items-center justify-center transition-all duration-300 ${
              state === "listening" ? "from-cyan-400/50 to-blue-400/40" :
              state === "speaking" ? "from-cyan-300/60 to-blue-300/40" :
              state === "processing" ? "from-amber-400/40 to-orange-400/30" : ""
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                state === "idle" ? "bg-cyan-400/60" :
                state === "listening" ? "bg-cyan-300 animate-pulse" :
                state === "processing" ? "bg-amber-400 animate-pulse" :
                "bg-cyan-200 animate-pulse"
              }`} />
            </div>

            {/* Pulse rings */}
            {(state === "listening" || state === "speaking") && (
              <>
                <div className="absolute inset-0 rounded-full border border-cyan-400/20 animate-ping" style={{ animationDuration: "2s" }} />
                <div className="absolute -inset-1 rounded-full border border-cyan-400/10 animate-ping" style={{ animationDuration: "3s" }} />
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default JarvisVoice;
