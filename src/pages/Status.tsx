import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, Clock, Activity, Database, Globe, Bot, FileCode, RefreshCw } from "lucide-react";
import CloudLogo from "@/components/CloudLogo";
import CloudBackground from "@/components/CloudBackground";

interface ServiceStatus {
  name: string;
  icon: React.ElementType;
  status: 'operational' | 'degraded' | 'down' | 'checking';
  latency?: number;
  description: string;
}

const Status = () => {
  const navigate = useNavigate();
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "Website", icon: Globe, status: "checking", description: "Main web application" },
    { name: "API / Edge Functions", icon: Activity, status: "checking", description: "Backend API endpoints" },
    { name: "Database", icon: Database, status: "checking", description: "Data storage and retrieval" },
    { name: "Discord Bot", icon: Bot, status: "checking", description: "Discord integration service" },
    { name: "Paste System", icon: FileCode, status: "checking", description: "Script hosting and delivery" },
  ]);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [checking, setChecking] = useState(false);

  const checkServices = async () => {
    setChecking(true);
    const results: ServiceStatus[] = [...services];

    // Website check
    results[0] = { ...results[0], status: "operational", latency: 0 };

    // API check - never hit the loader endpoint from a browser (it is a
    // protected entry point); ping a safe function instead.
    try {
      const start = Date.now();
      const { error } = await supabase.functions.invoke('discord-bot', { body: { action: 'ping' } });
      const latency = Date.now() - start;
      results[1] = { ...results[1], status: error ? "degraded" : "operational", latency };
    } catch {
      results[1] = { ...results[1], status: "down" };
    }

    // Database check
    try {
      const start = Date.now();
      const { error } = await supabase.from('site_info').select('id').limit(1);
      const latency = Date.now() - start;
      results[2] = { ...results[2], status: error ? "degraded" : "operational", latency };
    } catch {
      results[2] = { ...results[2], status: "down" };
    }

    // Discord Bot check
    try {
      const start = Date.now();
      const { error } = await supabase.functions.invoke('discord-bot', { body: { action: 'ping' } });
      const latency = Date.now() - start;
      results[3] = { ...results[3], status: error ? "degraded" : "operational", latency };
    } catch {
      results[3] = { ...results[3], status: "degraded" };
    }

    // Paste system check - read-only database probe, no loader request
    try {
      const start = Date.now();
      const { error } = await supabase.from('pastes').select('id').limit(1);
      const latency = Date.now() - start;
      results[4] = { ...results[4], status: error ? "degraded" : "operational", latency };
    } catch {
      results[4] = { ...results[4], status: "down" };
    }

    setServices(results);
    setLastChecked(new Date());
    setChecking(false);
  };

  useEffect(() => { checkServices(); }, []);

  const allOperational = services.every(s => s.status === "operational");
  const hasDown = services.some(s => s.status === "down");

  const statusColor = (s: string) => {
    if (s === 'operational') return 'text-emerald-400';
    if (s === 'degraded') return 'text-yellow-400';
    if (s === 'down') return 'text-red-400';
    return 'text-muted-foreground';
  };

  const statusBg = (s: string) => {
    if (s === 'operational') return 'bg-emerald-400';
    if (s === 'degraded') return 'bg-yellow-400';
    if (s === 'down') return 'bg-red-400';
    return 'bg-muted-foreground';
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden grain-overlay">
      <CloudBackground />
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-8 gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
          Back to Home
        </Button>

        <div className="text-center mb-10">
          <CloudLogo size={48} className="mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">System Status</h1>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${allOperational ? 'bg-emerald-400/10 text-emerald-400' : hasDown ? 'bg-red-400/10 text-red-400' : 'bg-yellow-400/10 text-yellow-400'}`}>
            {allOperational ? <CheckCircle size={16} /> : hasDown ? <XCircle size={16} /> : <Clock size={16} />}
            {allOperational ? 'All Systems Operational' : hasDown ? 'Service Disruption' : 'Partial Degradation'}
          </div>
        </div>

        <div className="space-y-3 mb-8">
          {services.map((service) => (
            <div key={service.name} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <service.icon size={18} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="text-xs text-muted-foreground">{service.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {service.latency !== undefined && (
                  <span className="text-[10px] text-muted-foreground">{service.latency}ms</span>
                )}
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${statusBg(service.status)}`} />
                  <span className={`text-xs font-medium capitalize ${statusColor(service.status)}`}>
                    {service.status === 'checking' ? 'Checking...' : service.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Last checked: {lastChecked.toLocaleTimeString()}</span>
          <Button variant="ghost" size="sm" onClick={checkServices} disabled={checking} className="gap-1.5 text-xs">
            <RefreshCw size={12} className={checking ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Status;
