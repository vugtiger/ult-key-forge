import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { probeLoaderHost } from "@/lib/loader-url";

void probeLoaderHost();

createRoot(document.getElementById("root")!).render(<App />);
