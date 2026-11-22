// The shape of the Cznnect mark, in a 64 x 64 box: a softly rounded frame (the O) with its opening. The diagonal (the Z)
// is drawn across it, clipped to the outer shape. The in-app logo (Logo.tsx) and the picture drawn for sharing the app
// (ShareAppCard.tsx) both use these, so they cannot drift apart.
export const MARK_OUTER = 'M12 6H52A6 6 0 0 1 58 12V52A6 6 0 0 1 52 58H12A6 6 0 0 1 6 52V12A6 6 0 0 1 12 6Z'
export const MARK_HOLE = 'M19 16A3 3 0 0 0 16 19V45A3 3 0 0 0 19 48H45A3 3 0 0 0 48 45V19A3 3 0 0 0 45 16Z'
