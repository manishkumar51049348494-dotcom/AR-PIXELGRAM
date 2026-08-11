// Account Appeal पेज — suspended/locked accounts के लिए
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { submitAppeal, uploadImage } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldAlert, Camera, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_MAP = {
  suspended: { color: 'amber', label: 'Suspended', icon: '⏸️', msg: 'आपका account अस्थायी रूप से निलंबित किया गया है।' },
  locked: { color: 'blue', label: 'Locked', icon: '🔒', msg: 'आपका account समीक्षा के लिए lock किया गया है।' },
  permanently_disabled: { color: 'red', label: 'Permanently Disabled', icon: '🚫', msg: 'आपका account स्थायी रूप से बंद कर दिया गया है।' },
};

const AppealPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [appealText, setAppealText] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const status = profile?.account_status;
  const statusInfo = status && status !== 'active' ? STATUS_MAP[status as keyof typeof STATUS_MAP] : null;

  useEffect(() => {
    if (!status || status === 'active') navigate('/profile');
  }, [status, navigate]);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('5MB से बड़ी photo नहीं'); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!appealText.trim() || !user) return;
    setLoading(true);
    try {
      let photoUrl: string | undefined;
      if (photoFile) photoUrl = await uploadImage('posts', photoFile, user.id);
      await submitAppeal(user.id, appealText.trim(), photoUrl);
      setSubmitted(true);
      toast.success('Appeal submit हुई! Admin review करेंगे।');
    } catch { toast.error('Appeal submit नहीं हुई।'); }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
        <CheckCircle className="w-20 h-20 text-green-500 mb-5" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Appeal मिली!</h2>
        <p className="text-muted-foreground text-sm max-w-xs text-pretty">
          Admin आपकी appeal review करेंगे। जवाब आपकी notifications में आएगा।
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Status Banner */}
      <div className={`px-5 py-6 text-center ${
        status === 'permanently_disabled' ? 'bg-red-50 dark:bg-red-950/40' :
        status === 'locked' ? 'bg-blue-50 dark:bg-blue-950/40' :
        'bg-amber-50 dark:bg-amber-950/40'
      }`}>
        <ShieldAlert className={`w-16 h-16 mx-auto mb-3 ${
          status === 'permanently_disabled' ? 'text-red-500' :
          status === 'locked' ? 'text-blue-500' : 'text-amber-500'
        }`} />
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold mb-2 ${
          status === 'permanently_disabled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
          status === 'locked' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        }`}>
          <span>{statusInfo?.icon}</span>
          <span>Account {statusInfo?.label}</span>
        </div>
        {profile?.username && (
          <p className="font-semibold text-foreground mb-1">@{profile.username}</p>
        )}
        <p className="text-sm text-muted-foreground">{statusInfo?.msg}</p>
        {profile?.status_reason && (
          <p className="text-xs text-muted-foreground mt-1">कारण: {profile.status_reason}</p>
        )}
      </div>

      {/* Appeal Form */}
      <div className="flex-1 p-5 space-y-5">
        <div>
          <h3 className="font-bold text-foreground text-lg mb-1">Appeal Submit करें</h3>
          <p className="text-sm text-muted-foreground text-pretty">
            अपनी बात लिखें। एक ID proof photo भी attach करें तो बेहतर है।
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Appeal Text *</label>
          <Textarea
            placeholder="बताएं कि यह गलत क्यों है, या आपने क्या गलत किया और आगे क्या बदलेंगे…"
            value={appealText}
            onChange={e => setAppealText(e.target.value)}
            rows={6}
            maxLength={800}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{appealText.length}/800</p>
        </div>

        {/* Photo upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Identity Photo (optional)</label>
          {photoPreview ? (
            <div className="relative rounded-xl overflow-hidden aspect-video">
              <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              <button
                onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white text-xs"
              >✕</button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-muted/30 gap-2">
              <Camera className="w-7 h-7 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Photo choose करें</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </label>
          )}
        </div>

        <Button
          className="w-full h-12 font-bold rounded-xl text-base"
          style={{ background: 'linear-gradient(135deg, hsl(var(--p1)), hsl(var(--p2)))', border: 'none', color: 'white' }}
          disabled={!appealText.trim() || loading}
          onClick={handleSubmit}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
          Appeal Submit करें
        </Button>
      </div>
    </div>
  );
};

export default AppealPage;
