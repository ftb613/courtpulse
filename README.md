# CourtPulse — Setup Guide

Everything you need to go live. Follow these steps in order.

---

## Step 1: Create Accounts (5 minutes)

You need three free accounts. Create them now:

1. **GitHub** → https://github.com/signup
2. **Supabase** → https://supabase.com (sign in with your GitHub account)
3. **Vercel** → https://vercel.com (sign in with your GitHub account)

---

## Step 2: Set Up the Database (3 minutes)

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Name it `courtpulse`, pick a password (save it), choose **US East** region
4. Wait 1-2 minutes for it to spin up
5. In the left sidebar, click **SQL Editor**
6. Open the file `supabase-setup.sql` from this folder
7. Copy the ENTIRE contents and paste it into the SQL Editor
8. Click **Run** — you should see "Success" messages
9. In the left sidebar, click **Database** → **Replication**
10. Find and enable these three tables for real-time:
    - `reports`
    - `feed_posts`
    - `chat_messages`

### Get your keys:
1. In Supabase, click **Settings** (gear icon) → **API**
2. Copy the **Project URL** (looks like `https://xxxxx.supabase.co`)
3. Copy the **anon public** key (the long string)
4. Save both — you'll need them in Step 4

---

## Step 3: Push Code to GitHub (3 minutes)

If you don't have Node.js installed, get it first: https://nodejs.org (pick LTS version)

Open your terminal (Mac: Terminal app, Windows: PowerShell) and run these commands one at a time:

```
cd courtpulse
npm install
```

Test it works locally:
```
npm run dev
```

Open http://localhost:5173 in your browser. You should see the app in demo mode. Press Ctrl+C to stop it.

Now push to GitHub:
```
git init
git add .
git commit -m "CourtPulse v1"
```

Go to https://github.com/new and create a new repository called `courtpulse`. Leave it public. Don't check any boxes. Click Create.

GitHub will show you commands. Run the two that look like:
```
git remote add origin https://github.com/YOUR_USERNAME/courtpulse.git
git branch -M main
git push -u origin main
```

---

## Step 4: Deploy to Vercel (2 minutes)

1. Go to https://vercel.com/new
2. It should show your GitHub repos — click **Import** next to `courtpulse`
3. Under **Environment Variables**, add these two:

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | Your Supabase Project URL from Step 2 |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key from Step 2 |

4. Click **Deploy**
5. Wait about 60 seconds
6. Vercel gives you a URL like `courtpulse-xxxxx.vercel.app` — **that's your live app!**

---

## Step 5: Get a Custom Domain (optional, 5 minutes)

1. Go to https://namecheap.com and search for a domain (courtpulse.app, etc.)
2. Buy it (~$12/year)
3. In Vercel → your project → Settings → Domains → Add Domain
4. Follow Vercel's DNS instructions (usually just changing 2 records in Namecheap)
5. SSL is automatic — give it 10-30 minutes to activate

---

## Step 6: Test on Your Phone

1. Open your URL on your phone's browser
2. **iPhone**: Tap the Share button → "Add to Home Screen"
3. **Android**: Tap the menu (three dots) → "Add to Home Screen"
4. The app icon appears on your home screen and opens full-screen

---

## Step 7: Launch at Marine Park

- Share the link with 5-10 regulars first
- Print a QR code (google "QR code generator", paste your URL)
- Tape it to the fence at the courts
- Post in any Marine Park pickleball group chats

---

## Updating the App Later

Whenever you want to make changes:

1. Edit the code files
2. Run these commands:
   ```
   git add .
   git commit -m "describe what you changed"
   git push
   ```
3. Vercel auto-deploys in ~60 seconds. Done.

---

## App Icon

You'll need two PNG images for the PWA:
- `public/icon-192.png` (192x192 pixels)
- `public/icon-512.png` (512x512 pixels)

Create a simple icon with a pickleball paddle emoji or design one at https://canva.com. Place the files in the `public/` folder before deploying.

---

## Questions?

Come back to Claude and share this conversation. I have full context on everything we built and can help with any issues.
