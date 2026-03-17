import { supabase, isSupabaseConfigured } from './supabase';

// Fetch metadata for a single community guide by course code
export async function fetchCommunityGuide(courseCode) {
  if (!isSupabaseConfigured() || !courseCode) return null;
  const { data, error } = await supabase
    .from('community_guides')
    .select('course_code, course_name, uploader_name, card_count, question_count, unit_count, updated_at, guide_json')
    .eq('course_code', courseCode.toUpperCase())
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

// Fetch all community guides (metadata only, no guide_json)
export async function fetchAllCommunityGuides() {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('community_guides')
    .select('course_code, course_name, uploader_name, card_count, question_count, unit_count, updated_at')
    .order('course_code');
  if (error) return [];
  return data || [];
}

// Share a guide with the community
export async function shareCommunityGuide(guide, userId, displayName) {
  if (!isSupabaseConfigured() || !userId || !guide?.courseCode) return { error: 'Not configured' };

  const allCards = (guide.units || []).flatMap(u => u.cards || []);
  const questionCount = allCards.length
    + (guide.extraQuestions || []).length
    + (guide.mockPool || []).length
    + (guide.trueFalsePool || []).length
    + (guide.fillInBlankPool || []).length;

  const row = {
    course_code: guide.courseCode.toUpperCase(),
    course_name: guide.courseName || '',
    uploader_id: userId,
    uploader_name: displayName || 'Anonymous',
    card_count: allCards.length,
    question_count: questionCount,
    unit_count: (guide.units || []).length,
    guide_json: guide,
  };

  const { error } = await supabase
    .from('community_guides')
    .upsert(row, { onConflict: 'course_code' });

  return { error: error?.message || null };
}

// Check if a community guide exists for a course code (lightweight, no JSON)
export async function checkCommunityGuide(courseCode) {
  if (!isSupabaseConfigured() || !courseCode) return null;
  const { data, error } = await supabase
    .from('community_guides')
    .select('course_code, course_name, uploader_name, card_count, unit_count, updated_at')
    .eq('course_code', courseCode.toUpperCase())
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
