import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Crown, Zap, Shield, Sparkles } from "lucide-react";

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  features: string[];
  stripe_price_id: string | null;
  is_active: boolean;
}

interface UserSubscription {
  id: string;
  tier_id: string;
  status: string;
  current_period_end: string | null;
}

const Premium = () => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [userSubscription, setUserSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch subscription tiers
      const { data: tiersData } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      // Parse features from JSONB
      const parsed: SubscriptionTier[] = tiersData?.map(tier => ({
        id: tier.id,
        name: tier.name,
        price: Number(tier.price),
        stripe_price_id: tier.stripe_price_id,
        is_active: tier.is_active ?? true,
        features: Array.isArray(tier.features) 
          ? tier.features.map(f => String(f)) 
          : []
      })) || [];

      setTiers(parsed);

      // Fetch user's subscription if logged in
      if (user) {
        const { data: subData } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (subData) {
          setUserSubscription(subData);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (tier.price === 0) {
      toast.info("You're already on the Free tier!");
      return;
    }
    
    // For now, show coming soon message
    // When Stripe is enabled, this will redirect to checkout
    toast.info('Premium subscriptions coming soon! We\'re setting up payment processing.');
  };

  const getTierIcon = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'free':
        return <Zap className="h-6 w-6" />;
      case 'pro':
        return <Crown className="h-6 w-6 text-yellow-500" />;
      case 'enterprise':
        return <Shield className="h-6 w-6 text-purple-500" />;
      default:
        return <Sparkles className="h-6 w-6" />;
    }
  };

  const isCurrentTier = (tierId: string) => {
    return userSubscription?.tier_id === tierId && userSubscription?.status === 'active';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Crown className="h-8 w-8 text-yellow-500" />
            Premium Plans
          </h1>
          <p className="text-muted-foreground mt-2">
            Unlock more features and take your scripts to the next level
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded w-1/3 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="h-4 bg-muted rounded w-3/4" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tiers.map((tier, index) => {
              const isPopular = tier.name.toLowerCase() === 'pro';
              const isCurrent = isCurrentTier(tier.id);

              return (
                <Card 
                  key={tier.id} 
                  className={`relative ${isPopular ? 'border-primary shadow-lg scale-105' : ''}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary">Most Popular</Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pt-8">
                    <div className="mx-auto mb-2">
                      {getTierIcon(tier.name)}
                    </div>
                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                    <CardDescription>
                      <span className="text-3xl font-bold text-foreground">
                        ${tier.price}
                      </span>
                      {tier.price > 0 && <span className="text-muted-foreground">/month</span>}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <ul className="space-y-3">
                      {tier.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button 
                      className="w-full" 
                      variant={isPopular ? 'default' : 'outline'}
                      disabled={isCurrent}
                      onClick={() => handleSubscribe(tier)}
                    >
                      {isCurrent 
                        ? 'Current Plan' 
                        : tier.price === 0 
                          ? 'Current Tier' 
                          : 'Get Started'
                      }
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Features Comparison */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Why Go Premium?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Unlimited Pastes</h3>
                <p className="text-sm text-muted-foreground">
                  Create as many protected scripts as you need
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Advanced Protection</h3>
                <p className="text-sm text-muted-foreground">
                  Extra layers of obfuscation and security
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Crown className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">Priority Support</h3>
                <p className="text-sm text-muted-foreground">
                  Get help faster from our dedicated team
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Premium;
