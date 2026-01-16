import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Users, DollarSign, Gift, Share2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ReferralCode {
  id: string;
  code: string;
  total_referrals: number;
  total_earnings: number;
  created_at: string;
}

interface Referral {
  id: string;
  referred_id: string;
  status: string;
  reward_claimed: boolean;
  created_at: string;
}

const Affiliate = () => {
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user's referral code
      const { data: codes } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (codes) {
        setReferralCode(codes);
      }

      // Fetch referrals
      const { data: refs } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      setReferrals(refs || []);
    } catch (error) {
      console.error('Error fetching referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReferralCode = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Generate unique code
      const code = `ULT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const { data, error } = await supabase
        .from('referral_codes')
        .insert({ user_id: user.id, code })
        .select()
        .single();

      if (error) throw error;

      setReferralCode(data);
      toast.success('Referral code generated!');
    } catch (error) {
      console.error('Error generating code:', error);
      toast.error('Failed to generate referral code');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const referralLink = referralCode 
    ? `${window.location.origin}/auth?ref=${referralCode.code}` 
    : '';

  const stats = [
    { title: "Total Referrals", value: referralCode?.total_referrals || 0, icon: Users, color: "text-blue-500" },
    { title: "Total Earnings", value: `$${(referralCode?.total_earnings || 0).toFixed(2)}`, icon: DollarSign, color: "text-green-500" },
    { title: "Pending Rewards", value: referrals.filter(r => !r.reward_claimed).length, icon: Gift, color: "text-orange-500" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Affiliate Program</h1>
          <p className="text-muted-foreground">Earn rewards by inviting others to ULT LUA</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "..." : stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Referral Code Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Your Referral Link
            </CardTitle>
            <CardDescription>
              Share this link with friends. You earn rewards when they sign up and upgrade!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {referralCode ? (
              <>
                <div className="flex gap-2">
                  <Input value={referralLink} readOnly className="font-mono" />
                  <Button onClick={() => copyToClipboard(referralLink)} variant="outline">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-sm text-muted-foreground">Your code:</span>
                  <Badge variant="secondary" className="font-mono text-lg px-3 py-1">
                    {referralCode.code}
                  </Badge>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => copyToClipboard(referralCode.code)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </>
            ) : (
              <Button onClick={generateReferralCode} disabled={generating}>
                {generating ? "Generating..." : "Generate Referral Code"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Share2 className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">1. Share Your Link</h3>
                <p className="text-sm text-muted-foreground">
                  Share your unique referral link with friends and community
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">2. They Sign Up</h3>
                <p className="text-sm text-muted-foreground">
                  When someone uses your link to create an account
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Gift className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">3. Earn Rewards</h3>
                <p className="text-sm text-muted-foreground">
                  Get 10% of their subscription for the first year!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referrals Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Referrals</CardTitle>
            <CardDescription>Track who signed up using your link</CardDescription>
          </CardHeader>
          <CardContent>
            {referrals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reward</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral) => (
                    <TableRow key={referral.id}>
                      <TableCell>
                        {new Date(referral.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={referral.status === 'active' ? 'default' : 'secondary'}>
                          {referral.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={referral.reward_claimed ? 'outline' : 'default'}>
                          {referral.reward_claimed ? 'Claimed' : 'Pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No referrals yet. Share your link to start earning!
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Affiliate;
