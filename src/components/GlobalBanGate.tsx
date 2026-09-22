import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const getDeviceId = () => {
  const key = "ult_device_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID().replaceAll("-", "");
  localStorage.setItem(key, created);
  return created;
};

const GlobalBanGate = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/blocked") return;
    let active = true;
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const { data } = await supabase.functions.invoke("track-ip", {
        body: {
          action: "check_ban",
          user_id: session?.user.id,
          device_id: getDeviceId(),
        },
      });
      if (active && data?.banned) {
        if (session) await supabase.auth.signOut();
        navigate("/blocked?reason=banned", { replace: true });
      }
    };
    void check();
    return () => { active = false; };
  }, [location.pathname, navigate]);

  return null;
};

export default GlobalBanGate;