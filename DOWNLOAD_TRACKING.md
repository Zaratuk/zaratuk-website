# Download Tracking

The website tracks product package downloads through Cloudflare Pages Functions.

## How It Works

- Product download links point to `/download/<file>`.
- `functions/download/[filename].js` increments counters, then serves the real file from `public/downloads/`.
- Counts are stored in a Cloudflare KV namespace named `DOWNLOAD_COUNTS`.
- An optional Workers Analytics Engine binding named `DOWNLOAD_EVENTS` can collect event-level records.

## Cloudflare Setup

In the Cloudflare Pages project settings:

1. Create a KV namespace for download counts.
2. Add a Pages KV binding:
   - Variable name: `DOWNLOAD_COUNTS`
   - Namespace: the KV namespace you created
3. Add an environment variable for reading counts:
   - Name: `DOWNLOAD_COUNTS_TOKEN`
   - Value: a long private token
4. Optional: add a Workers Analytics Engine binding:
   - Variable name: `DOWNLOAD_EVENTS`

## Reading Counts

After deployment, request:

```text
https://zaratuk.com/api/download-counts?token=YOUR_TOKEN
```

You can limit the daily window:

```text
https://zaratuk.com/api/download-counts?token=YOUR_TOKEN&days=7
```

The endpoint returns totals and daily counts for:

- Data Health Panel
- Pipeline Health Monitor
- LLM Usage Monitor

## Notes

KV counters are simple and good enough for low-volume product downloads. Under very high concurrent download traffic, KV read-modify-write counters can be approximate. For event-level analytics, use the optional `DOWNLOAD_EVENTS` Analytics Engine binding.
