import { Globe, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/TranslationContext";

interface LanguageSelectorProps {
  className?: string;
}

const LanguageSelector = ({ className = "" }: LanguageSelectorProps) => {
  const { currentLang, setLanguage, languages } = useTranslation();
  
  const currentLanguage = languages.find(l => l.code === currentLang) || languages[0];

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 bg-card/50 border-border hover:bg-card">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{currentLanguage.flag} {currentLanguage.name}</span>
            <span className="sm:hidden">{currentLanguage.flag}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 max-h-80 overflow-y-auto bg-popover border-border z-50">
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`cursor-pointer ${currentLang === lang.code ? "bg-accent" : ""}`}
            >
              <span className="mr-2">{lang.flag}</span>
              {lang.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default LanguageSelector;
