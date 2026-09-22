import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { checkBan } from "@/lib/banCheck";

const GlobalBanGate = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/blocked") return;
    let active = true;
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const data = await checkBan(session?.user.id);
        if (active && data?.banned) {
          if (session) await supabase.auth.signOut();
          navigate("/blocked?reason=banned", { replace: true });
        }
      } catch {
        // never block the app on a slow/failed check
      }
    };
    void check();
    return () => { active = false; };
  }, [location.pathname, navigate]);

  return null;
};

export default GlobalBanGate;
