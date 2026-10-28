import { supabase } from '../supabase'
import { shownName } from './avatars'

export type ProfileLite = { name: string; avatar: string | null }

// Nickname and avatar for everyone in a family, keyed by user id. Returns an empty map on any
// failure (or before supabase/08_profile.sql is run) so callers just keep the names they already have.
export async function familyProfiles(familyId: string): Promise<Map<string, ProfileLite>> {
  const out = new Map<string, ProfileLite>()
  try {
    const r = await supabase
      .from('family_members')
      .select('user_id, profiles(display_name, nickname, avatar)')
      .eq('family_id', familyId)
    if (r.error) return out
    for (const row of (r.data ?? []) as unknown as {
      user_id: string
      profiles: { display_name: string; nickname: string | null; avatar: string | null } | null
    }[]) {
      if (row.profiles) out.set(row.user_id, { name: shownName(row.profiles), avatar: row.profiles.avatar })
    }
  } catch {
    /* keep the plain names */
  }
  return out
}

// Swap in nicknames and add avatars on anything that has a user_id and a name.
export function withProfiles<T extends { user_id: string; name: string }>(
  list: T[],
  map: Map<string, ProfileLite>,
): (T & { avatar?: string | null })[] {
  return list.map((x) => {
    const p = map.get(x.user_id)
    return p ? { ...x, name: p.name, avatar: p.avatar } : x
  })
}
