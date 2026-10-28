export type Family = {
  id: string
  name: string
  invite_code: string
}

export type Member = {
  user_id: string
  role: 'owner' | 'member'
  profiles: { display_name: string; nickname: string | null; bio: string | null; avatar: string | null } | null
}
