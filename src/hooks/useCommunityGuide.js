import { useState, useEffect } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { checkCommunityGuide, fetchCommunityGuide } from '../lib/communityGuides';
import { putGuide } from '../lib/indexedDB';
import { updateGuideIndex } from '../lib/guideIndex';

export function useCommunityGuide(courseCode) {
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!courseCode || !isSupabaseConfigured()) return;
    let cancelled = false;
    setLoading(true);
    checkCommunityGuide(courseCode).then(data => {
      if (!cancelled) {
        setMeta(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [courseCode]);

  async function loadGuide() {
    if (!courseCode) return null;
    setInstalling(true);
    try {
      const data = await fetchCommunityGuide(courseCode);
      if (!data?.guide_json) { setInstalling(false); return null; }
      const guide = data.guide_json;
      await putGuide(guide);
      updateGuideIndex(guide);
      setInstalling(false);
      return guide;
    } catch {
      setInstalling(false);
      return null;
    }
  }

  return { communityGuide: meta, loading, installing, loadGuide };
}
