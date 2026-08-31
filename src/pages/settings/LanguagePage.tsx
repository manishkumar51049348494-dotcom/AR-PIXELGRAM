import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { useLanguage, LANGUAGES, type LangCode } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const LanguagePage: React.FC = () => {
  const navigate = useNavigate();
  const { lang, setLang, currentLanguage } = useLanguage();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      l =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelect = (code: LangCode, name: string) => {
    setLang(code);
    toast.success(`${name} selected`);
  };

  return (
    <MobileLayout>
      <div className="page-transition pb-24">
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border px-3 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/60"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h2 className="text-base font-bold text-foreground">Language / भाषा</h2>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search language..."
              className="pl-9 rounded-full"
            />
          </div>
        </div>

        <div className="px-4 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Current</p>
          <div className="flex items-center gap-3 glass-card rounded-xl px-4 py-3 mb-5">
            <span className="text-2xl">{currentLanguage.flag}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{currentLanguage.nativeName}</p>
              <p className="text-xs text-muted-foreground truncate">{currentLanguage.name}</p>
            </div>
            <Check className="w-4 h-4 text-primary" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">All languages</p>
          <div className="space-y-1.5">
            {filtered.map(language => {
              const isSelected = lang === language.code;
              return (
                <button
                  key={language.code}
                  onClick={() => handleSelect(language.code, language.name)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left',
                    isSelected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60'
                  )}
                >
                  <span className="text-xl shrink-0">{language.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium truncate', isSelected ? 'text-primary' : 'text-foreground')}>
                      {language.nativeName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{language.name}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No language found</p>
            )}
          </div>
        </div>
      </div>
    </MobileLayout>
  );
};

export default LanguagePage;
