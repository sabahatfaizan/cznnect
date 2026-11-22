// "Send me news and updates by email": the small tick box shown to new people (on the permissions screen in the app, and on the
// sign-up form on the website). It is asked before the account exists, so the choice waits on the device and is applied once
// the new account signs in. Ticked (the default) changes nothing: promo emails flow, and the switches in Settings > Emails still
// work. Unticked turns the four promo categories off for that account. Important notices and direct messages are not promo.
export const PROMO_KEY = 'cznnect-promo-emails'
export const PROMO_CATEGORIES = ['updates', 'events', 'birthdays', 'plus'] as const
const NEW_ACCOUNT_MS = 2 * 24 * 60 * 60 * 1000

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const local = (): Store | null => { try { return localStorage } catch { return null } }

export function readPromoChoice(store: Store | null = local()): boolean {
  try { return store?.getItem(PROMO_KEY) !== '0' } catch { return true }
}

export function savePromoChoice(on: boolean, store: Store | null = local()) {
  try { store?.setItem(PROMO_KEY, on ? '1' : '0') } catch { /* private window: the choice is lost, the default stands */ }
}

/** Applies a waiting choice to a signed-in account. Only a new account takes it (not someone else who signs in on a shared phone). */
export async function applyPromoChoice(
  userId: string,
  accountCreatedAt: string | undefined,
  optOut: (userId: string) => Promise<boolean>,
  store: Store | null = local(),
): Promise<void> {
  let saved: string | null
  try { saved = store?.getItem(PROMO_KEY) ?? null } catch { return }
  if (saved === null) return
  const created = Date.parse(accountCreatedAt ?? '')
  const isNew = Number.isFinite(created) && Date.now() - created < NEW_ACCOUNT_MS
  if (saved === '0' && isNew && !(await optOut(userId))) return // try again next time
  try { store?.removeItem(PROMO_KEY) } catch { /* nothing to clean */ }
}
