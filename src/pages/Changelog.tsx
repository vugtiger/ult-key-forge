import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { changelogHelp } from "@/components/onboarding/helpContent";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { History, Sparkles, CheckCircle } from "lucide-react";

interface ChangelogEntry {
  id: string; version: string; title: string; description: string;
  changes: string[]; is_major: boolean; created_at: string;
}

const Changelog = () => {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChangelog = async () => {
      try {
        const { data, error } = await supabase.from('changelog').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        const parsed: ChangelogEntry[] = data?.map(entry => ({
          id: entry.id, version: entry.version, title: entry.title,
          description: entry.description, is_major: entry.is_major ?? false, created_at: entry.created_at,
          changes: Array.isArray(entry.changes) ? entry.changes.map(c => String(c)) : []
        })) || [];
        setEntries(parsed);
      } catch (error) { console.error('Error fetching changelog:', error); }
      finally { setLoading(false); }
    };
    fetchChangelog();
  }, []);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center">
            <History className="text-primary" size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Changelog</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Stay updated with the latest features and improvements</p>
          </div>
        </div>

        <TabHelpSection {...changelogHelp} />

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-primary/10 bg-card/20 p-5">
                <div className="h-5 bg-muted/20 rounded w-1/4 mb-3" />
                <div className="h-4 bg-muted/20 rounded w-1/2 mb-4" />
                <div className="space-y-2">
                  <div className="h-3 bg-muted/20 rounded w-3/4" />
                  <div className="h-3 bg-muted/20 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length > 0 ? (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-0 bottom-0 w-px bg-primary/15" />

            <div className="space-y-3">
              {entries.map((entry) => (
                <div key={entry.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div className={`absolute left-0 top-5 w-[30px] h-[30px] rounded-full flex items-center justify-center ${
                    entry.is_major ? 'bg-primary/20 border border-primary/30' : 'bg-muted/20 border border-border/30'
                  }`}>
                    {entry.is_major ? <Sparkles className="h-3.5 w-3.5 text-primary" /> : <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>

                  <div className={`rounded-xl border ${entry.is_major ? 'border-primary/20' : 'border-primary/8'} bg-card/20 p-5 backdrop-blur-xl`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={entry.is_major ? 'default' : 'secondary'} className="text-[10px] h-5">v{entry.version}</Badge>
                        {entry.is_major && <Badge variant="outline" className="border-primary/30 text-primary text-[10px] h-5">Major</Badge>}
                      </div>
                      <span className="text-[10px] text-muted-foreground">{formatDate(entry.created_at)}</span>
                    </div>
                    <h3 className="text-sm font-semibold mt-1">{entry.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>
                    {entry.changes.length > 0 && (
                      <ul className="space-y-1.5 mt-3">
                        {entry.changes.map((change, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <CheckCircle className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                            <span className="text-muted-foreground">{change}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-primary/10 bg-card/20 p-12 text-center backdrop-blur-xl">
            <p className="text-xs text-muted-foreground">No changelog entries yet.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Changelog;
