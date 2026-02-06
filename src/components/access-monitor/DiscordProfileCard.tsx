import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DiscordProfileData {
  discord_user_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  discord_created_at: string | null;
}

interface DiscordProfileCardProps {
  profile: DiscordProfileData;
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

const getDiscordAvatarUrl = (userId: string | null, avatar: string | null) => {
  if (!userId || !avatar) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=128`;
};

const DiscordProfileCard = ({ profile }: DiscordProfileCardProps) => {
  if (!profile.discord_user_id) return null;

  const avatarUrl = getDiscordAvatarUrl(profile.discord_user_id, profile.discord_avatar);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 hover:bg-background/50 rounded px-1 -mx-1 transition-colors">
          <Avatar className="h-5 w-5 border border-[#5865F2]">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="bg-[#5865F2] text-white text-[10px]">
              D
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-[#5865F2]">
            {profile.discord_username || profile.discord_user_id}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-4 space-y-3 bg-gradient-to-b from-[#5865F2]/20 to-transparent">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border-2 border-[#5865F2]">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-[#5865F2] text-white">
                D
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold truncate">
                {profile.discord_username || "Unknown User"}
              </h4>
              <p className="text-xs text-muted-foreground">
                ID: {profile.discord_user_id}
              </p>
            </div>
          </div>

          {/* Account Created */}
          {profile.discord_created_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Account created: {formatDate(profile.discord_created_at)}</span>
            </div>
          )}

          {/* View Profile Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full border-[#5865F2]/50 hover:bg-[#5865F2]/10"
            asChild
          >
            <a
              href={`https://discord.com/users/${profile.discord_user_id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View on Discord
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DiscordProfileCard;
