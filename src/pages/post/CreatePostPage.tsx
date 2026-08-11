import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileLayout from '@/components/layouts/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { createPost, uploadImage } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ImagePlus, X, Loader2 } from 'lucide-react';

const CreatePostPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile || !user) { toast.error('Please select an image'); return; }
    setLoading(true);
    try {
      const imageUrl = await uploadImage('posts', imageFile, user.id);
      await createPost(imageUrl, caption.trim() || null);
      toast.success('Post shared!');
      navigate('/home');
    } catch {
      toast.error('Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileLayout>
      <div className="p-4 page-transition">
        <h2 className="text-lg font-bold text-foreground mb-5">Create New Post</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image selector */}
          <div className="relative">
            {imagePreview ? (
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-border bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors">
                <ImagePlus className="w-12 h-12 text-muted-foreground mb-3" />
                <span className="text-sm font-medium text-muted-foreground">Tap to select image</span>
                <span className="text-xs text-muted-foreground mt-1">Max 5MB</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              </label>
            )}
          </div>

          {/* Caption */}
          <div className="space-y-1.5">
            <label className="text-sm font-normal text-foreground">Caption</label>
            <Textarea
              placeholder="Write a caption…"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{caption.length}/500</p>
          </div>

          <Button type="submit" className="w-full h-11 font-semibold" disabled={loading || !imageFile}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sharing…</> : 'Share Post'}
          </Button>
        </form>
      </div>
    </MobileLayout>
  );
};

export default CreatePostPage;
