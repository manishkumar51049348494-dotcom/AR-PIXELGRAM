import React, { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { useLanguage, LANGUAGES, type LangCode } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger
} from '@/components/ui/sheet';

interface LanguageSelectorProps {
  compact?: boolean;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ compact = false }) => {
  const { lang, setLang, currentLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleSelect = (code: LangCode) => {
    setLang(code);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 rounded-xl transition-all',
            compact
              ? 'p-2 hover:bg-muted/60'
              : 'px-3 py-2 glass-card hover:bg-muted/60 border border-border'
          )}
        >
          <Globe className="w-4 h-4 text-primary shrink-0" />
          {!compact && (
            <span className="text-sm font-medium text-foreground">
              {currentLanguage.flag} {currentLanguage.nativeName}
            </span>
          )}
          {compact && (
            <span className="text-base">{currentLanguage.flag}</span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[75vh] rounded-t-2xl bg-background">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-center text-lg font-bold gradient-text">
            🌐 भाषा चुनें / Select Language
          </SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-2 gap-2 overflow-y-auto py-2 pb-safe">
          {LANGUAGES.map((language) => {
            const isSelected = lang === language.code;
            return (
              <button
                key={language.code}
                onClick={() => handleSelect(language.code)}
                className={cn(
                  'flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left',
                  isSelected
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-muted/60'
                )}
              >
                <span className="text-2xl shrink-0">{language.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-semibold truncate', isSelected ? 'text-primary' : 'text-foreground')}>
                    {language.nativeName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{language.name}</p>
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default LanguageSelector;
