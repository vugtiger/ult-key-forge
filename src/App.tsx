import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PasswordReset from "./pages/PasswordReset";
import UpdatePassword from "./pages/UpdatePassword";
import Dashboard from "./pages/Dashboard";
import Scripts from "./pages/Scripts";
import Pastebin from "./pages/Pastebin";
import AIAssistant from "./pages/AIAssistant";
import Settings from "./pages/Settings";
import AdminDashboard from "./pages/AdminDashboard";
import DiscordBot from "./pages/DiscordBot";
import Install from "./pages/Install";
import Analytics from "./pages/Analytics";
import Changelog from "./pages/Changelog";
import ScriptSettings from "./pages/ScriptSettings";
import Status from "./pages/Status";
import ProtectionKeysAnalytics from "./pages/ProtectionKeysAnalytics";
import NotFound from "./pages/NotFound";
import V2Landing from "./v2/pages/V2Landing";
import V2Auth from "./v2/pages/V2Auth";
import V2Dashboard from "./v2/pages/V2Dashboard";
import V2Placeholder from "./v2/pages/V2Placeholder";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/password-reset" element={<PasswordReset />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scripts" element={<Scripts />} />
          <Route path="/pastebin" element={<Pastebin />} />
          <Route path="/ai-assistant" element={<AIAssistant />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/discord-bot" element={<DiscordBot />} />
          <Route path="/install" element={<Install />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/script-settings" element={<ScriptSettings />} />
          <Route path="/protection-keys" element={<ProtectionKeysAnalytics />} />
          <Route path="/status" element={<Status />} />

          {/* v2 — separate site */}
          <Route path="/v2" element={<V2Landing />} />
          <Route path="/v2/auth" element={<V2Auth />} />
          <Route path="/v2/dashboard" element={<V2Dashboard />} />
          <Route path="/v2/scripts" element={<V2Placeholder title="Scripts" />} />
          <Route path="/v2/keys" element={<V2Placeholder title="Keys" />} />
          <Route path="/v2/users" element={<V2Placeholder title="Users" />} />
          <Route path="/v2/blacklist" element={<V2Placeholder title="Blacklist" />} />
          <Route path="/v2/logs" element={<V2Placeholder title="Logs" />} />
          <Route path="/v2/webhooks" element={<V2Placeholder title="Webhooks" />} />
          <Route path="/v2/settings" element={<V2Placeholder title="Settings" />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
