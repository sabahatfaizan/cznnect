# Cznnect

A private app for one family of cousins. This is **stage 1**: accounts, a family space with an invite code, member list, profile editing, and the five-tab app shell. The other tabs show what is coming. The full plan is in [docs/PLAN.md](docs/PLAN.md).

## Where things live

```
index.html                 page shell, fonts, app icon links
src/config.ts              YOUR Supabase URL and key go here
src/App.tsx                signed out or signed in?
src/Authed.tsx             finds your family, or asks you to start or join one
src/components/            AuthScreen, FamilySetup, Shell (bottom tabs), Logo, Icons
src/pages/                 Home, Profile, ComingSoon (placeholder tabs)
src/index.css              colors, fonts, shared button and card styles
public/                    manifest, offline service worker, app icons
supabase/01_accounts.sql   the database for this stage
.github/workflows/         builds and publishes the site on every push to main
docs/PLAN.md              architecture, data model, stages
```

## Set it up (about 15 minutes, all doable on a phone)

**1. Supabase (the database)**

1. Sign up at [supabase.com](https://supabase.com) and create a free project. Pick a region near you.
2. Authentication > Sign In / Providers > Email: turn **Confirm email** off. Otherwise each cousin has to wait for a confirmation email, and the free email limit is very small.
3. SQL Editor > New query. Open `supabase/01_accounts.sql` in this repo, copy all of it, paste it in, and press **Run**. It should say success.
4. Project Settings > API: copy the **Project URL** and the **anon / publishable key**.
5. Run `supabase/02_member_management.sql` the same way (new query, paste, Run). It adds the owner tools: remove a member, leave a family, and get a new invite code.
6. Run `supabase/03_family_settings.sql` the same way. It enables owner-only family-name changes and checks permissions in the database.
7. Run `supabase/04_family_tree.sql` the same way. It adds the family tree.
8. Run `supabase/05_places.sql` the same way. It adds places, the map and ratings.

**2. Put the keys in the app**

1. In this repo on GitHub, open `src/config.ts` and tap the pencil icon.
2. Replace `PASTE_YOUR_PROJECT_URL` and `PASTE_YOUR_ANON_KEY`, then commit. The anon key is safe to be public, because the privacy rules in the SQL protect your data.

**3. Publish it**

1. Repo Settings > Pages > Source: choose **GitHub Actions**.
2. Open the **Actions** tab. A run called "Deploy to GitHub Pages" starts after every commit. When it turns green, the site is live at `https://YOUR-USERNAME.github.io/REPO-NAME/`.
3. If a run fails, open it and tap the failed step. The message there tells us what to fix.

**4. Test it**

1. Open the site. Create an account, then create a family.
2. Copy the invite from Home.
3. In a private browser tab, create a second account and join with the code.
4. Both people should now see each other in Family members.
5. In Chrome, menu > **Install app** (or Add to Home screen).

## Run it on a computer (optional)

```
npm install
npm run dev
npm run typecheck
```

## Who can do what

- **Owner** (the person who created the family): rename the family, remove members, and get a new invite code. The owner cannot be removed and cannot leave.
- **Member**: see everyone in the family, edit their own profile, leave the family.
- **Family tree:** every member can add and edit people, link relatives, and merge duplicates. Anyone can delete an entry or link they created; the owner can delete any. Each cousin can link their account to their own spot ("Add me" or "I am already here").
- **Explore (places, map, restaurants):** every member can add, edit and rate places. Each person has one rating per place and can change or remove their own. Anyone can remove a place they added; the owner can remove any. Searching an address uses OpenStreetMap's free search, and the map uses OpenStreetMap tiles. No account or key is needed.
- Adding people to the family is done with the invite code. A removed person can only rejoin with the code, so get a new one after removing someone.

## Next

Stages 2 (family tree) and 3 (places, map, restaurants) are in. Stage 4 is polls to pick the next spot, and bucket lists. Profile photos come after storage is set up.

## Themes

Cznnect has two looks: **Light** (default) and **Tactical Dark**. Pick one, or follow the phone's setting, in My Profile > Appearance. The choice is saved on the device. Colors and shapes for both live as tokens at the top of `src/index.css`, and the switching code is `src/theme.ts`.
