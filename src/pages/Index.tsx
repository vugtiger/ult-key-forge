import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Key, Shield, Database, Bot, Palette, Save, Zap, Code, MessageSquare, ExternalLink, Sparkles, EyeOff, Clock } from "lucide-react";
import KeySystemPreview from "@/components/KeySystemPreview";
import AIAssistantDemo from "@/components/AIAssistantDemo";
import ReviewsSection from "@/components/ReviewsSection";
import LastUpdatedBadge from "@/components/LastUpdatedBadge";
import LanguageSelector from "@/components/LanguageSelector";
import { useTranslation } from "@/contexts/TranslationContext";
import luaLogo from "@/assets/lua-logo.png";

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  const features = [
    { icon: Key, titleKey: "features.keySystem.title", descKey: "features.keySystem.desc" },
    { icon: Shield, titleKey: "features.userLocked.title", descKey: "features.userLocked.desc" },
    { icon: Database, titleKey: "features.scriptStorage.title", descKey: "features.scriptStorage.desc" },
    { icon: Bot, titleKey: "features.aiAssistant.title", descKey: "features.aiAssistant.desc" },
    { icon: Palette, titleKey: "features.theme.title", descKey: "features.theme.desc" },
    { icon: Save, titleKey: "features.cloud.title", descKey: "features.cloud.desc" },
  ];

  const newFeatures = [
    { icon: EyeOff, titleKey: "newFeatures.hideCode.title", descKey: "newFeatures.hideCode.desc" },
    { icon: Zap, titleKey: "newFeatures.publicProtection.title", descKey: "newFeatures.publicProtection.desc" },
    { icon: Bot, titleKey: "newFeatures.discordPanels.title", descKey: "newFeatures.discordPanels.desc" },
    { icon: Key, titleKey: "newFeatures.expiringKeys.title", descKey: "newFeatures.expiringKeys.desc" },
    { icon: Shield, titleKey: "newFeatures.blacklist.title", descKey: "newFeatures.blacklist.desc" },
    { icon: Clock, titleKey: "newFeatures.whitelistTime.title", descKey: "newFeatures.whitelistTime.desc" },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 grid-bg opacity-30" />
      
      {/* Glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />

      <div className="relative z-10">
        {/* Navigation */}
        <nav className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={luaLogo} alt="Lua Logo" className="h-10 w-10 object-contain" />
            <h2 className="text-2xl font-bold text-foreground">ULT LUA PROTECTS</h2>
            <LastUpdatedBadge />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <a
                href="https://discord.gg/hPywsq3yqw"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-card/50 border border-border rounded-lg hover:bg-card/80 transition-colors cyber-glow"
              >
                <MessageSquare size={18} />
                <span className="hidden sm:inline">{t("nav.discord")}</span>
                <ExternalLink size={14} />
              </a>
              <Button onClick={() => navigate("/auth")} className="cyber-glow">
                {t("nav.signIn")}
              </Button>
            </div>
            <LanguageSelector />
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="text-center mb-20 space-y-6 pt-12">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-4">
              <span className="text-foreground">
                {t("hero.title")}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              {t("hero.subtitle")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield size={16} className="text-foreground" />
                <span>{t("hero.free")}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap size={16} className="text-foreground" />
                <span>{t("hero.unlimited")}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Code size={16} className="text-foreground" />
                <span>{t("hero.ai")}</span>
              </div>
            </div>
            <div className="pt-6">
              <Button 
                size="lg" 
                className="cyber-glow text-lg px-8 py-6"
                onClick={() => navigate("/auth")}
              >
                {t("hero.getStarted")}
                <ArrowRight className="ml-2" size={24} />
              </Button>
            </div>
          </div>

          {/* Features Section */}
          <section className="max-w-6xl mx-auto mb-24">
            <h2 className="text-4xl font-bold text-center mb-4">
              {t("features.title")}
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              {t("features.subtitle")}
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="p-6 cyber-border bg-card/50 backdrop-blur-xl hover:bg-card/70 transition-all group relative"
                >
                  <feature.icon className="w-12 h-12 mb-4 text-foreground group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-semibold mb-2">{t(feature.titleKey)}</h3>
                  <p className="text-muted-foreground">{t(feature.descKey)}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* New Features Section */}
          <section className="max-w-6xl mx-auto mb-24">
            <h2 className="text-4xl font-bold text-center mb-4 flex items-center justify-center gap-3">
              {t("newFeatures.title")}
              <Sparkles className="w-8 h-8 text-primary" />
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              {t("newFeatures.subtitle")}
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {newFeatures.map((feature, index) => (
                <Card
                  key={index}
                  className="p-6 cyber-border bg-card/50 backdrop-blur-xl hover:bg-card/70 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    NEW
                  </div>
                  <feature.icon className="w-12 h-12 mb-4 text-foreground group-hover:scale-110 transition-transform" />
                  <h3 className="text-xl font-semibold mb-2">{t(feature.titleKey)}</h3>
                  <p className="text-muted-foreground">{t(feature.descKey)}</p>
                </Card>
              ))}
            </div>
          </section>

          {/* Key System Preview Section */}
          <section className="max-w-6xl mx-auto mb-24">
            <h2 className="text-4xl font-bold text-center mb-4">
              {t("keyPreview.title")}
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              {t("keyPreview.subtitle")}
            </p>
            <KeySystemPreview />
          </section>

          {/* AI Assistant Preview Section */}
          <section className="max-w-6xl mx-auto mb-24">
            <h2 className="text-4xl font-bold text-center mb-4">
              {t("aiDemo.title")}
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
              {t("aiDemo.subtitle")}
            </p>
            <AIAssistantDemo />
          </section>

          {/* Reviews Section */}
          <ReviewsSection />

          {/* About Section */}
          <section className="max-w-4xl mx-auto mb-24 text-center">
            <h2 className="text-4xl font-bold mb-6">{t("about.title")}</h2>
            <Card className="p-8 cyber-border bg-card/50 backdrop-blur-xl">
              <div className="space-y-6 text-left">
                <p className="text-lg text-muted-foreground">
                  {t("about.intro")}
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-foreground">{t("about.whatWeProvide")}</h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Key size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>{t("about.customKeys")}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Shield size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>{t("about.userIdLocked")}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Database size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>{t("about.cloudScript")}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Bot size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>{t("about.aiPowered")}</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold text-foreground">{t("about.ourPromise")}</h3>
                    <ul className="space-y-2 text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Zap size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>{t("about.freeForever")}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Code size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>{t("about.fullSource")}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Save size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>{t("about.secureCloud")}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Palette size={18} className="text-foreground mt-0.5 flex-shrink-0" />
                        <span>{t("about.fullCustom")}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* CTA Section */}
          <section className="max-w-4xl mx-auto mb-16 text-center">
            <Card className="p-8 cyber-border bg-card/50 backdrop-blur-xl">
              <h2 className="text-3xl font-bold mb-4">{t("cta.title")}</h2>
              <p className="text-muted-foreground mb-6">
                {t("cta.subtitle")}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button
                  onClick={() => navigate("/auth")}
                  className="cyber-glow"
                  size="lg"
                >
                  {t("cta.createAccount")}
                </Button>
                <a
                  href="https://discord.gg/hPywsq3yqw"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="lg" className="gap-2">
                    <MessageSquare size={18} />
                    {t("cta.joinDiscord")}
                  </Button>
                </a>
              </div>
            </Card>
          </section>

          {/* Footer */}
          <footer className="border-t border-border/50 pt-8 pb-4">
            <div className="text-center text-sm text-muted-foreground">
              <p>{t("footer.text")}</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Index;
