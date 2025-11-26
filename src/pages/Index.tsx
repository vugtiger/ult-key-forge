import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
      
      <div className="relative z-10 text-center space-y-8 px-4">
        <h1 className="text-7xl font-bold tracking-tighter">
          <span className="bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
            ULT LUA PROTECTS
          </span>
        </h1>
        <p className="text-2xl text-muted-foreground max-w-2xl mx-auto">
          Advanced key system management for Roblox scripts
        </p>
        <Button 
          size="lg" 
          className="cyber-glow text-lg px-8 py-6"
          onClick={() => navigate("/auth")}
        >
          Get Started
          <ArrowRight className="ml-2" size={24} />
        </Button>
      </div>
    </div>
  );
};

export default Index;
