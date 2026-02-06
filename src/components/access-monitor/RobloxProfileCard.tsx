import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Calendar, 
  Users, 
  UserPlus, 
  ExternalLink,
  Shield,
  Star,
  Gamepad2
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RobloxGroup {
  id: number;
  name: string;
  role: string;
}

interface RobloxProfileData {
  roblox_user_id: string | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  roblox_avatar_url: string | null;
  roblox_created_at: string | null;
  roblox_description: string | null;
  roblox_is_banned: boolean | null;
  roblox_friends_count: number | null;
  roblox_followers_count: number | null;
  roblox_following_count: number | null;
  roblox_groups: RobloxGroup[] | null;
  roblox_badges: { id: number; name: string }[] | null;
  roblox_favorites: { id: number; name: string }[] | null;
}

interface RobloxProfileCardProps {
  profile: RobloxProfileData;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "Unknown";
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatNumber = (num: number | null) => {
  if (num === null) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const RobloxProfileCard = ({ profile }: RobloxProfileCardProps) => {
  const hasRichData = profile.roblox_username || profile.roblox_avatar_url;

  if (!hasRichData) {
    // Just show basic user ID
    return (
      <div className="flex items-center gap-2">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Roblox ID: {profile.roblox_user_id}
        </span>
        <a
          href={`https://www.roblox.com/users/${profile.roblox_user_id}/profile`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 hover:bg-background/50 rounded px-1 -mx-1 transition-colors">
          <Avatar className="h-6 w-6 border border-border">
            <AvatarImage src={profile.roblox_avatar_url || undefined} />
            <AvatarFallback>
              <User className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            <span className="text-xs font-medium">
              {profile.roblox_display_name || profile.roblox_username}
            </span>
            {profile.roblox_display_name && profile.roblox_username && (
              <span className="text-[10px] text-muted-foreground">
                @{profile.roblox_username}
              </span>
            )}
          </div>
          {profile.roblox_is_banned && (
            <Badge variant="destructive" className="text-[9px] px-1 py-0">
              BANNED
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 border-2 border-primary">
              <AvatarImage src={profile.roblox_avatar_url || undefined} />
              <AvatarFallback>
                <User className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold truncate">
                  {profile.roblox_display_name || profile.roblox_username}
                </h4>
                {profile.roblox_is_banned && (
                  <Badge variant="destructive" className="text-[10px]">
                    BANNED
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                @{profile.roblox_username}
              </p>
              <p className="text-xs text-muted-foreground">
                ID: {profile.roblox_user_id}
              </p>
            </div>
          </div>

          {/* Description */}
          {profile.roblox_description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {profile.roblox_description}
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 rounded bg-background/50">
              <div className="text-sm font-semibold">
                {formatNumber(profile.roblox_friends_count)}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <Users className="h-3 w-3" />
                Friends
              </div>
            </div>
            <div className="p-2 rounded bg-background/50">
              <div className="text-sm font-semibold">
                {formatNumber(profile.roblox_followers_count)}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <UserPlus className="h-3 w-3" />
                Followers
              </div>
            </div>
            <div className="p-2 rounded bg-background/50">
              <div className="text-sm font-semibold">
                {formatNumber(profile.roblox_following_count)}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <User className="h-3 w-3" />
                Following
              </div>
            </div>
          </div>

          {/* Account Age */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Joined: {formatDate(profile.roblox_created_at)}</span>
          </div>

          {/* Groups */}
          {profile.roblox_groups && profile.roblox_groups.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-medium">
                <Shield className="h-3 w-3" />
                Groups ({profile.roblox_groups.length})
              </div>
              <ScrollArea className="h-20">
                <div className="space-y-1">
                  {profile.roblox_groups.slice(0, 5).map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between text-xs bg-background/50 p-1.5 rounded"
                    >
                      <span className="truncate flex-1">{group.name}</span>
                      <Badge variant="outline" className="text-[9px] ml-1">
                        {group.role}
                      </Badge>
                    </div>
                  ))}
                  {profile.roblox_groups.length > 5 && (
                    <p className="text-[10px] text-muted-foreground">
                      +{profile.roblox_groups.length - 5} more groups
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Badges preview */}
          {profile.roblox_badges && profile.roblox_badges.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3" />
              <span>{profile.roblox_badges.length} badges</span>
            </div>
          )}

          {/* Favorites preview */}
          {profile.roblox_favorites && profile.roblox_favorites.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Gamepad2 className="h-3 w-3" />
              <span>{profile.roblox_favorites.length} favorite games</span>
            </div>
          )}

          {/* View Profile Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            asChild
          >
            <a
              href={`https://www.roblox.com/users/${profile.roblox_user_id}/profile`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View on Roblox
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default RobloxProfileCard;
