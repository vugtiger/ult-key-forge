import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock } from "lucide-react";

const LastUpdatedBadge = () => {
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    fetchLastUpdated();
  }, []);

  const fetchLastUpdated = async () => {
    const { data, error } = await supabase
      .from('site_info')
      .select('last_updated')
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const updateDate = new Date(data.last_updated);
      const now = new Date();
      const diffTime = now.getTime() - updateDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        setLastUpdated("today");
      } else if (diffDays === 1) {
        setLastUpdated("yesterday");
      } else if (diffDays < 7) {
        setLastUpdated(`${diffDays} days ago`);
      } else {
        setLastUpdated(updateDate.toLocaleDateString());
      }
    }
  };

  if (!lastUpdated) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card/50 border border-border/50 rounded-lg px-3 py-1.5">
      <Clock className="h-4 w-4" />
      <span>Last updated: <span className="text-foreground">{lastUpdated}</span></span>
    </div>
  );
};

export default LastUpdatedBadge;
