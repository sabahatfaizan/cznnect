// The kinds of email Cznnect can send. Every email is sent under exactly one of these, and each person can turn a
// category off for themselves in Settings > Emails. "Important" (account and safety notices) cannot be turned off.
// Keep the ids in step with supabase/functions/send-custom-email/index.ts.
export type EmailCategory = 'important' | 'updates' | 'events' | 'birthdays' | 'plus'

export const EMAIL_CATEGORIES: { id: EmailCategory; label: string; hint: string; required?: boolean }[] = [
  { id: 'important', label: 'Important notices', hint: 'Account and safety messages', required: true },
  { id: 'updates', label: 'App updates', hint: 'New features and changes' },
  { id: 'events', label: 'Events and gatherings', hint: 'Invites and reminders about events' },
  { id: 'birthdays', label: 'Birthdays', hint: 'Birthday reminders and wishes' },
  { id: 'plus', label: 'Cznnect+', hint: 'News and offers about Cznnect+' },
]

// A personal message to one person (Admin > Custom emails > Direct message). It is not a category people can switch off, so it
// is not in the list above and does not show in Settings > Emails.
export const DIRECT = 'direct'
export type EmailKind = EmailCategory | typeof DIRECT

export const categoryLabel = (id: string): string => (id === DIRECT ? 'Direct message' : EMAIL_CATEGORIES.find((c) => c.id === id)?.label ?? id)
