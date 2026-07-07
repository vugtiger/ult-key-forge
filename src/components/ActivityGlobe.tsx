import { useEffect, useRef, useState, useMemo } from "react";
import Globe from "react-globe.gl";


interface Region {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  executions: number;
  lastExecuted: string;
  isp: string;
}

const REGIONS: Region[] = [
  { id: "1", name: "New York",       country: "United States",   lat: 40.7128,  lng: -74.0060,  executions: 1284, lastExecuted: "2m ago",  isp: "Verizon Fios" },
  { id: "2", name: "Los Angeles",    country: "United States",   lat: 34.0522,  lng: -118.2437, executions:  942, lastExecuted: "12s ago", isp: "Spectrum" },
  { id: "3", name: "London",         country: "United Kingdom",  lat: 51.5074,  lng:   -0.1278, executions:  831, lastExecuted: "1m ago",  isp: "BT Group" },
  { id: "4", name: "Berlin",         country: "Germany",         lat: 52.5200,  lng:   13.4050, executions:  612, lastExecuted: "3m ago",  isp: "Deutsche Telekom" },
  { id: "5", name: "Paris",          country: "France",          lat: 48.8566,  lng:    2.3522, executions:  489, lastExecuted: "5m ago",  isp: "Orange" },
  { id: "6", name: "Moscow",         country: "Russia",          lat: 55.7558,  lng:   37.6173, executions:  377, lastExecuted: "18s ago", isp: "Rostelecom" },
  { id: "7", name: "Tokyo",          country: "Japan",           lat: 35.6762,  lng:  139.6503, executions: 1102, lastExecuted: "just now", isp: "NTT" },
  { id: "8", name: "Seoul",          country: "South Korea",     lat: 37.5665,  lng:  126.9780, executions:  744, lastExecuted: "30s ago", isp: "KT Corp" },
  { id: "9", name: "Beijing",        country: "China",           lat: 39.9042,  lng:  116.4074, executions:  598, lastExecuted: "2m ago",  isp: "China Telecom" },
  { id: "10", name: "Sydney",        country: "Australia",       lat: -33.8688, lng:  151.2093, executions:  431, lastExecuted: "8m ago",  isp: "Telstra" },
  { id: "11", name: "São Paulo",     country: "Brazil",          lat: -23.5505, lng:  -46.6333, executions:  553, lastExecuted: "1m ago",  isp: "Vivo" },
  { id: "12", name: "Mexico City",   country: "Mexico",          lat: 19.4326,  lng:  -99.1332, executions:  318, lastExecuted: "4m ago",  isp: "Telmex" },
  { id: "13", name: "Toronto",       country: "Canada",          lat: 43.6532,  lng:  -79.3832, executions:  407, lastExecuted: "45s ago", isp: "Rogers" },
  { id: "14", name: "Mumbai",        country: "India",           lat: 19.0760,  lng:   72.8777, executions:  876, lastExecuted: "15s ago", isp: "Jio" },
  { id: "15", name: "Dubai",         country: "UAE",             lat: 25.2048,  lng:   55.2708, executions:  289, lastExecuted: "6m ago",  isp: "Etisalat" },
  { id: "16", name: "Cape Town",     country: "South Africa",    lat: -33.9249, lng:   18.4241, executions:  164, lastExecuted: "10m ago", isp: "Vodacom" },
  { id: "17", name: "Cairo",         country: "Egypt",           lat: 30.0444,  lng:   31.2357, executions:  201, lastExecuted: "7m ago",  isp: "Orange EG" },
  { id: "18", name: "Singapore",     country: "Singapore",       lat: 1.3521,   lng:  103.8198, executions:  692, lastExecuted: "20s ago", isp: "Singtel" },
  { id: "19", name: "Amsterdam",     country: "Netherlands",     lat: 52.3676,  lng:    4.9041, executions:  384, lastExecuted: "3m ago",  isp: "KPN" },
  { id: "20", name: "Istanbul",      country: "Turkey",          lat: 41.0082,  lng:   28.9784, executions:  257, lastExecuted: "9m ago",  isp: "Turkcell" },
  { id: "21", name: "Buenos Aires",  country: "Argentina",       lat: -34.6037, lng:  -58.3816, executions:  212, lastExecuted: "11m ago", isp: "Telecom AR" },
  { id: "22", name: "Bangkok",       country: "Thailand",        lat: 13.7563,  lng:  100.5018, executions:  348, lastExecuted: "2m ago",  isp: "AIS" },
  { id: "23", name: "Warsaw",        country: "Poland",          lat: 52.2297,  lng:   21.0122, executions:  173, lastExecuted: "14m ago", isp: "Orange PL" },
  { id: "24", name: "Stockholm",     country: "Sweden",          lat: 59.3293,  lng:   18.0686, executions:  156, lastExecuted: "17m ago", isp: "Telia" },
];

const ActivityGlobe = ({ size = 380 }: { size?: number; points?: number }) => {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: size, h: size });
  const [selected, setSelected] = useState<Region | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.min(el.clientWidth, 560);
      setDim({ w, h: w });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;
    // Auto-rotate
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.enableZoom = false;
    globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2.2 }, 0);
  }, [dim.w]);

  const pointsData = useMemo(
    () => REGIONS.map((r) => ({ ...r, size: 0.35 + Math.min(r.executions, 1500) / 2500 })),
    []
  );

  return (
    <div className="w-full">
      <div ref={containerRef} className="relative w-full flex items-center justify-center">
        <div
          className="relative rounded-full"
          style={{
            width: dim.w,
            height: dim.h,
            filter: "drop-shadow(0 0 60px hsl(272 92% 45% / 0.55))",
          }}
        >
          <Globe
            ref={globeRef}
            width={dim.w}
            height={dim.h}
            backgroundColor="rgba(0,0,0,0)"
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            atmosphereColor="#a855f7"
            atmosphereAltitude={0.22}
            pointsData={pointsData}
            pointLat={(d: any) => d.lat}
            pointLng={(d: any) => d.lng}
            pointColor={() => "#c084fc"}
            pointAltitude={(d: any) => d.size * 0.05}
            pointRadius={(d: any) => d.size * 0.6}
            pointLabel={(d: any) =>
              `<div style="background:hsl(262 35% 8% / 0.95);border:1px solid hsl(272 92% 55% / 0.5);padding:6px 10px;border-radius:8px;font-size:11px;color:#fff;font-family:system-ui">
                <div style="font-weight:600">${d.name}, ${d.country}</div>
                <div style="color:#c084fc">${d.executions.toLocaleString()} executions</div>
              </div>`
            }
            onPointClick={(d: any) => setSelected(d as Region)}
            ringsData={selected ? [selected] : []}
            ringLat={(d: any) => d.lat}
            ringLng={(d: any) => d.lng}
            ringColor={() => (t: number) => `rgba(192,132,252,${1 - t})`}
            ringMaxRadius={5}
            ringPropagationSpeed={3}
            ringRepeatPeriod={800}
          />
        </div>
      </div>

      {/* Detail panel */}
      <div className="mt-5">
        {selected ? (
          <div className="rounded-2xl border border-primary/30 bg-[hsl(262_35%_7%/0.85)] backdrop-blur-xl p-5 animate-fade-in">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-primary">Region details</div>
                <div className="text-lg font-bold mt-0.5">{selected.name}, {selected.country}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded-lg hover:bg-primary/10"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-xl bg-foreground/[0.04] border border-border/40 p-3">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Executions</div>
                <div className="font-bold mt-1 text-sm">{selected.executions.toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-foreground/[0.04] border border-border/40 p-3">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Last seen</div>
                <div className="font-bold mt-1 text-sm">{selected.lastExecuted}</div>
              </div>
              <div className="rounded-xl bg-foreground/[0.04] border border-border/40 p-3">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">ISP</div>
                <div className="font-bold mt-1 text-sm truncate">{selected.isp}</div>
              </div>
              <div className="rounded-xl bg-foreground/[0.04] border border-border/40 p-3">
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Coords</div>
                <div className="font-bold mt-1 text-sm">{selected.lat.toFixed(1)}, {selected.lng.toFixed(1)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-xs text-muted-foreground">
            Tap any glowing dot on the globe to see region details.
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityGlobe;
