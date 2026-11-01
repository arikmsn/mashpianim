# Mashpianim — Project Guide

## Overview
UGC creator-brand marketplace. Creators get free products, brands get authentic video content.
Hebrew-first (RTL), pink/rose theme, mobile-first PWA.

## Tech Stack
- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + Framer Motion
- Supabase (PostgreSQL, Auth, Storage, Realtime)
- Vercel hosting
- Cardcom payments (via adapter)
- Claude API (content moderation + product scraping)

## Project Structure
```
app/                    # Next.js application
├── src/
│   ├── app/           # App Router pages
│   │   ├── (auth)/    # Auth pages (login, register)
│   │   ├── (creator)/ # Creator-side pages
│   │   ├── (brand)/   # Brand-side pages
│   │   ├── (admin)/   # Admin dashboard
│   │   └── (marketing)/ # Landing page, about
│   ├── components/    # Shared UI components
│   │   ├── ui/        # Design system primitives
│   │   └── features/  # Feature-specific components
│   ├── lib/           # Utilities, helpers
│   │   ├── supabase/  # Supabase client + types
│   │   ├── adapters/  # Payment, messaging, invoice adapters
│   │   └── moderation/ # Content moderation logic
│   ├── hooks/         # Custom React hooks
│   └── types/         # TypeScript types
docs/                   # Documentation
```

## Conventions
- All UI text in Hebrew
- RTL layout by default
- Adapter pattern for external services (payments, messaging, invoicing)
- RLS on every Supabase table
- Content moderation on all user-generated content (videos, chat, profiles)
- No direct contact info sharing between creators and brands

## Commands
- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — ESLint
