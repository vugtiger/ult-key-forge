import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import CloudBackground from "@/components/CloudBackground";
import CloudLogo from "@/components/CloudLogo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      <CloudBackground />
      <div className="relative z-10 text-center space-y-6">
        <CloudLogo size={64} className="mx-auto text-primary/40" />
        <h1 className="text-7xl font-black text-primary/30">404</h1>
        <p className="text-xl text-muted-foreground">This page doesn't exist.</p>
        <Link to="/" className="inline-block rounded-2xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
