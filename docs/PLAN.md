# Cznnect plan

A private app for one extended family. Small group, simple code, free hosting.

## How it fits together

- **App:** React + TypeScript + Tailwind, built by Vite into plain static files.
- **Hosting:** GitHub Pages (free). A GitHub Action builds the app on every push to `main`.
- **Backend:** Supabase (free plan) for accounts, the database and photo storage. The app talks to it directly from the browser. There is no server of our own.
- **Install on Android:** it is a PWA, so Chrome offers "Install app". It can later be wrapped as an APK with PWABuilder.
- **Maps (stage 3):** Leaflet with OpenStreetMap tiles. No key, no cost.
- **Navigation:** Home, Family Tree, Explore, Plans, My Profile. Tabs are plain state in `App`, with no router.

Vercel was in the suggested stack. GitHub Pages does the same job for a static app and is one account fewer. Moving to Vercel later only means importing the repo.

## Privacy, kept basic

1. You need an account to see anything.
2. You need the family's invite code to join a family.
3. The database enforces it: every table has row-level security, and a row is visible only to members of its family.

The Supabase "anon" key in `src/config.ts` is public by design. The rules above are what protect the data, so every new table must get its own rules. There are no roles beyond owner and member.

## Data model

Every shared table carries a `family_id`, and its rules reuse `is_family_member(family_id)`.

| Stage | Tables | Notes |
|---|---|---|
| 1 | `profiles`, `families`, `family_members` | Profile is created automatically at sign-up. Joining goes through `create_family` and `join_family`. |
| 2 | `people`, `relationships` | A person in the tree does not need an account. `people.claimed_by` links a person to the cousin who is them. Relationships are `parent` and `partner` links; siblings and cousins are worked out from them. |
| 3 | `places`, `visits` | A place has a name, category, lat/lng. A visit is one cousin's date, rating (1 to 5), review, notes. "Who visited" is the list of visits. |
| 4 | extends `visits`, adds `polls`, `poll_options`, `poll_votes` | Restaurant ratings for food, service, atmosphere, value, plus favorite dish. Polls cover "where to eat next" and destinations. |
| 5 | `lists`, `list_items`, `item_votes` | Monthly, yearly, holiday and lifetime lists. Items have an assignee, deadline, done date. A completed item can become a memory. |
| 6 | `posts`, `comments`, `reactions`, `albums`, `album_photos` | Feed, albums, family stories. |
| 7 | `events`, `event_rsvps`, `achievements`, `groups` | Calendar, birthdays (from tree and profiles), challenges, branch groups. |

### Avoiding duplicate relatives (stage 2)

1. Adding a person starts with a search box. Matches by name are shown first.
2. A case-insensitive unique index on name plus birth date stops exact duplicates.
3. A "merge these two people" action moves relationships to one record and deletes the other.

### Photos

One private Supabase Storage bucket, with files stored as `family_id/...`. Storage rules only allow members of that family. The app shrinks photos to about 1600 px before upload so the free storage lasts.

## Stages

1. **Accounts and family space.** Sign up, sign in, create a family, join with an invite code, member list, profile editing, installable app shell. *(done)*
2. **Family tree.** People, relationships, interactive tree with zoom, search, generations. *(done)*
3. **Places and map.** Add places, map, restaurant guide with ratings. *(done; photos come later)*
4. **Polls** to pick the next spot. *(done)*
5. **Bucket lists and to-dos.** *(done, this repo, now)*
6. **Feed, albums, memories.**
7. **Extras.** Calendar, birthdays, trips, challenges, branch groups.
8. **IRL Connect.** Personal QR codes, confirmed meetups, group meetups, points ledger, scoreboard and achievements. *(done)*

## Free plan limits to know about

- Supabase free projects pause after a stretch with no use. If the app stops loading, open the Supabase dashboard and press Restore.
- GitHub Pages needs a public repository on a free account. The code is public, the family data is not.
