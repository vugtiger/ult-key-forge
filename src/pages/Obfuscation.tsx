import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Lock, Shuffle, Code, Zap, Eye, EyeOff, Copy, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { obfuscateLua, type ObfuscationOptions } from "@/lib/luaObfuscator";

const Obfuscation = () => {
  const { toast } = useToast();
  const [sourceCode, setSourceCode] = useState("");
  const [obfuscatedCode, setObfuscatedCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const [options, setOptions] = useState<ObfuscationOptions>({
    stringEncryption: true,
    variableMangling: true,
    controlFlowFlattening: true,
    deadCodeInjection: true,
    opaquePredicates: true,
    antiTamper: true,
    junkCode: true,
    proxyFunctions: true,
    encryptionStrength: 'maximum',
  });

  const updateOption = (key: keyof ObfuscationOptions, value: boolean | string) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  const handleObfuscate = async () => {
    if (!sourceCode.trim()) {
      toast({
        title: "No Code",
        description: "Please enter Lua code to obfuscate.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + Math.random() * 15, 90));
      }, 100);

      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = obfuscateLua(sourceCode, options);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setObfuscatedCode(result);
      
      toast({
        title: "Obfuscation Complete",
        description: `Code protected with ${Object.values(options).filter(v => v === true).length} layers of security.`,
      });
    } catch (error) {
      toast({
        title: "Obfuscation Failed",
        description: error instanceof Error ? error.message : "An error occurred during obfuscation.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleCopy = async () => {
    if (!obfuscatedCode) return;
    
    await navigator.clipboard.writeText(obfuscatedCode);
    setCopied(true);
    toast({
      title: "Copied",
      description: "Obfuscated code copied to clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const protectionFeatures = [
    { key: 'stringEncryption', icon: Lock, label: 'String Encryption', description: 'XOR-encrypt all string literals with dynamic keys' },
    { key: 'variableMangling', icon: Shuffle, label: 'Variable Mangling', description: 'Replace variable names with unreadable identifiers' },
    { key: 'controlFlowFlattening', icon: Code, label: 'Control Flow Flattening', description: 'Convert code to state machine pattern' },
    { key: 'deadCodeInjection', icon: Zap, label: 'Dead Code Injection', description: 'Insert non-executing code blocks' },
    { key: 'opaquePredicates', icon: Eye, label: 'Opaque Predicates', description: 'Add complex conditions that always evaluate the same' },
    { key: 'antiTamper', icon: Shield, label: 'Anti-Tamper', description: 'Detect and prevent code modification' },
    { key: 'junkCode', icon: AlertTriangle, label: 'Junk Code', description: 'Insert meaningless but valid code throughout' },
  ] as const;

  const enabledCount = Object.entries(options)
    .filter(([key, value]) => key !== 'encryptionStrength' && value === true)
    .length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              Advanced Obfuscator
            </h1>
            <p className="text-muted-foreground mt-1">
              Multi-layer Lua code protection with enterprise-grade security
            </p>
          </div>
          <Badge variant="outline" className="text-primary border-primary">
            {enabledCount} Layers Active
          </Badge>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Settings */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Protection Settings
              </CardTitle>
              <CardDescription>
                Configure obfuscation layers for maximum security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Encryption Strength */}
              <div className="space-y-2">
                <Label>Encryption Strength</Label>
                <Select
                  value={options.encryptionStrength}
                  onValueChange={(value) => updateOption('encryptionStrength', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="strong">Strong</SelectItem>
                    <SelectItem value="maximum">Maximum (Recommended)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Higher strength = more iterations & complexity
                </p>
              </div>

              {/* Protection Features */}
              <div className="space-y-4">
                {protectionFeatures.map(({ key, icon: Icon, label, description }) => (
                  <div key={key} className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <Label htmlFor={key} className="cursor-pointer">
                          {label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={key}
                      checked={options[key as keyof ObfuscationOptions] as boolean}
                      onCheckedChange={(checked) => updateOption(key as keyof ObfuscationOptions, checked)}
                    />
                  </div>
                ))}
              </div>

              {/* Quick Presets */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Quick Presets</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOptions({
                      stringEncryption: true,
                      variableMangling: true,
                      controlFlowFlattening: false,
                      deadCodeInjection: false,
                      opaquePredicates: false,
                      antiTamper: false,
                      junkCode: false,
                      proxyFunctions: false,
                      encryptionStrength: 'standard',
                    })}
                  >
                    Light
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOptions({
                      stringEncryption: true,
                      variableMangling: true,
                      controlFlowFlattening: true,
                      deadCodeInjection: true,
                      opaquePredicates: true,
                      antiTamper: true,
                      junkCode: true,
                      proxyFunctions: true,
                      encryptionStrength: 'maximum',
                    })}
                  >
                    Maximum
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Panel - Code Editor */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Code Editor</CardTitle>
              <CardDescription>
                Paste your Lua code and click obfuscate
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs defaultValue="input" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="input">Source Code</TabsTrigger>
                  <TabsTrigger value="output" disabled={!obfuscatedCode}>
                    Obfuscated Output
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="input" className="mt-4">
                  <Textarea
                    placeholder={`-- Paste your Lua code here
local function myFunction(arg1, arg2)
    local result = arg1 + arg2
    print("Result: " .. result)
    return result
end

myFunction(10, 20)`}
                    value={sourceCode}
                    onChange={(e) => setSourceCode(e.target.value)}
                    className="font-mono text-sm min-h-[400px] bg-muted/50"
                  />
                </TabsContent>

                <TabsContent value="output" className="mt-4">
                  <div className="relative">
                    <Textarea
                      value={obfuscatedCode}
                      readOnly
                      className="font-mono text-sm min-h-[400px] bg-muted/50"
                    />
                    {obfuscatedCode && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              {/* Progress Bar */}
              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Applying {enabledCount} protection layers...
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={handleObfuscate}
                  disabled={isProcessing || !sourceCode.trim()}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Obfuscate Code
                    </>
                  )}
                </Button>
                {obfuscatedCode && (
                  <Button variant="outline" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>

              {/* Stats */}
              {obfuscatedCode && (
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">
                      {sourceCode.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Original Size</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">
                      {obfuscatedCode.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Obfuscated Size</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">
                      {((obfuscatedCode.length / sourceCode.length) * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Size Increase</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Features Info */}
        <Card>
          <CardHeader>
            <CardTitle>Protection Layers Explained</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <Lock className="h-8 w-8 text-primary mb-2" />
                <h3 className="font-semibold">String Encryption</h3>
                <p className="text-sm text-muted-foreground">
                  All strings are XOR-encrypted with dynamic keys, making static analysis impossible.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <Shuffle className="h-8 w-8 text-primary mb-2" />
                <h3 className="font-semibold">Control Flow Flattening</h3>
                <p className="text-sm text-muted-foreground">
                  Code structure is converted to state machines, breaking traditional decompilers.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <Shield className="h-8 w-8 text-primary mb-2" />
                <h3 className="font-semibold">Anti-Tamper</h3>
                <p className="text-sm text-muted-foreground">
                  Runtime checks detect code modification and prevent execution if tampered.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <Eye className="h-8 w-8 text-primary mb-2" />
                <h3 className="font-semibold">Opaque Predicates</h3>
                <p className="text-sm text-muted-foreground">
                  Complex conditions that confuse analysis tools while maintaining functionality.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Obfuscation;
