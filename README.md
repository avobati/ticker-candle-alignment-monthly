# Ticker Candle Alignment Monthly

This Next.js dashboard compares weekly and monthly UT Bot signals for the full
ticker universe. Production data is stored in Neon and served by Vercel.

## Automatic Refresh

The `Daily signal refresh` GitHub Actions workflow runs every day at
`01:07 UTC`:

- `11:07 AEST` during Sydney winter
- `12:07 AEDT` during Sydney daylight saving

That is approximately one hour after the `00:00 UTC` daily candle boundary.
The schedule runs on GitHub-hosted infrastructure, so it does not depend on a
user laptop or Codex credits.

The workflow scans all 11,054 symbols, rejects incomplete scans or provider
failure rates above 5%, and publishes all 22,108 weekly/monthly rows to Neon in
one transaction. Failed refreshes leave the previous successful production run
unchanged.

The ongoing weekly candle is included in calculations. A signal occurring on
that candle is reported as `candlesAgo = 0`.

### Required Secret

The GitHub repository must contain an Actions secret named `DATABASE_URL`.
Never commit the connection string.

### Manual Refresh

Open the repository's **Actions** tab, select **Daily signal refresh**, and use
**Run workflow**. The workflow verifies both Neon and the production Vercel API
before reporting success.

The workflow creates an empty `[skip ci]` maintenance commit on the first UTC
day of each month. This prevents GitHub from disabling scheduled workflows
after 60 days of inactivity in a public repository.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
