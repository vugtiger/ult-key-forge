import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import TabHelpSection from "@/components/onboarding/TabHelpSection";
import { changelogHelp } from "@/components/onboarding/helpContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { History, Sparkles, CheckCircle } from "lucide-react";

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  description: string;
  changes: string[];
  is_major: boolean;
  created_at: string;
}

const Changelog = () => {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChangelog = async () => {
      try {
        const { data, error } = await supabase
          .from('changelog')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Parse changes from JSONB
        const parsed: ChangelogEntry[] = data?.map(entry => ({
          id: entry.id,
          version: entry.version,
          title: entry.title,
          description: entry.description,
          is_major: entry.is_major ?? false,
          created_at: entry.created_at,
          changes: Array.isArray(entry.changes) 
            ? entry.changes.map(c => String(c)) 
            : []
        })) || [];

        setEntries(parsed);
      } catch (error) {
        console.error('Error fetching changelog:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchChangelog();
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8" />
            Changelog
          </h1>
          <p className="text-muted-foreground">
            Stay updated with the latest features and improvements
          </p>
        </div>

        <TabHelpSection {...changelogHelp} />

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-1/4" />
                  <div className="h-4 bg-muted rounded w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : entries.length > 0 ? (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-6">
              {entries.map((entry, index) => (
                <div key={entry.id} className="relative pl-12">
                  {/* Timeline dot */}
                  <div className={`absolute left-0 top-6 w-10 h-10 rounded-full flex items-center justify-center ${
                    entry.is_major 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {entry.is_major ? (
                      <Sparkles className="h-5 w-5" />
                    ) : (
                      <CheckCircle className="h-5 w-5" />
                    )}
                  </div>

                  <Card className={entry.is_major ? 'border-primary/50' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant={entry.is_major ? 'default' : 'secondary'}>
                            v{entry.version}
                          </Badge>
                          {entry.is_major && (
                            <Badge variant="outline" className="border-primary text-primary">
                              Major Release
                            </Badge>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                      <CardTitle className="mt-2">{entry.title}</CardTitle>
                      <CardDescription>{entry.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {entry.changes.map((change, changeIndex) => (
                          <li 
                            key={changeIndex}
                            className="flex items-start gap-2 text-sm"
                          >
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{change}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No changelog entries yet.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Changelog;
