import { useState, useEffect } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { checkCommunityGuide, fetchCommunityGuide } from '../lib/communityGuides';
import { putGuide } from '../lib/indexedDB';
import { updateGuideIndex } from '../lib/guideIndex';
import { pushGuideToSupabase } from '../lib/sync';

export function useCommunityGuide(courseCode, userId) {
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
      window.dispatchEvent(new Event('studyhub-guides-updated'));
      // Push to user's Supabase for cross-device sync
      if (userId) {
        pushGuideToSupabase(userId, guide).catch(() => {});
      }
      setInstalling(false);
      return guide;
    } catch {
      setInstalling(false);
      return null;
    }
  }

  return { communityGuide: meta, loading, installing, loadGuide };
}
