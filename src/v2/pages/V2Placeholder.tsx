import V2Layout from "../components/V2Layout";
import { Construction } from "lucide-react";

const V2Placeholder = ({ title }: { title: string }) => (
  <V2Layout title={title}>
    <div className="v2-card p-12 text-center">
      <Construction size={32} className="mx-auto mb-3 opacity-40" />
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-sm" style={{ color: "hsl(var(--v2-fg-muted))" }}>
        Coming in the next phase. Database is ready — UI being built.
      </p>
    </div>
  </V2Layout>
);

export default V2Placeholder;
