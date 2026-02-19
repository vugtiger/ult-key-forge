import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Review {
  id: string;
  username: string;
  content: string;
  stars: number;
  is_fake: boolean;
  created_at: string;
  avatarSeed?: string;
  timeAgo?: string;
  platform?: string;
}

// 60+ varied, natural, believable review templates
const fakeReviewTemplates = [
  { content: "been using this for like 2 weeks now and honestly its rly good for what i need", stars: 5 },
  { content: "works perfect for my scripts ngl. key system is easy to setup", stars: 5 },
  { content: "its good but took me a bit to figure out how to setup the paste thing", stars: 4 },
  { content: "the ip tracking feature is actually crazy useful. glad i found this", stars: 5 },
  { content: "finally something that actually works. been looking forever lol", stars: 5 },
  { content: "Discord bot integration is fire. saves me so much time", stars: 5 },
  { content: "Honestly 10/10. The protection keeps my scripts safe from dumpers", stars: 5 },
  { content: "pretty good platform overall. UI could be a bit cleaner but it works well", stars: 4 },
  { content: "love that its free. other sites charge for this stuff", stars: 5 },
  { content: "the keysystem works rly well for my buyers. no complaints", stars: 5 },
  { content: "it's okay i guess. does what it says", stars: 3 },
  { content: "been using since last month and havent had any issues at all", stars: 5 },
  { content: "my whitelist is finally organized properly bc of this lol", stars: 4 },
  { content: "not bad for a free tool honestly. the pastebin protection is nice", stars: 4 },
  { content: "AI assistant actually helped me write better scripts. solid feature", stars: 5 },
  { content: "this slaps. my scripts are actually protected now", stars: 5 },
  { content: "setup was straightforward, been running smooth for weeks", stars: 5 },
  { content: "I like the analytics section - can see whos using my stuff", stars: 5 },
  { content: "the hide code feature is exactly what i needed. tysm", stars: 5 },
  { content: "good tool but sometimes a lil slow to load. still 4 stars tho", stars: 4 },
  { content: "would recommend to anyone making roblox scripts fr", stars: 5 },
  { content: "super useful for managing buyers. the key system is clean", stars: 5 },
  { content: "its not perfect but nothing is. gets the job done tho", stars: 3 },
  { content: "i was skeptical at first but this is genuinely a great tool", stars: 5 },
  { content: "10/10 no cap. the protection actually works unlike other sites", stars: 5 },
  { content: "makes script selling SO much easier. key system is goated", stars: 5 },
  { content: "pretty solid. the discord integration is what sold me on it", stars: 4 },
  { content: "works as advertised. been using for my roblox hub and its great", stars: 5 },
  { content: "tbh didnt expect much but this actually surprised me. good stuff", stars: 4 },
  { content: "the whitelist manager is actually really clean and easy to use", stars: 5 },
  { content: "bro this actually catches dumpers. had one try yesterday and got flagged lol", stars: 5 },
  { content: "its giving what its supposed to give. no bugs so far", stars: 5 },
  { content: "love the changelog feature, keeps me updated on whats new", stars: 4 },
  { content: "solid platform. my scripts been protected for 3 weeks no issues", stars: 5 },
  { content: "took a bit to understand but once you get it its rly powerful", stars: 4 },
  { content: "honestly the best free option out there for this type of thing", stars: 5 },
  { content: "game restriction feature is useful if you only want specific games", stars: 5 },
  { content: "my friend told me about this and im glad he did. works well", stars: 5 },
  { content: "better than i expected. the UI is clean and intuitive", stars: 4 },
  { content: "does exactly what it says. no bs, just works", stars: 5 },
  { content: "the roblox profile tracking is actually insane. love this feature", stars: 5 },
  { content: "havent had a single bypass since switching to this. W platform", stars: 5 },
  { content: "its decent. wish there were more customization options but still good", stars: 3 },
  { content: "clean, fast, and actually secure. what more could you want lol", stars: 5 },
  { content: "i like how the protection updates automatically. saves so much hassle", stars: 5 },
  { content: "highly recommend if youre selling scripts. makes life way easier", stars: 5 },
  { content: "not gonna lie this is actually really solid for what it is", stars: 4 },
  { content: "the keygen is clean. my buyers love having their own keys", stars: 5 },
  { content: "5 stars. does what i need and more. no complaints at all", stars: 5 },
  { content: "been a while since i found a tool this useful. great work", stars: 5 },
  { content: "idk man its pretty good. been using for a month and no problems", stars: 4 },
  { content: "the paste protection is actually genius. cant believe this is free", stars: 5 },
  { content: "works perfectly. set it up in like 10 mins and its been running since", stars: 5 },
  { content: "needed something like this for ages. glad someone finally made it", stars: 5 },
  { content: "literally the best tool for script protection rn. not even close", stars: 5 },
  { content: "its good, not perfect, but definitely one of the better options out there", stars: 4 },
  { content: "have been telling all my friends about this. actually useful", stars: 5 },
  { content: "the security features are crazy good. had multiple bypass attempts fail", stars: 5 },
  { content: "10/10 would use again. already been using for 2 months lol", stars: 5 },
  { content: "setup is simple and the features actually work properly", stars: 5 },
];

const fakeUsernames = [
  "xXScript_ProXx", "lua_dev_fr", "rblx_coder42", "vxd_scripts", "altzy",
  "nullbyte_", "hexcode_rbx", "y4kzii", "codez4life", "sxript",
  "devmode_on", "rbxscripter", "luamaster99", "ult_fan", "codingwizard",
  "x_nulll", "sxulzy", "rbxhub_user", "m1dnight_coder", "skidded_no",
  "actualdev", "exploitfree", "scriptkid_nope", "realcoder_", "v3nom_rbx",
  "ultlua_user", "xXdevXx", "codingisfun3", "scriptify_", "luvs_lua",
  "r3tro_dev", "shadowscript", "phantom_coder", "bytemaster", "zeroday_rbx",
  "lua4ever", "codebreaker_x", "ghostscript", "matrix_coder", "devcraft99",
];

const platforms = ["via Discord", "via Web", "via App", "via Roblox"];

function getTimeAgo(offsetMinutes: number): string {
  if (offsetMinutes < 60) return `${offsetMinutes} min ago`;
  if (offsetMinutes < 1440) return `${Math.floor(offsetMinutes / 60)}h ago`;
  return `${Math.floor(offsetMinutes / 1440)}d ago`;
}

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
    
    // Start fake review rotation with randomized interval (8-15 seconds)
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      const delay = 8000 + Math.random() * 7000; // 8-15 seconds
      timeoutId = setTimeout(() => {
        addFakeReview();
        scheduleNext();
      }, delay);
    };
    scheduleNext();

    return () => clearTimeout(timeoutId);
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
      const enriched = data.map((r: any) => ({
        ...r,
        avatarSeed: r.username,
        timeAgo: getTimeAgo(Math.floor(Math.random() * 2880) + 30),
        platform: platforms[Math.floor(Math.random() * platforms.length)],
      }));
      setReviews(enriched);
    }
  };

  const addFakeReview = () => {
    const template = fakeReviewTemplates[Math.floor(Math.random() * fakeReviewTemplates.length)];
    const baseUsername = fakeUsernames[Math.floor(Math.random() * fakeUsernames.length)];
    // Sometimes append numbers (more realistic)
    const suffix = Math.random() > 0.55 ? '' : (Math.floor(Math.random() * 999) + 1).toString();
    const username = baseUsername + suffix;
    
    // Natural star distribution: 65% five stars, 20% four stars, 10% three, 5% lower
    const rand = Math.random();
    const stars = rand < 0.65 ? 5 : rand < 0.85 ? 4 : rand < 0.95 ? 3 : rand < 0.98 ? 2 : 1;
    const timeOffset = Math.floor(Math.random() * 4320) + 5; // 5min to 3 days ago

    const newFakeReview: Review = {
      id: crypto.randomUUID(),
      username,
      content: template.content,
      stars,
      is_fake: true,
      created_at: new Date().toISOString(),
      avatarSeed: username,
      timeAgo: getTimeAgo(timeOffset),
      platform: platforms[Math.floor(Math.random() * platforms.length)],
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

  const renderStars = (count: number, interactive = false, onSelect?: (n: number) => void) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= count ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'} ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
          onClick={() => interactive && onSelect?.(n)}
        />
      ))}
    </div>
  );

  return (
    <section className="max-w-6xl mx-auto mb-24">
      <h2 className="text-4xl font-bold text-center mb-4">User Reviews</h2>
      <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
        See what our users are saying about ULT CLOUD
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
        className="relative h-[520px] overflow-hidden"
        style={{ perspective: '1000px' }}
      >
        <div className="absolute inset-0 flex flex-col items-center">
          {reviews.slice(0, 6).map((review, index) => {
            const yOffset = index * 92;
            const zOffset = -index * 50;
            const opacity = 1 - (index * 0.14);
            const scale = 1 - (index * 0.04);
            
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
                  {/* Deterministic avatar via DiceBear */}
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(review.avatarSeed || review.username)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`}
                    alt={review.username}
                    className="w-10 h-10 rounded-full bg-muted shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{review.username}</span>
                    {!review.is_fake && (
                          <span className="text-[10px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded">✓ Verified</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {renderStars(review.stars)}
                        {review.platform && (
                          <span className="text-[10px] text-muted-foreground">{review.platform}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{review.content}</p>
                    {review.timeAgo && (
                      <p className="text-[10px] text-muted-foreground mt-1">{review.timeAgo}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        
        {/* Gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
      </div>

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100px) translateZ(0) scale(1.05); opacity: 0; }
          to { transform: translateY(0) translateZ(0) scale(1); opacity: 1; }
        }
      `}</style>
    </section>
  );
};

export default ReviewsSection;
