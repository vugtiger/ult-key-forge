import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Review {
  id: string;
  username: string;
  content: string;
  stars: number;
  is_fake: boolean;
  created_at: string;
  offsetY?: number;
}

const fakeReviewTemplates = [
  { content: "This is exactly what I needed for my Roblox scripts. The key system is so easy to use!", stars: 5 },
  { content: "Amazing platform! Been using it for months and never had any issues.", stars: 5 },
  { content: "The AI assistant is incredibly helpful for generating scripts.", stars: 5 },
  { content: "Great tool for protecting my scripts. Highly recommend!", stars: 5 },
  { content: "Love the customization options. My key system looks professional.", stars: 4 },
  { content: "Very user-friendly interface. Even beginners can use it easily.", stars: 5 },
  { content: "The Discord bot integration is a game changer!", stars: 5 },
  { content: "Free and works perfectly. What more could you ask for?", stars: 5 },
  { content: "Best key system generator out there. Period.", stars: 5 },
  { content: "The pastebin feature with protection is exactly what I was looking for.", stars: 4 },
  { content: "Good platform but could use more features.", stars: 3 },
  { content: "Not bad, but the interface could be better.", stars: 3 },
  { content: "It's okay I guess.", stars: 2 },
  { content: "Works great for my needs!", stars: 5 },
  { content: "Super fast and reliable. Love it!", stars: 5 },
  { content: "The whitelist system is perfect for managing my buyers.", stars: 5 },
  { content: "Clean UI and great functionality.", stars: 4 },
  { content: "Been looking for something like this forever!", stars: 5 },
  { content: "The key generation is instant. Very impressed.", stars: 5 },
  { content: "Excellent customer support on Discord.", stars: 5 },
];

const fakeUsernames = [
  "ScriptMaster", "RobloxDev99", "LuaCoder", "GameHacker2k", "CoolScripter",
  "DevKing", "CodeWizard", "ScriptLord", "RbxPro", "LuaMaster",
  "GameDev123", "ScriptGuru", "ProCoder", "RobloxExpert", "LuaWizard",
  "CodeMaster", "ScriptKing", "DevPro", "GameScripter", "RbxDev"
];

const ReviewsSection = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newReview, setNewReview] = useState("");
  const [selectedStars, setSelectedStars] = useState(5);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchReviews();
    checkAuth();
    
    // Add fake reviews faster (every 8 seconds)
    const interval = setInterval(() => {
      addFakeReview();
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsLoggedIn(!!session);
  };

  const fetchReviews = async () => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setReviews(data.map((r, i) => ({ ...r as Review, offsetY: 0 })));
    }
  };

  const addFakeReview = async () => {
    const template = fakeReviewTemplates[Math.floor(Math.random() * fakeReviewTemplates.length)];
    const username = fakeUsernames[Math.floor(Math.random() * fakeUsernames.length)] + Math.floor(Math.random() * 1000);
    
    // Weight towards good reviews (85% good, 15% bad)
    const shouldBeGood = Math.random() < 0.85;
    const adjustedStars = shouldBeGood ? (Math.random() < 0.7 ? 5 : 4) : template.stars;

    const newFakeReview: Review = {
      id: crypto.randomUUID(),
      username,
      content: template.content,
      stars: adjustedStars,
      is_fake: true,
      created_at: new Date().toISOString(),
      offsetY: 0
    };

    setReviews(prev => [newFakeReview, ...prev.slice(0, 11)]);
  };

  const submitReview = async () => {
    if (!newReview.trim()) {
      toast({ title: "Error", description: "Please write a review", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Error", description: "Please login to submit a review", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      const { error } = await supabase.from('reviews').insert({
        user_id: user.id,
        username: profile?.username || user.email?.split('@')[0] || 'Anonymous',
        content: newReview,
        stars: selectedStars,
        is_fake: false
      });

      if (error) throw error;

      toast({ title: "Success!", description: "Your review has been submitted" });
      setNewReview("");
      fetchReviews();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (count: number, interactive = false, onSelect?: (n: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`h-4 w-4 ${n <= count ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'} ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
            onClick={() => interactive && onSelect?.(n)}
          />
        ))}
      </div>
    );
  };

  return (
    <section className="max-w-6xl mx-auto mb-24">
      <h2 className="text-4xl font-bold text-center mb-4">User Reviews</h2>
      <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
        See what our users are saying about ULT LUA Protects
      </p>

      {/* Submit Review Form */}
      {isLoggedIn && (
        <Card className="p-6 mb-8 cyber-border bg-card/50 backdrop-blur-xl">
          <h3 className="text-lg font-semibold mb-4">Leave a Review</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Your Rating:</span>
              {renderStars(selectedStars, true, setSelectedStars)}
            </div>
            <Textarea
              placeholder="Write your review..."
              value={newReview}
              onChange={(e) => setNewReview(e.target.value)}
              className="min-h-[100px]"
            />
            <Button onClick={submitReview} disabled={submitting} className="cyber-glow">
              {submitting ? "Submitting..." : "Submit Review"}
            </Button>
          </div>
        </Card>
      )}

      {/* 3D Carousel Reviews */}
      <div 
        ref={containerRef}
        className="relative h-[500px] overflow-hidden perspective-1000"
        style={{ perspective: '1000px' }}
      >
        <div className="absolute inset-0 flex flex-col items-center">
          {reviews.slice(0, 6).map((review, index) => {
            const yOffset = index * 90;
            const zOffset = -index * 50;
            const opacity = 1 - (index * 0.15);
            const scale = 1 - (index * 0.05);
            
            return (
              <Card
                key={review.id}
                className="absolute w-full max-w-2xl p-4 cyber-border bg-card/80 backdrop-blur-xl transition-all duration-1000 ease-out"
                style={{
                  transform: `translateY(${yOffset}px) translateZ(${zOffset}px) scale(${scale})`,
                  opacity: Math.max(0, opacity),
                  animation: index === 0 ? 'slideDown 0.8s ease-out' : undefined,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{review.username}</span>
                      {renderStars(review.stars)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{review.content}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        
        {/* Gradient overlays for 3D effect */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100px) translateZ(0) scale(1.1);
            opacity: 0;
          }
          to {
            transform: translateY(0) translateZ(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
};

export default ReviewsSection;