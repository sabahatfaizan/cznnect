// The app owner. Used for owner-only features: maintenance mode and the Liquid Glass theme.
export const OWNER_EMAIL = 'faizanplayz11@gmail.com'

export function isOwnerEmail(email?: string | null): boolean {
  return (email ?? '').toLowerCase() === OWNER_EMAIL
}
