# Mashpianim — Deployment Guide

## Quick Deploy to Vercel (5 minutes)

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** and paste the contents of `app/supabase/migrations/001_initial_schema.sql`
3. Click **Run** to create all tables

### Step 2: Get Supabase Keys
From your Supabase project **Settings > API**:
- `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — service_role key (secret!)

### Step 3: Deploy to Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the `arikmsn/mashpianim` repository
3. Set **Root Directory** to `app`
4. Add these environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |

5. Click **Deploy**

### Step 4 (Optional): WhatsApp OTP
For WhatsApp login to work, set up [GreenAPI](https://green-api.com):
- `GREENAPI_INSTANCE_ID` — Your instance ID
- `GREENAPI_API_TOKEN` — Your API token

Without these, the app works but phone login won't send real OTP codes.

## Demo Mode
The app works WITHOUT any environment variables — all pages show mock data. This lets you preview and demo everything before connecting Supabase.

## What's Included
- 36 routes (12 static pages, 14 API endpoints, 10 dynamic pages)
- Creator + Brand registration flows
- Product management for brands
- Connection lifecycle (apply → approve → ship → film → upload → review → complete)
- Chat with contact info moderation
- Admin dashboard with CMS
- PWA support (installable on mobile)
- Hebrew RTL throughout
