export type AuthMode = 'in' | 'up' | 'reset'

// Keep the reset flow's back action deterministic: reset -> sign-in, not sign-up.
export function nextAuthMode(mode: AuthMode): AuthMode {
  if (mode === 'up' || mode === 'reset') return 'in'
  return 'up'
}

export function isPasswordRecoveryEvent(event: string): boolean {
  return event === 'PASSWORD_RECOVERY'
}
