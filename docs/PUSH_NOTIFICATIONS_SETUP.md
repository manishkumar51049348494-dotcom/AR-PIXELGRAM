# Push Notifications Setup (zaroori)

App band hone par bhi notification aane ke liye VAPID keys set karni padti hain.
Ye keys kahin set nahi thi — isliye ab tak koi push nahi aa raha tha.

## 1. Supabase Edge Function secrets

Supabase project ke Edge Function secrets me ye 3 values daalein:

```
VAPID_PUBLIC_KEY  = BFtDs7LO2x5lNLDAS_FCW2m3zg1FzZuk2QJn7sZh6Bkjd7CWLyvHYK2ic6G3Fo-dnazsv5A5lQ8zx7E3bU5ORBs
VAPID_PRIVATE_KEY = YFke2tTBk4GwJRaHRp-W4C0gKodVmiX8WEoHrN7kzNY
VAPID_SUBJECT     = mailto:noreply@arpixelgram.app
```

CLI se:

```bash
supabase secrets set \
  VAPID_PUBLIC_KEY=BFtDs7LO2x5lNLDAS_FCW2m3zg1FzZuk2QJn7sZh6Bkjd7CWLyvHYK2ic6G3Fo-dnazsv5A5lQ8zx7E3bU5ORBs \
  VAPID_PRIVATE_KEY=YFke2tTBk4GwJRaHRp-W4C0gKodVmiX8WEoHrN7kzNY \
  VAPID_SUBJECT=mailto:noreply@arpixelgram.app
supabase functions deploy send-call-push
```

> PRIVATE key sirf server par rahe. Kabhi frontend me na daalein.
> Public deploy se pehle keys rotate karna behtar hai (`npx web-push generate-vapid-keys`).

## 2. Frontend env

`.env` (aur hosting ke env settings) me:

```
VITE_VAPID_PUBLIC_KEY=BFtDs7LO2x5lNLDAS_FCW2m3zg1FzZuk2QJn7sZh6Bkjd7CWLyvHYK2ic6G3Fo-dnazsv5A5lQ8zx7E3bU5ORBs
```

Iske bina browser subscription nahi banega (`usePushSubscription` skip kar deta hai).

## 3. Migration

`supabase/migrations/00019_call_logs_and_push_types.sql` apply karein:
- `call_logs` table (call duration save hoti hai)
- `notifications.type` me `new_post`, `new_reel`, `new_video` allow

## 4. Ab kis-kis event par push jaata hai

| Event | Push |
|---|---|
| Call (incoming / missed / declined) | pehle se |
| Call end + duration ("Call ended — 2 min 15 sec") | naya |
| Message | haan |
| Post / reel / story like | haan |
| Post / reel comment + comment reply | haan |
| Follow / follow request / follow accepted | haan |
| Story reply | naya |
| Nayi story (followers ko) | haan |
| Naya post / reel / video (followers ko) | naya |
