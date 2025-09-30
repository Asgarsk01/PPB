# Vercel Deployment Guide

## Environment Variables Required

Create these environment variables in your Vercel dashboard:

```
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
NODE_ENV=production
```

## Deployment Steps

1. Install Vercel CLI: `npm i -g vercel`
2. Login to Vercel: `vercel login`
3. Deploy: `vercel`
4. Set environment variables in Vercel dashboard
5. Redeploy: `vercel --prod`

## Local Testing

- Development: `npm run dev`
- Production build: `npm start`
