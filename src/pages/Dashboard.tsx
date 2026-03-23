import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Zap, ChevronRight, ChevronLeft, Check, Copy, Download, Key, Clock, Hash, Users,
  Link2, Settings, Trash2, Plus, Save, BarChart2, AlertTriangle, RefreshCw, Timer
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import KeySystemPreview from "@/components/KeySystemPreview";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// ASCII art
const asciiChars: Record<string, string[]> = {
  'A': ['█████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
  'B': ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██████╔╝', '╚═════╝ '],
  'C': ['██████╗', '██╔════╝', '██║     ', '██║     ', '╚██████╗', ' ╚═════╝'],
  'D': ['██████╗ ', '██╔══██╗', '██║  ██║', '██║  ██║', '██████╔╝', '╚═════╝ '],
  'E': ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝'],
  'F': ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '██║     ', '╚═╝     '],
  'G': ['██████╗ ', '██╔════╝ ', '██║  ███╗', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  'H': ['██╗  ██╗', '██║  ██║', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
  'I': ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  'J': ['     ██╗', '     ██║', '     ██║', '██   ██║', '╚█████╔╝', ' ╚════╝ '],
  'K': ['██╗  ██╗', '██║ ██╔╝', '█████╔╝ ', '██╔═██╗ ', '██║  ██╗', '╚═╝  ╚═╝'],
  'L': ['██╗     ', '██║     ', '██║     ', '██║     ', '███████╗', '╚══════╝'],
  'M': ['███╗   ███╗', '████╗ ████║', '██╔████╔██║', '██║╚██╔╝██║', '██║ ╚═╝ ██║', '╚═╝     ╚═╝'],
  'N': ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'],
  'O': ['██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  'P': ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔═══╝ ', '██║     ', '╚═╝     '],
  'Q': ['██████╗ ', '██╔═══██╗', '██║   ██║', '██║▄▄ ██║', '╚██████╔╝', ' ╚══▀▀═╝ '],
  'R': ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'],
  'S': ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
  'T': ['████████╗', '╚══██╔══╝', '   ██║   ', '   ██║   ', '   ██║   ', '   ╚═╝   '],
  'U': ['██╗   ██╗', '██║   ██║', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  'V': ['██╗   ██╗', '██║   ██║', '██║   ██║', '╚██╗ ██╔╝', ' ╚████╔╝ ', '  ╚═══╝  '],
  'W': ['██╗    ██╗', '██║    ██║', '██║ █╗ ██║', '██║███╗██║', '╚███╔███╔╝', ' ╚══╝╚══╝ '],
  'X': ['██╗  ██╗', '╚██╗██╔╝', ' ╚███╔╝ ', ' ██╔██╗ ', '██╔╝ ██╗', '╚═╝  ╚═╝'],
  'Y': ['██╗   ██╗', '╚██╗ ██╔╝', ' ╚████╔╝ ', '  ╚██╔╝  ', '   ██║   ', '   ╚═╝   '],
  'Z': ['███████╗', '╚══███╔╝', '  ███╔╝ ', ' ███╔╝  ', '███████╗', '╚══════╝'],
  ' ': ['   ', '   ', '   ', '   ', '   ', '   '],
  '0': ['██████╗ ', '██╔═████╗', '██║██╔██║', '████╔╝██║', '╚██████╔╝', ' ╚═════╝ '],
  '1': ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  '2': ['██████╗ ', '╚════██╗', ' █████╔╝', '██╔═══╝ ', '███████╗', '╚══════╝'],
  '3': ['██████╗ ', '╚════██╗', ' █████╔╝', ' ╚═══██╗', '██████╔╝', '╚═════╝ '],
  '4': ['██╗  ██╗', '██║  ██║', '███████║', '╚════██║', '     ██║', '     ╚═╝'],
  '5': ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
  '6': ['██████╗ ', '██╔════╝ ', '███████╗', '██╔═══██╗', '╚██████╔╝', ' ╚═════╝ '],
  '7': ['███████╗', '╚════██║', '    ██╔╝', '   ██╔╝ ', '   ██║  ', '   ╚═╝  '],
  '8': ['██████╗ ', '██╔══██╗', '╚█████╔╝', '██╔══██╗', '╚█████╔╝', ' ╚════╝ '],
  '9': ['██████╗ ', '██╔═══██╗', '╚██████║', ' ╚═══██║', ' █████╔╝', ' ╚════╝ '],
};

const convertToAsciiArt = (text: string): string => {
  const upperText = text.toUpperCase();
  const lines: string[] = ['', '', '', '', '', ''];
  for (const char of upperText) {
    const asciiChar = asciiChars[char] || asciiChars[' '];
    for (let i = 0; i < 6; i++) lines[i] += asciiChar[i] || '   ';
  }
  return lines.join('\n');
};

const KEY_DURATIONS = [
  { label: '1 Hour', value: '1h', ms: 60 * 60 * 1000 },
  { label: '6 Hours', value: '6h', ms: 6 * 60 * 60 * 1000 },
  { label: '24 Hours', value: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: '7 Days', value: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { label: '30 Days', value: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
  { label: 'Permanent', value: 'permanent', ms: 0 },
];

const generateRandomKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const seg = () => Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}-${seg()}`;
};

interface Paste {
  id: string;
  title: string | null;
  slug: string;
}

interface GeneratedKey {
  key: string;
  expiresAt: string | null;
}

interface ManagedKey {
  id: string;
  key_value: string;
  roblox_user_id: string | null;
  expires_at: string | null;
  redeemed_at: string | null;
  created_at: string;
}

interface Panel {
  id: string;
  name: string;
  paste_id: string;
  created_at: string;
}

const STEPS = ['Select Paste', 'Configure Keys', 'Roblox IDs', 'Generate'];

const Dashboard = () => {
  const { toast } = useToast();

  // ── Create tab state ──────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [pastes, setPastes] = useState<Paste[]>([]);
  const [selectedPaste, setSelectedPaste] = useState<string>('');
  const [keySystemName, setKeySystemName] = useState('');
  const [themeColor, setThemeColor] = useState('255, 255, 255');
  const [numKeys, setNumKeys] = useState('10');
  const [duration, setDuration] = useState('permanent');
  const [robloxIds, setRobloxIds] = useState('');
  const [generatedKeys, setGeneratedKeys] = useState<GeneratedKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPastes, setLoadingPastes] = useState(true);
  const [decalId, setDecalId] = useState('');

  // ── Manage tab state ──────────────────────────────────────────────
  const [managePasteId, setManagePasteId] = useState('');
  const [managePanel, setManagePanel] = useState<Panel | null>(null);
  const [manageKeys, setManageKeys] = useState<ManagedKey[]>([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [analytics, setAnalytics] = useState({ total: 0, assigned: 0, executions: 0 });
  const [addKeyCount, setAddKeyCount] = useState('10');
  const [addKeyDuration, setAddKeyDuration] = useState('permanent');
  const [addingKeys, setAddingKeys] = useState(false);
  const [deletingPanel, setDeletingPanel] = useState(false);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState('');
  const [extendDuration, setExtendDuration] = useState('24h');
  const [extendingKey, setExtendingKey] = useState<string | null>(null);

  // ── Fetch pastes ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchPastes = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('pastes').select('id, title, slug').eq('user_id', user.id).order('created_at', { ascending: false });
      setPastes(data || []);
      setLoadingPastes(false);
    };
    fetchPastes();
  }, []);

  // ── Manage: fetch panel + keys + analytics ────────────────────────
  const fetchManageData = useCallback(async (pasteId: string) => {
    if (!pasteId) return;
    setManageLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: panel } = await supabase
        .from('control_panels')
        .select('*')
        .eq('paste_id', pasteId)
        .eq('user_id', user.id)
        .eq('is_keysystem', true)
        .maybeSingle();

      setManagePanel(panel || null);
      if (!panel) { setManageKeys([]); return; }

      const { data: keys } = await supabase
        .from('control_panel_keys')
        .select('*')
        .eq('panel_id', panel.id)
        .order('created_at', { ascending: true });

      const keyList = keys || [];
      setManageKeys(keyList);

      const inputs: Record<string, string> = {};
      keyList.forEach(k => { inputs[k.id] = k.roblox_user_id || ''; });
      setKeyInputs(inputs);

      const { count: execCount } = await supabase
        .from('paste_executions')
        .select('*', { count: 'exact', head: true })
        .eq('paste_id', pasteId);

      setAnalytics({
        total: keyList.length,
        assigned: keyList.filter(k => k.roblox_user_id).length,
        executions: execCount || 0,
      });
    } finally {
      setManageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (managePasteId) fetchManageData(managePasteId);
  }, [managePasteId, fetchManageData]);

  // ── Create: generate key system ───────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedPaste || !keySystemName || !numKeys) {
      toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const count = Math.min(parseInt(numKeys), 500);
      const durationConfig = KEY_DURATIONS.find(d => d.value === duration)!;
      const now = Date.now();
      const selectedPasteObj = pastes.find(p => p.id === selectedPaste);
      const pasteUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-paste?slug=${selectedPasteObj?.slug}`;

      // Use decal ID if provided
      const logoUrl = decalId.trim() || null;

      const keys: GeneratedKey[] = Array.from({ length: count }, () => ({
        key: generateRandomKey(),
        expiresAt: durationConfig.ms > 0 ? new Date(now + durationConfig.ms).toISOString() : null,
      }));

      // Find or create control panel
      let panelId: string;
      const { data: existingPanel } = await supabase
        .from('control_panels')
        .select('id')
        .eq('paste_id', selectedPaste)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingPanel) {
        panelId = existingPanel.id;
        // Update name and logo
        await supabase.from('control_panels').update({ 
          name: keySystemName,
          logo_url: logoUrl 
        }).eq('id', panelId);
      } else {
        const { data: newPanel, error: panelError } = await supabase
          .from('control_panels')
          .insert({ user_id: user.id, name: keySystemName, paste_id: selectedPaste, logo_url: logoUrl, is_keysystem: true })
          .select('id')
          .single();
        if (panelError) throw panelError;
        panelId = newPanel.id;
      }

      const keyInserts = keys.map(k => ({
        panel_id: panelId,
        key_value: k.key,
        expires_at: k.expiresAt,
      }));
      const { error: keysError } = await supabase.from('control_panel_keys').insert(keyInserts);
      if (keysError) throw keysError;

      // Add Roblox user IDs to whitelist
      const robloxIdList = robloxIds
        .split('\n')
        .map(id => id.trim())
        .filter(id => id && /^\d+$/.test(id) && parseInt(id) >= 1000);

      if (robloxIdList.length > 0) {
        const accessInserts = robloxIdList.map(robloxId => ({
          paste_id: selectedPaste,
          roblox_user_id: robloxId,
          access_type: 'whitelist',
          is_eternal: durationConfig.ms === 0,
          expires_at: durationConfig.ms > 0 ? new Date(now + durationConfig.ms).toISOString() : null,
        }));
        await supabase.from('paste_access_control').upsert(accessInserts, { onConflict: 'paste_id,roblox_user_id' });
      }

      await supabase.from('user_activity').insert({
        user_id: user.id,
        activity_type: 'panel_created',
        activity_data: { name: keySystemName, num_keys: count, paste_id: selectedPaste, duration }
      });

      setGeneratedKeys(keys);
      setStep(4);
      toast({ title: "Key System Created!", description: `${count} keys generated and linked to your paste` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Manage: add more keys ─────────────────────────────────────────
  const handleAddMoreKeys = async () => {
    if (!managePanel || !managePasteId) return;
    const count = Math.min(parseInt(addKeyCount) || 0, 500);
    if (count <= 0) return;
    setAddingKeys(true);
    try {
      const durationConfig = KEY_DURATIONS.find(d => d.value === addKeyDuration)!;
      const now = Date.now();
      const newKeys = Array.from({ length: count }, () => ({
        panel_id: managePanel.id,
        key_value: generateRandomKey(),
        expires_at: durationConfig.ms > 0 ? new Date(now + durationConfig.ms).toISOString() : null,
      }));
      const { error } = await supabase.from('control_panel_keys').insert(newKeys);
      if (error) throw error;
      toast({ title: `✅ Added ${count} keys` });
      await fetchManageData(managePasteId);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setAddingKeys(false);
    }
  };

  // ── Manage: assign user ID to key ─────────────────────────────────
  const handleAssignUserId = async (keyId: string) => {
    const userId = (keyInputs[keyId] || '').trim();
    if (userId && !/^\d+$/.test(userId)) {
      toast({ title: "Invalid ID", description: "User ID must be numeric", variant: "destructive" });
      return;
    }
    setSavingKey(keyId);
    try {
      const { error } = await supabase
        .from('control_panel_keys')
        .update({ roblox_user_id: userId || null })
        .eq('id', keyId);
      if (error) throw error;

      // Also add/update paste access control whitelist
      if (userId && managePasteId) {
        await supabase.from('paste_access_control').upsert({
          paste_id: managePasteId,
          roblox_user_id: userId,
          access_type: 'whitelist',
          is_eternal: true,
          expires_at: null,
        }, { onConflict: 'paste_id,roblox_user_id' });
      }

      setManageKeys(prev => prev.map(k => k.id === keyId ? { ...k, roblox_user_id: userId || null } : k));
      setAnalytics(prev => ({
        ...prev,
        assigned: manageKeys.filter(k => k.id === keyId ? !!userId : !!k.roblox_user_id).length,
      }));
      toast({ title: userId ? `Assigned to ${userId}` : "Unassigned", description: userId ? "User added to whitelist" : "Key is now unassigned" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSavingKey(null);
    }
  };

  // ── Manage: delete key ────────────────────────────────────────────
  const handleDeleteKey = async (keyId: string) => {
    try {
      const { error } = await supabase.from('control_panel_keys').delete().eq('id', keyId);
      if (error) throw error;
      setManageKeys(prev => prev.filter(k => k.id !== keyId));
      setAnalytics(prev => ({
        ...prev,
        total: prev.total - 1,
        assigned: prev.assigned - (manageKeys.find(k => k.id === keyId)?.roblox_user_id ? 1 : 0),
      }));
      toast({ title: "Key deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // ── Manage: extend key time ───────────────────────────────────────
  const handleExtendKey = async (keyId: string) => {
    const key = manageKeys.find(k => k.id === keyId);
    if (!key) return;
    setExtendingKey(keyId);
    try {
      const durationConfig = KEY_DURATIONS.find(d => d.value === extendDuration);
      if (!durationConfig || durationConfig.ms === 0) {
        const { error } = await supabase.from('control_panel_keys').update({ expires_at: null }).eq('id', keyId);
        if (error) throw error;
        toast({ title: "Key made permanent" });
      } else {
        const base = key.expires_at && new Date(key.expires_at) > new Date() 
          ? new Date(key.expires_at).getTime() 
          : Date.now();
        const newExpiry = new Date(base + durationConfig.ms).toISOString();
        const { error } = await supabase.from('control_panel_keys').update({ expires_at: newExpiry }).eq('id', keyId);
        if (error) throw error;
        toast({ title: `Extended by ${durationConfig.label}` });
      }
      await fetchManageData(managePasteId);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setExtendingKey(null);
    }
  };

  // ── Manage: delete integration ────────────────────────────────────
  const handleDeleteIntegration = async () => {
    if (!managePanel) return;
    if (!confirm(`Delete the entire "${managePanel.name}" key system? This will delete all ${manageKeys.length} keys. This cannot be undone.`)) return;
    setDeletingPanel(true);
    try {
      await supabase.from('control_panel_keys').delete().eq('panel_id', managePanel.id);
      await supabase.from('control_panels').delete().eq('id', managePanel.id);
      setManagePanel(null);
      setManageKeys([]);
      setAnalytics({ total: 0, assigned: 0, executions: 0 });
      toast({ title: "Integration deleted", description: "Key system removed from this paste" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeletingPanel(false);
    }
  };

  // ── Copy Lua code with current keys ───────────────────────────────
  const copyManageLuaCode = () => {
    const paste = pastes.find(p => p.id === managePasteId);
    if (!paste || !managePanel) return;
    const pasteUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-paste?slug=${paste.slug}`;
    const keyList = manageKeys.map(k => `"${k.key_value}"`).join(', ');
    const asciiText = convertToAsciiArt(managePanel.name);
    const code = generateLuaCode(managePanel.name, asciiText, '255, 255, 255', keyList, pasteUrl);
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: "Lua code copied with current keys and URL" });
  };

  // ── Create: helpers ───────────────────────────────────────────────
  const copyAllKeys = () => {
    navigator.clipboard.writeText(generatedKeys.map(k => k.key).join('\n'));
    toast({ title: "Copied!", description: "All keys copied to clipboard" });
  };

  const downloadKeys = () => {
    const blob = new Blob([generatedKeys.map(k => k.key).join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${keySystemName.replace(/\s+/g, '_')}_keys.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetWizard = () => {
    setStep(0); setSelectedPaste(''); setKeySystemName('');
    setThemeColor('255, 255, 255'); setNumKeys('10');
    setDuration('permanent'); setRobloxIds(''); setGeneratedKeys([]);
    setDecalId('');
  };

  const canProceed = () => {
    if (step === 0) return !!selectedPaste && !!keySystemName;
    if (step === 1) return !!numKeys && parseInt(numKeys) > 0 && !!duration;
    return true;
  };

  const selectedPasteObj = pastes.find(p => p.id === selectedPaste);
  const filteredKeys = manageKeys.filter(k =>
    !searchKey || k.key_value.toLowerCase().includes(searchKey.toLowerCase()) ||
    (k.roblox_user_id || '').includes(searchKey)
  );

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/12 flex items-center justify-center">
            <Zap className="text-primary" size={18} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Key System Generator</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Create and manage key systems linked to your pastes</p>
          </div>
        </div>

        <Tabs defaultValue="create">
          <TabsList className="mb-5 h-9 bg-card/30 border border-primary/10 rounded-lg p-0.5">
            <TabsTrigger value="create" className="gap-1.5 text-xs rounded-md data-[state=active]:bg-primary/15"><Plus size={13} /> Create New</TabsTrigger>
            <TabsTrigger value="manage" className="gap-1.5 text-xs rounded-md data-[state=active]:bg-primary/15"><Settings size={13} /> Manage</TabsTrigger>
          </TabsList>

          {/* ════════════════ CREATE TAB ════════════════ */}
          <TabsContent value="create">
            {/* Step Indicator */}
            {step < 4 && (
              <div className="flex items-center gap-1.5 mb-5">
                {STEPS.map((label, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                      i < step ? 'bg-primary text-primary-foreground' :
                      i === step ? 'bg-primary/15 border border-primary/40 text-primary' :
                      'bg-muted/30 text-muted-foreground'
                    }`}>
                      {i < step ? <Check size={12} /> : i + 1}
                    </div>
                    <span className={`text-[10px] hidden sm:block ${i === step ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{label}</span>
                    {i < STEPS.length - 1 && <div className={`h-px w-5 sm:w-10 ${i < step ? 'bg-primary' : 'bg-primary/10'}`} />}
                  </div>
                ))}
              </div>
            )}

            {/* STEP 0 */}
            {step === 0 && (
              <Card className="p-5 rounded-xl border border-primary/10 bg-card/20 backdrop-blur-xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="text-primary" size={20} />
                  <h2 className="text-lg font-semibold">Link to a Paste</h2>
                </div>
                <div className="space-y-2">
                  <Label>Select Your Paste</Label>
                  {loadingPastes ? (
                    <div className="text-sm text-muted-foreground">Loading pastes...</div>
                  ) : pastes.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-3 border border-border/50 rounded-lg">
                      No pastes found. <a href="/pastebin" className="text-primary underline">Create a paste first</a>.
                    </div>
                  ) : (
                    <Select value={selectedPaste} onValueChange={setSelectedPaste}>
                      <SelectTrigger><SelectValue placeholder="Choose a paste..." /></SelectTrigger>
                      <SelectContent>
                        {pastes.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title || p.slug} <span className="text-muted-foreground text-xs ml-1">/{p.slug}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Key System Name</Label>
                  <Input
                    placeholder="e.g., Wonder World"
                    value={keySystemName}
                    onChange={(e) => setKeySystemName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">First word shows in neon color, rest in bold white</p>
                </div>
                <div className="space-y-2">
                  <Label>UI Theme Color (RGB)</Label>
                  <Input
                    placeholder="e.g., 255, 100, 50"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Roblox Decal ID (Optional)</Label>
                  <Input
                    placeholder="e.g., 12345678"
                    value={decalId}
                    onChange={(e) => setDecalId(e.target.value.replace(/\D/g, ''))}
                  />
                  <p className="text-xs text-muted-foreground">Enter a Roblox decal/image asset ID to show as logo on the key system UI</p>
                  {decalId && (
                    <div className="flex items-center gap-2 p-2 rounded bg-muted/30">
                      <img src={`https://www.roblox.com/asset-thumbnail/image?assetId=${decalId}&width=50&height=50&format=Png`} alt="Decal preview" className="w-8 h-8 rounded object-contain" />
                      <span className="text-xs text-muted-foreground">Decal ID: {decalId}</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* STEP 1 */}
            {step === 1 && (
              <Card className="p-5 rounded-xl border border-primary/10 bg-card/20 backdrop-blur-xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="text-primary" size={20} />
                  <h2 className="text-lg font-semibold">Configure Keys</h2>
                </div>
                <div className="space-y-2">
                  <Label>Number of Keys to Generate</Label>
                  <Input type="number" min="1" max="500" placeholder="e.g., 50" value={numKeys} onChange={(e) => setNumKeys(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Max 500 keys per generation</p>
                </div>
                <div className="space-y-2">
                  <Label>Key Duration</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KEY_DURATIONS.map(d => (
                        <SelectItem key={d.value} value={d.value}>
                          <div className="flex items-center gap-2"><Clock size={14} />{d.label}</div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {duration === 'permanent' ? 'Keys never expire' : `Keys expire after ${KEY_DURATIONS.find(d => d.value === duration)?.label}`}
                  </p>
                </div>
              </Card>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <Card className="p-5 rounded-xl border border-primary/10 bg-card/20 backdrop-blur-xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="text-primary" size={20} />
                  <h2 className="text-lg font-semibold">Whitelist Roblox Users (Optional)</h2>
                </div>
                <div className="space-y-2">
                  <Label>Roblox User IDs</Label>
                  <Textarea
                    placeholder={"123456789\n987654321\n..."}
                    value={robloxIds}
                    onChange={(e) => setRobloxIds(e.target.value)}
                    className="min-h-[150px] font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter one Roblox user ID per line. These users will be added to your paste's whitelist.
                  </p>
                </div>
              </Card>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <Card className="p-5 rounded-xl border border-primary/10 bg-card/20 backdrop-blur-xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="text-primary" size={20} />
                  <h2 className="text-lg font-semibold">Review & Generate</h2>
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    ['Paste', selectedPasteObj?.title || selectedPasteObj?.slug || '—'],
                    ['Key System Name', keySystemName],
                    ['Number of Keys', numKeys],
                    ['Duration', KEY_DURATIONS.find(d => d.value === duration)?.label || ''],
                    ['Whitelisted Users', `${robloxIds.split('\n').filter(id => id.trim() && /^\d+$/.test(id.trim()) && parseInt(id.trim()) >= 1000).length} users`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={handleGenerate} disabled={loading} className="w-full rounded-lg" size="lg">
                  <Zap className="mr-2" size={20} />
                  {loading ? "Generating..." : "Generate Key System"}
                </Button>
              </Card>
            )}

            {/* STEP 4: Results */}
            {step === 4 && (
              <Card className="p-5 rounded-xl border border-primary/10 bg-card/20 backdrop-blur-xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="text-primary" size={20} />
                  <h2 className="text-lg font-semibold text-primary">Key System Created!</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  {generatedKeys.length} keys generated and linked to your paste. The paste URL is automatically embedded in the Lua code.
                </p>
                <div className="flex gap-2">
                  <Button onClick={copyAllKeys} variant="outline" className="flex-1"><Copy className="mr-2" size={16} /> Copy All Keys</Button>
                  <Button onClick={downloadKeys} variant="outline" className="flex-1"><Download className="mr-2" size={16} /> Download Keys</Button>
                </div>
                <div className="max-h-64 overflow-y-auto bg-muted/30 rounded-lg p-3 font-mono text-sm space-y-1">
                  {generatedKeys.map((k, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="text-foreground">{k.key}</span>
                      {k.expiresAt && <span className="text-xs text-muted-foreground">expires {new Date(k.expiresAt).toLocaleDateString()}</span>}
                    </div>
                  ))}
                </div>
                <Button onClick={resetWizard} className="w-full" variant="outline">Create Another Key System</Button>
              </Card>
            )}

            {/* Navigation */}
            {step < 4 && (
              <div className="flex gap-3 mt-4">
                {step > 0 && (
                  <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
                    <ChevronLeft size={16} className="mr-1" /> Back
                  </Button>
                )}
                {step < 3 ? (
                  <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="flex-1 rounded-lg">
                    Next <ChevronRight size={16} className="ml-1" />
                  </Button>
                ) : null}
              </div>
            )}
          </TabsContent>

          {/* ════════════════ MANAGE TAB ════════════════ */}
          <TabsContent value="manage">
            <div className="space-y-5">
              {/* Paste selector */}
              <Card className="p-4 rounded-xl border border-primary/10 bg-card/20 backdrop-blur-xl">
                <Label className="mb-2 block">Select Paste to Manage</Label>
                {loadingPastes ? (
                  <div className="text-sm text-muted-foreground">Loading pastes...</div>
                ) : (
                  <Select value={managePasteId} onValueChange={setManagePasteId}>
                    <SelectTrigger><SelectValue placeholder="Choose a paste..." /></SelectTrigger>
                    <SelectContent>
                      {pastes.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title || p.slug} <span className="text-muted-foreground text-xs ml-1">/{p.slug}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Card>

              {managePasteId && manageLoading && (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading key system data...</div>
              )}

              {managePasteId && !manageLoading && !managePanel && (
                <Card className="p-6 cyber-border bg-card/50 text-center space-y-3">
                  <Key className="mx-auto text-muted-foreground" size={32} />
                  <p className="text-muted-foreground text-sm">No key system linked to this paste yet.</p>
                  <p className="text-xs text-muted-foreground">Go to the <strong>Create New</strong> tab to create one.</p>
                </Card>
              )}

              {managePasteId && !manageLoading && managePanel && (
                <>
                  {/* Panel info + analytics */}
                  <Card className="p-5 cyber-border bg-card/50 backdrop-blur-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">{managePanel.name}</h2>
                        <p className="text-xs text-muted-foreground">Created {new Date(managePanel.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={copyManageLuaCode}>
                          <Copy size={14} className="mr-1" /> Copy Lua
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => fetchManageData(managePasteId)}>
                          <RefreshCw size={14} />
                        </Button>
                      </div>
                    </div>

                    {/* Analytics */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Total Keys', value: analytics.total, icon: Key },
                        { label: 'Assigned', value: analytics.assigned, icon: Users },
                        { label: 'Executions', value: analytics.executions, icon: BarChart2 },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="rounded-lg bg-background/40 border border-border/30 p-3 text-center">
                          <Icon size={18} className="mx-auto mb-1 text-primary" />
                          <div className="text-2xl font-bold">{value}</div>
                          <div className="text-xs text-muted-foreground">{label}</div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Add more keys */}
                  <Card className="p-5 cyber-border bg-card/50 backdrop-blur-xl space-y-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2"><Plus size={16} className="text-primary" /> Add More Keys</h3>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="500"
                        placeholder="Number of keys"
                        value={addKeyCount}
                        onChange={(e) => setAddKeyCount(e.target.value)}
                        className="w-36"
                      />
                      <Select value={addKeyDuration} onValueChange={setAddKeyDuration}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {KEY_DURATIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleAddMoreKeys} disabled={addingKeys} className="rounded-lg">
                        {addingKeys ? '...' : <><Plus size={16} className="mr-1" /> Add</>}
                      </Button>
                    </div>
                  </Card>

                  {/* Key list */}
                  <Card className="p-5 cyber-border bg-card/50 backdrop-blur-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-2"><Key size={16} className="text-primary" /> Keys ({manageKeys.length})</h3>
                      <Input
                        placeholder="Search keys or user IDs..."
                        value={searchKey}
                        onChange={(e) => setSearchKey(e.target.value)}
                        className="w-48 h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {filteredKeys.length === 0 && (
                        <p className="text-center text-muted-foreground text-sm py-4">No keys found.</p>
                      )}
                      {filteredKeys.map((key) => (
                        <div key={key.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/30 border border-border/20">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs truncate text-foreground">{key.key_value}</span>
                              {key.roblox_user_id && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-primary border-primary/30 shrink-0">assigned</Badge>
                              )}
                              {key.expires_at && new Date(key.expires_at) < new Date() && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 text-destructive border-destructive/30 shrink-0">expired</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Input
                                placeholder="Paste Roblox user ID..."
                                value={keyInputs[key.id] ?? (key.roblox_user_id || '')}
                                onChange={(e) => setKeyInputs(prev => ({ ...prev, [key.id]: e.target.value }))}
                                className="h-7 text-xs font-mono flex-1"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                disabled={savingKey === key.id}
                                onClick={() => handleAssignUserId(key.id)}
                              >
                                <Save size={12} />
                              </Button>
                            </div>
                          </div>
                          <div className="text-right shrink-0 space-y-1">
                            {key.expires_at && (
                              <div className="text-[10px] text-muted-foreground">
                                {new Date(key.expires_at) > new Date()
                                  ? `exp ${new Date(key.expires_at).toLocaleDateString()}`
                                  : 'expired'}
                              </div>
                            )}
                            {key.expires_at && (
                              <div className="flex items-center gap-1">
                                <Select value={extendDuration} onValueChange={setExtendDuration}>
                                  <SelectTrigger className="h-6 w-20 text-[10px] px-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {KEY_DURATIONS.map(d => <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-1.5 text-[10px]"
                                  disabled={extendingKey === key.id}
                                  onClick={() => handleExtendKey(key.id)}
                                >
                                  <Timer size={10} className="mr-0.5" />
                                  {extendingKey === key.id ? '...' : '+'}
                                </Button>
                              </div>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteKey(key.id)}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Delete integration */}
                  <Card className="p-5 cyber-border bg-card/50 backdrop-blur-xl border-destructive/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-destructive" />
                        <div>
                          <p className="text-sm font-semibold text-destructive">Delete Key System</p>
                          <p className="text-xs text-muted-foreground">Removes all {manageKeys.length} keys and the integration from this paste.</p>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deletingPanel}
                        onClick={handleDeleteIntegration}
                      >
                        <Trash2 size={14} className="mr-1" />
                        {deletingPanel ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

// ── Lua code generator (v2 - matches server-generated GUI) ─────────
function generateLuaCode(name: string, _asciiText: string, themeColor: string, _keyList: string, pasteUrl: string): string {
  return `-- // ULT Key System v2 - ${name} \\ --
-- Keys are validated server-side. Run this script in your Roblox executor.
-- The key system UI will appear automatically.

loadstring(game:HttpGet("${pasteUrl}"))()
`;
}

export default Dashboard;
