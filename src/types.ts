export type Family = {
  id: string
  name: string
  invite_code: string
}

export type FamilyRole = 'owner' | 'moderator' | 'member'

export type Member = {
  user_id: string
  role: FamilyRole
  profiles: { display_name: string; nickname: string | null; bio: string | null; avatar: string | null; title?: string | null } | null
}
