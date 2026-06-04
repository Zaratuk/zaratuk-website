# Contact Form

The contact page submits messages through Cloudflare Pages Functions.

## How It Works

- The form on `/contact/` posts to `/api/contact`.
- The function validates required fields, applies a small rate limit, and stores submissions in KV.
- Messages are stored under `contact:*` keys.
- The function uses a `CONTACT_MESSAGES` KV binding when available.
- If `CONTACT_MESSAGES` is not configured, it falls back to the existing `DOWNLOAD_COUNTS` KV binding.

## Cloudflare Setup

The deployed site currently has the `DOWNLOAD_COUNTS` KV binding configured, so the form can work without adding another binding.

For a cleaner production setup, create a dedicated KV namespace and add this Pages KV binding:

- Variable name: `CONTACT_MESSAGES`
- Namespace: the contact message KV namespace

For private message retrieval, set one of these secret environment variables:

- `CONTACT_MESSAGES_TOKEN`
- `DOWNLOAD_COUNTS_TOKEN`

The contact admin endpoint accepts either token so the existing download-count admin token can be reused.

## Reading Messages

Use the private admin endpoint:

```text
https://zaratuk.com/api/contact-messages?token=YOUR_TOKEN
```

Limit returned messages:

```text
https://zaratuk.com/api/contact-messages?token=YOUR_TOKEN&limit=25
```

Download CSV:

```text
https://zaratuk.com/api/contact-messages?token=YOUR_TOKEN&format=csv
```

You can also pass the token as a bearer token:

```text
Authorization: Bearer YOUR_TOKEN
```

## Notes

This implementation stores submissions and does not send outbound email by default. That avoids adding a paid email service or another external dependency. Email, Slack, or webhook notifications can be added later by configuring a provider-specific secret and sending notifications from the contact function.
