import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, Volume2, VolumeX, Trash2, Send, Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const JarvisAI = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [pulseIntensity, setPulseIntensity] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Pulse animation while listening
  useEffect(() => {
    if (!listening) { setPulseIntensity(0); return; }
    const interval = setInterval(() => {
      setPulseIntensity(Math.random() * 100);
    }, 150);
    return () => clearInterval(interval);
  }, [listening]);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Try to find a deep male British voice for Jarvis feel
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => 
      v.name.includes("Daniel") || v.name.includes("Google UK English Male") || 
      v.name.includes("Microsoft Mark") || v.name.includes("Alex")
    ) || voices.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("male"))
      || voices.find(v => v.lang.startsWith("en"));
    
    if (preferred) utterance.voice = preferred;
    utterance.rate = 0.95;
    utterance.pitch = 0.85;
    utterance.volume = 1;
    
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: [...messages, userMsg] },
      });
      if (error) throw error;
      
      const reply = data?.response || "I couldn't process that, sir.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
      
      // Strip code blocks for speech
      const speechText = reply.replace(/```[\s\S]*?```/g, "... code block omitted ...").slice(0, 500);
      speak(speechText);
    } catch (err: any) {
      const errorMsg = "My systems encountered an error, sir. Please try again.";
      setMessages(prev => [...prev, { role: "assistant", content: errorMsg }]);
      speak(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, speak]);

  const toggleListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Not Supported", description: "Speech recognition not available in this browser.", variant: "destructive" });
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setListening(false);
      sendMessage(transcript);
    };

    recognition.onerror = () => {
      setListening(false);
      toast({ title: "Voice Error", description: "Couldn't understand. Try again.", variant: "destructive" });
    };

    recognition.onend = () => setListening(false);
    
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [listening, sendMessage, toast]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatMessage = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const code = part.slice(3, -3);
        const nl = code.indexOf("\n");
        const lang = nl > 0 ? code.slice(0, nl) : "";
        const body = nl > 0 ? code.slice(nl + 1) : code;
        return (
          <div key={i} className="my-2 rounded-lg overflow-hidden border border-cyan-500/20">
            {lang && <div className="bg-cyan-950/30 px-3 py-1 text-[10px] text-cyan-400/70 border-b border-cyan-500/20">{lang}</div>}
            <pre className="p-3 bg-black/40 overflow-x-auto"><code className="text-xs font-mono text-cyan-100/80">{body}</code></pre>
          </div>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="relative rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[hsl(200,80%,4%)] to-[hsl(200,60%,2%)] overflow-hidden flex flex-col h-[600px]">
      {/* Jarvis Header */}
      <div className="relative px-6 py-4 border-b border-cyan-500/15 bg-cyan-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Animated Arc Reactor */}
            <div className="relative w-10 h-10">
              <div className={`absolute inset-0 rounded-full border-2 border-cyan-400/40 ${speaking ? 'animate-spin' : ''}`} 
                   style={{ animationDuration: '3s' }} />
              <div className={`absolute inset-1 rounded-full border border-cyan-400/30 ${speaking ? 'animate-spin' : ''}`} 
                   style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
              <div className={`absolute inset-2 rounded-full bg-cyan-400/20 flex items-center justify-center transition-all duration-300 ${
                listening ? 'bg-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.4)]' : 
                speaking ? 'bg-cyan-400/30 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : ''
              }`}>
                <div className={`w-2 h-2 rounded-full bg-cyan-400 ${listening || speaking ? 'animate-pulse' : ''}`} />
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-[0.2em] text-cyan-300 uppercase">J.A.R.V.I.S</h2>
              <p className="text-[10px] text-cyan-500/50 tracking-wider">
                {listening ? "LISTENING..." : speaking ? "SPEAKING..." : loading ? "PROCESSING..." : "STANDING BY"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" size="icon" 
              onClick={() => { setVoiceEnabled(!voiceEnabled); if (speaking) window.speechSynthesis.cancel(); }}
              className="h-8 w-8 text-cyan-500/60 hover:text-cyan-400 hover:bg-cyan-500/10"
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            {messages.length > 0 && (
              <Button variant="ghost" size="icon" onClick={() => setMessages([])}
                className="h-8 w-8 text-cyan-500/60 hover:text-cyan-400 hover:bg-cyan-500/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Audio visualizer bar */}
        {listening && (
          <div className="flex items-center gap-[2px] mt-3 h-4 justify-center">
            {Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="w-1 bg-cyan-400/60 rounded-full transition-all duration-100"
                style={{ height: `${Math.max(2, Math.random() * pulseIntensity * 0.16)}px` }} />
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-cyan-400/20 animate-spin" style={{ animationDuration: '8s' }} />
              <div className="absolute inset-2 rounded-full border border-cyan-400/15 animate-spin" style={{ animationDuration: '5s', animationDirection: 'reverse' }} />
              <div className="absolute inset-4 rounded-full bg-cyan-400/10 flex items-center justify-center">
                <Bot className="h-6 w-6 text-cyan-400/60" />
              </div>
            </div>
            <p className="text-cyan-300/80 text-sm font-medium tracking-wide">Good day, sir.</p>
            <p className="text-cyan-500/40 text-xs mt-1 max-w-xs">
              Click the microphone or type a command. I'm at your service.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-cyan-500/15 text-cyan-100 border border-cyan-500/20 rounded-br-sm"
                    : "bg-cyan-950/40 text-cyan-100/90 border border-cyan-500/10 rounded-bl-sm"
                }`}>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-cyan-400/60 font-medium tracking-wider uppercase">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60" />
                      J.A.R.V.I.S
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">
                    {msg.role === "assistant" ? formatMessage(msg.content) : msg.content}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-cyan-950/40 border border-cyan-500/10 rounded-xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-cyan-400/60 font-medium tracking-wider uppercase">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-pulse" />
                    PROCESSING
                  </div>
                  <div className="flex gap-1">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-cyan-400/50 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-cyan-500/15 bg-cyan-950/10">
        <div className="flex gap-2 items-end">
          <Button
            onClick={toggleListening}
            variant="ghost"
            size="icon"
            className={`h-10 w-10 rounded-xl shrink-0 transition-all duration-300 ${
              listening 
                ? "bg-cyan-400/20 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.3)] border border-cyan-400/40" 
                : "text-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/10 border border-cyan-500/20"
            }`}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Textarea
            placeholder="Speak or type a command, sir..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            className="min-h-[40px] max-h-[120px] resize-none bg-cyan-950/30 border-cyan-500/15 text-cyan-100 placeholder:text-cyan-500/30 focus:border-cyan-400/30 text-sm"
            rows={1}
          />
          <Button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            size="icon"
            className="h-10 w-10 rounded-xl shrink-0 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/20"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default JarvisAI;
