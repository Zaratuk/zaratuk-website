const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;
const MAX_ORGANIZATION_LENGTH = 160;
const MAX_TOPIC_LENGTH = 80;
const MAX_MESSAGE_LENGTH = 4000;
const MIN_MESSAGE_LENGTH = 10;
const RATE_LIMIT = 5;
const RATE_WINDOW_SECONDS = 10 * 60;

const TOPICS = new Set([
  'Custom Power BI visual',
  'Capacity Planner',
  'Product support',
  'Partnership',
  'General question'
]);

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers ?? {})
    }
  });
}

function wantsJson(request) {
  return (request.headers.get('accept') ?? '').includes('application/json');
}

function redirectToContact(status) {
  return new Response(null, {
    status: 303,
    headers: {
      location: `/contact/?contact=${status}`
    }
  });
}

function respond(request, data, init = {}) {
  if (wantsJson(request)) {
    return json(data, init);
  }

  return redirectToContact(init.status && init.status >= 400 ? 'error' : 'sent');
}

function getContactStore(env) {
  return env.CONTACT_MESSAGES || env.DOWNLOAD_COUNTS;
}

function cleanText(value, maxLength) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);
}

function normalizeTopic(value) {
  const topic = cleanText(value, MAX_TOPIC_LENGTH);
  return TOPICS.has(topic) ? topic : 'General question';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getClientIp(request) {
  const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
  return request.headers.get('cf-connecting-ip') || forwardedFor.split(',')[0]?.trim() || 'unknown';
}

async function hashValue(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

async function readPayload(request) {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return request.json();
  }

  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

function validatePayload(payload) {
  const name = cleanText(payload.name, MAX_NAME_LENGTH);
  const email = cleanText(payload.email, MAX_EMAIL_LENGTH).toLowerCase();
  const organization = cleanText(payload.organization, MAX_ORGANIZATION_LENGTH);
  const topic = normalizeTopic(payload.topic);
  const message = cleanText(payload.message, MAX_MESSAGE_LENGTH);
  const companyWebsite = cleanText(payload.companyWebsite || payload.website, 200);
  const sourcePage = cleanText(payload.sourcePage, 300);

  const errors = [];

  if (!name) {
    errors.push('Name is required.');
  }

  if (!email || !isValidEmail(email)) {
    errors.push('A valid email address is required.');
  }

  if (message.length < MIN_MESSAGE_LENGTH) {
    errors.push('Message must be at least 10 characters.');
  }

  return {
    values: {
      name,
      email,
      organization,
      topic,
      message,
      companyWebsite,
      sourcePage
    },
    errors
  };
}

async function checkRateLimit(store, request) {
  const ipHash = await hashValue(getClientIp(request));
  const key = `contact:rate:${ipHash}`;
  const current = Number.parseInt((await store.get(key)) ?? '0', 10) || 0;

  if (current >= RATE_LIMIT) {
    return { allowed: false, ipHash };
  }

  await store.put(key, String(current + 1), {
    expirationTtl: RATE_WINDOW_SECONDS
  });

  return { allowed: true, ipHash };
}

export async function onRequestPost({ request, env }) {
  const store = getContactStore(env);

  if (!store) {
    return respond(
      request,
      {
        ok: false,
        error: 'Contact storage is not configured.'
      },
      { status: 501 }
    );
  }

  let payload;

  try {
    payload = await readPayload(request);
  } catch {
    return respond(
      request,
      {
        ok: false,
        error: 'The contact form could not be read.'
      },
      { status: 400 }
    );
  }

  const { values, errors } = validatePayload(payload);

  if (values.companyWebsite) {
    return respond(request, {
      ok: true,
      message: 'Thanks, your message has been received.'
    });
  }

  if (errors.length) {
    return respond(
      request,
      {
        ok: false,
        errors
      },
      { status: 400 }
    );
  }

  const rateLimit = await checkRateLimit(store, request);

  if (!rateLimit.allowed) {
    return respond(
      request,
      {
        ok: false,
        error: 'Too many messages were sent recently. Please try again in a few minutes.'
      },
      { status: 429 }
    );
  }

  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();
  const key = `contact:message:${createdAt}:${id}`;
  const record = {
    id,
    createdAt,
    name: values.name,
    email: values.email,
    organization: values.organization,
    topic: values.topic,
    message: values.message,
    sourcePage: values.sourcePage,
    userAgent: cleanText(request.headers.get('user-agent'), 300),
    referrer: cleanText(request.headers.get('referer'), 300),
    ipHash: rateLimit.ipHash
  };

  await store.put(key, JSON.stringify(record), {
    metadata: {
      createdAt,
      email: values.email,
      topic: values.topic
    }
  });

  return respond(request, {
    ok: true,
    message: 'Thanks, your message has been received.'
  });
}

export async function onRequestGet() {
  return json(
    {
      ok: false,
      error: 'Use POST to submit the contact form.'
    },
    { status: 405 }
  );
}
