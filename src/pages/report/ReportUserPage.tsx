// यूज़र रिपोर्ट पेज — community guidelines के साथ
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { reportUserProfile } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Flag, Loader2, Shield, Users, MessageSquareX, AlertTriangle, Skull } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const REASONS = [
  { id: 'spam', icon: MessageSquareX, label: 'Spam', desc: 'अनचाही messages या promotional content' },
  { id: 'harassment', icon: Users, label: 'Harassment / Bullying', desc: 'किसी को परेशान करना या धमकाना' },
  { id: 'hate_speech', icon: Shield, label: 'Hate Speech', desc: 'नस्ल, धर्म, या समूह के खिलाफ घृणा' },
  { id: 'violence', icon: Skull, label: 'Violence / Threats', desc: 'हिंसा दिखाना या धमकाना' },
  { id: 'fake_account', icon: AlertTriangle, label: 'Fake Account', desc: 'किसी और की पहचान चुराना' },
  { id: 'inappropriate', icon: Flag, label: 'Inappropriate Content', desc: 'Community guidelines का उल्लंघन' },
];

const ReportUserPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason || !user || !userId) return;
    setLoading(true);
    await reportUserProfile(user.id, userId, selectedReason, description.trim());
    setLoading(false);
    setSubmitted(true);
    toast.success('रिपोर्ट submit हुई। हम review करेंगे।');
  };

  if (submitted) {
    return (
      <MobileLayout hideNav>
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
            <Shield className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">रिपोर्ट मिली!</h2>
          <p className="text-muted-foreground text-sm max-w-xs mb-8 text-pretty">
            आपकी रिपोर्ट हमारे admin panel में पहुँच गई है। हम community guidelines के अनुसार action लेंगे।
          </p>
          <Button onClick={() => navigate(-1)} className="rounded-xl font-bold">
            वापस जाएं
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout hideNav>
      <div className="page-transition">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border sticky top-0 bg-background/90 backdrop-blur-sm z-10">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h2 className="font-bold text-foreground text-lg">Account Report करें</h2>
        </div>

        <div className="px-4 py-5 space-y-5">
          {/* Community guidelines note */}
          <div className="rounded-xl p-4 border border-amber-300/40 bg-amber-50/60 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-amber-800 dark:text-amber-400 mb-1">Community Guidelines</p>
                <p className="text-xs text-amber-700 dark:text-amber-400/80 text-pretty leading-relaxed">
                  AR Pixelgram हर user को safe रखना चाहता है। Spam, harassment, hate speech, fake accounts, violence — इनकी अनुमति नहीं है। गलत रिपोर्ट करने पर आपका account suspend हो सकता है।
                </p>
              </div>
            </div>
          </div>

          {/* Reason selection */}
          <div>
            <p className="text-sm font-semibold text-foreground mb-3">रिपोर्ट की वजह चुनें</p>
            <div className="space-y-2">
              {REASONS.map(({ id, icon: Icon, label, desc }) => (
                <button
                  key={id}
                  onClick={() => setSelectedReason(id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all',
                    selectedReason === id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40'
                  )}
                >
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors',
                    selectedReason === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground truncate">{desc}</p>
                  </div>
                  {selectedReason === id && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          {selectedReason && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">अतिरिक्त जानकारी (optional)</label>
              <Textarea
                placeholder="और details बताएं जो हमें review में मदद करें…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                maxLength={300}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{description.length}/300</p>
            </div>
          )}

          <Button
            className="w-full h-12 font-bold rounded-xl text-base"
            style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))', border: 'none', color: 'white' }}
            disabled={!selectedReason || loading}
            onClick={handleSubmit}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Flag className="w-5 h-5 mr-2" />}
            Report Submit करें
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
};

export default ReportUserPage;
