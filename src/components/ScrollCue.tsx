import { ChevronDown } from "lucide-react";

interface ScrollCueProps {
  targetId: string;
  label?: string;
}

const ScrollCue = ({ targetId, label = "Scroll" }: ScrollCueProps) => {
  const scroll = () => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex justify-center -mt-10">
      <button
        onClick={scroll}
        aria-label={`Scroll to ${label}`}
        className="group flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="text-[10px] uppercase tracking-[0.3em]">{label}</span>
        <span className="flex h-10 w-6 items-start justify-center rounded-full border border-border bg-card/40 p-1 backdrop-blur-xl">
          <span className="h-2 w-1 rounded-full bg-foreground/60 animate-[scroll-cue_1.6s_ease-in-out_infinite]" />
        </span>
        <ChevronDown size={14} className="animate-bounce opacity-70 group-hover:opacity-100" />
      </button>
    </div>
  );
};

export default ScrollCue;
