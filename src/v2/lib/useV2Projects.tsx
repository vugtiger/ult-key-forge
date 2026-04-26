import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface V2Project { id: string; name: string; }

export const useV2Projects = () => {
  const [projects, setProjects] = useState<V2Project[]>([]);
  const [selected, setSelected] = useState<string>(() => localStorage.getItem("v2_selected_project") || "");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("v2_projects").select("id,name").order("created_at", { ascending: false }).then(({ data }) => {
      const ps = data || [];
      setProjects(ps);
      if (ps.length && !ps.find(p => p.id === selected)) {
        setSelected(ps[0].id);
        localStorage.setItem("v2_selected_project", ps[0].id);
      }
      setLoading(false);
    });
  }, []);

  const select = (id: string) => {
    setSelected(id);
    localStorage.setItem("v2_selected_project", id);
  };

  return { projects, selected, select, loading };
};

export const ProjectSelector = ({ projects, selected, onChange }: { projects: V2Project[]; selected: string; onChange: (id: string) => void }) => (
  <select className="v2-select" value={selected} onChange={(e) => onChange(e.target.value)} style={{ width: "auto", minWidth: 180 }}>
    {projects.length === 0 && <option value="">No projects</option>}
    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
  </select>
);

export const NoProjectEmpty = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <div className="v2-card p-16 text-center">
    <Icon size={28} className="mx-auto mb-3 text-white/40" />
    <h3 className="font-semibold mb-1">No project selected</h3>
    <p className="text-sm text-white/45">Create a project first to manage {label}.</p>
  </div>
);
