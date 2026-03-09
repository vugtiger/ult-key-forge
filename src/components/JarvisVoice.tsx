import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

type JarvisState = "idle" | "listening" | "processing" | "speaking";

interface JarvisVoiceProps {
  onTabChange?: (tab: string) => void;
  onRefreshData?: () => void;
}

const JarvisVoice = ({ onTabChange, onRefreshData }: JarvisVoiceProps) => {
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

  const getBritishVoice = useCallback(() => {
    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      "Daniel", "Google UK English Male", "Microsoft George",
      "Microsoft Ryan", "Arthur", "James", "Oliver"
    ];
    for (const name of preferred) {
      const found = voices.find(v => v.name.includes(name));
      if (found) return found;
    }
    const british = voices.find(v => v.lang === "en-GB" || v.lang === "en_GB");
    if (british) return british;
    return voices.find(v => v.lang.startsWith("en")) || voices[0];
  }, []);

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
      if (wakeWordActive) startWakeWordListening();
    };
    utterance.onerror = () => setState("idle");
    
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [getBritishVoice, wakeWordActive]);

  // Call admin-api edge function
  const callAdminApi = useCallback(async (action: string, params: Record<string, any> = {}) => {
    console.log('[JARVIS] Calling admin-api:', action, params);
    const { data, error } = await supabase.functions.invoke('admin-api', {
      body: { action, ...params },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  // Map paths to tab names
  const pathToTab: Record<string, string> = {
    "/analytics": "activity", "/admin": "threats", "/scripts": "pastes", "/settings": "users",
    "analytics": "activity", "activity": "activity", "threats": "threats", "users": "users",
    "pastes": "pastes", "access-logs": "access-logs", "sessions": "sessions",
    "global-bans": "global-bans", "banned-users": "banned-users", "banned-ips": "banned-ips",
    "bans": "global-bans", "logs": "access-logs", "banned-accounts": "banned-accounts",
    "banned accounts": "banned-accounts", "accounts": "banned-accounts",
  };

  // Execute JARVIS action
  const executeAction = useCallback(async (action: any) => {
    if (!action) return;
    
    console.log('[JARVIS] Executing action:', JSON.stringify(action));
    
    try {
      switch (action.type) {
        case "switch_tab":
          if (action.params?.tab && onTabChange) {
            const tab = action.params.tab.toLowerCase();
            const mapped = pathToTab[tab] || tab;
            onTabChange(mapped);
          }
          break;

        case "navigate":
          // Fallback: convert navigation to tab switch
          if (onTabChange && action.params?.path) {
            const path = action.params.path.toLowerCase().replace(/^\//, '');
            const mapped = pathToTab[action.params.path] || pathToTab[path] || path;
            onTabChange(mapped);
          }
          break;

        case "ban_user":
          if (action.params?.target_user_id) {
            await callAdminApi('ban_user', {
              target_user_id: action.params.target_user_id,
              reason: action.params.reason || 'Banned by JARVIS',
            });
            toast({ title: "User banned", description: "JARVIS executed the ban." });
            onRefreshData?.();
          }
          break;

        case "unban_user":
          if (action.params?.target_user_id) {
            await callAdminApi('unban_user', { target_user_id: action.params.target_user_id });
            toast({ title: "User unbanned" });
            onRefreshData?.();
          }
          break;

        case "add_global_ban":
          if (action.params?.ban_type && action.params?.ban_value) {
            await callAdminApi('add_global_ban', {
              ban_type: action.params.ban_type,
              ban_value: action.params.ban_value,
              reason: action.params.reason || 'Banned by JARVIS',
            });
            toast({ title: "Global ban added" });
            onRefreshData?.();
          }
          break;

        case "remove_global_ban":
          if (action.params?.ban_id) {
            await callAdminApi('remove_global_ban', { ban_id: action.params.ban_id });
            toast({ title: "Global ban removed" });
            onRefreshData?.();
          }
          break;

        case "resolve_threat":
          if (action.params?.threat_id) {
            await callAdminApi('resolve_threat', { threat_id: action.params.threat_id });
            toast({ title: "Threat resolved" });
            onRefreshData?.();
          }
          break;

        case "resolve_all_threats":
          // Resolve all threats one by one isn't efficient, use clear_threats to mark all resolved
          await callAdminApi('clear_threats');
          toast({ title: "All threats cleared" });
          onRefreshData?.();
          break;

        case "delete_paste":
          if (action.params?.paste_id) {
            await callAdminApi('delete_paste', { paste_id: action.params.paste_id });
            toast({ title: "Paste deleted" });
            onRefreshData?.();
          }
          break;

        case "delete_user":
          if (action.params?.target_user_id) {
            await callAdminApi('delete_user', { target_user_id: action.params.target_user_id });
            toast({ title: "User deleted" });
            onRefreshData?.();
          }
          break;

        case "toggle_protection":
          if (action.params?.slug) {
            await supabase.from('pastes')
              .update({ protection_enabled: action.params.enabled })
              .eq('slug', action.params.slug);
            toast({ title: `Protection ${action.params.enabled ? 'enabled' : 'disabled'}` });
            onRefreshData?.();
          }
          break;

        case "toggle_tracking":
          if (action.params?.slug) {
            await supabase.from('pastes')
              .update({ ip_tracking_enabled: action.params.enabled })
              .eq('slug', action.params.slug);
            toast({ title: `Tracking ${action.params.enabled ? 'enabled' : 'disabled'}` });
            onRefreshData?.();
          }
          break;

        case "clear_threats":
          await callAdminApi('clear_threats');
          toast({ title: "Threats cleared" });
          onRefreshData?.();
          break;

        case "clear_logs":
          await callAdminApi('clear_access_logs');
          toast({ title: "Access logs cleared" });
          onRefreshData?.();
          break;

        case "clear_sessions":
          await callAdminApi('clear_sessions');
          toast({ title: "Sessions cleared" });
          onRefreshData?.();
          break;

        case "clear_activity":
          await callAdminApi('clear_activity');
          toast({ title: "Activity cleared" });
          onRefreshData?.();
          break;

        case "mass_unban":
          if (action.params?.reason_pattern) {
            const result = await callAdminApi('mass_unban_by_reason', { reason_pattern: action.params.reason_pattern });
            toast({ title: "Mass unban complete", description: `${result.unbanned_count || 0} bans removed` });
            onRefreshData?.();
          }
          break;

        default:
          console.warn('[JARVIS] Unknown action type:', action.type);
      }
    } catch (err: any) {
      console.error('[JARVIS] Action execution error:', err);
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  }, [navigate, onTabChange, onRefreshData, callAdminApi, toast]);

  // Send command to JARVIS backend
  const processCommand = useCallback(async (text: string) => {
    setState("processing");
    setLastTranscript(text);
    setShowPulse(true);

    try {
      console.log('[JARVIS] Sending command:', text);
      const { data, error } = await supabase.functions.invoke('jarvis-voice', {
        body: { 
          message: text,
          context: { currentPage: location.pathname }
        },
      });

      console.log('[JARVIS] Response data:', JSON.stringify(data));
      console.log('[JARVIS] Response error:', error);

      if (error) throw error;
      
      // Robust extraction - handle nested or differently shaped responses
      let speech = "I didn't quite catch that, sir.";
      let action = null;

      if (data) {
        speech = data.speech || data.message || speech;
        action = data.action || null;
        
        // If action is a string, try to parse it
        if (typeof action === 'string') {
          try { action = JSON.parse(action); } catch { action = null; }
        }
      }

      console.log('[JARVIS] Executing action:', JSON.stringify(action));
      console.log('[JARVIS] Speech:', speech);

      // Execute action first, then speak
      if (action && action.type) {
        await executeAction(action);
      }
      speak(speech);
      
    } catch (err: any) {
      console.error('[JARVIS] Error:', err);
      speak("My apologies, sir. I encountered a technical difficulty.");
    }
  }, [location.pathname, executeAction, speak]);

  // Active listening
  const startActiveListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Not Supported", description: "Speech recognition not available.", variant: "destructive" });
      return;
    }

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

  // Wake word listening
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
          recognition.stop();
          
          const afterJarvis = transcript.split(/jarv(?:is)?/i).pop()?.trim();
          if (afterJarvis && afterJarvis.length > 3 && event.results[i].isFinal) {
            processCommand(afterJarvis);
          } else {
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
      if (wakeWordActive) {
        setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 100);
      }
    };

    wakeRecognitionRef.current = recognition;
    try { recognition.start(); } catch {}
  }, [wakeWordActive, processCommand, speak, startActiveListening]);

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

  useEffect(() => {
    if (wakeWordActive) {
      // Small delay to avoid conflicts when toggling
      const timeout = setTimeout(() => {
        startWakeWordListening();
      }, 300);
      return () => clearTimeout(timeout);
    } else {
      try { wakeRecognitionRef.current?.stop(); } catch {}
    }
    return () => {
      try { wakeRecognitionRef.current?.stop(); } catch {}
    };
  }, [wakeWordActive, startWakeWordListening]);

  useEffect(() => {
    // Pre-load voices
    const loadVoices = () => window.speechSynthesis?.getVoices();
    loadVoices();
    window.speechSynthesis?.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices);
    };
  }, []);

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch {}
      try { wakeRecognitionRef.current?.stop(); } catch {}
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (showPulse) {
      const t = setTimeout(() => setShowPulse(false), 3000);
      return () => clearTimeout(t);
    }
  }, [showPulse]);

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
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2">
        {state !== "idle" && (
          <div className="px-3 py-1.5 rounded-lg bg-background/90 backdrop-blur-xl border border-cyan-500/20 text-[10px] font-mono tracking-widest text-cyan-400/80 uppercase animate-in fade-in slide-in-from-bottom-2 duration-200">
            {state === "listening" ? "Listening..." : state === "processing" ? "Processing..." : "Speaking..."}
          </div>
        )}

        {lastTranscript && showPulse && (
          <div className="px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-xl border border-border/30 text-xs text-muted-foreground max-w-[200px] truncate animate-in fade-in slide-in-from-bottom-2 duration-200">
            "{lastTranscript}"
          </div>
        )}

        <div className="flex items-center gap-2">
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

          <button
            onClick={handleOrbClick}
            className={`relative w-14 h-14 rounded-full bg-gradient-to-br ${stateColors[state]} border-2 shadow-lg ${glowColors[state]} transition-all duration-500 hover:scale-105 active:scale-95`}
            title={state === "idle" ? "Click to talk to JARVIS" : state === "listening" ? "Click to cancel" : "JARVIS is active"}
          >
            <div className={`absolute inset-0 rounded-full border border-cyan-400/20 ${
              state === "listening" || state === "speaking" ? "animate-spin" : ""
            }`} style={{ animationDuration: "4s" }} />
            
            <div className={`absolute inset-1 rounded-full border border-cyan-400/15 ${
              state === "speaking" ? "animate-spin" : ""
            }`} style={{ animationDuration: "3s", animationDirection: "reverse" }} />

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
