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

function getContactStore(env) {
  return env.CONTACT_MESSAGES || env.DOWNLOAD_COUNTS;
}

function getAdminTokens(env) {
  return [env.CONTACT_MESSAGES_TOKEN, env.DOWNLOAD_COUNTS_TOKEN].filter(Boolean);
}

function isAuthorized(request, env) {
  const tokens = getAdminTokens(env);

  if (!tokens.length) {
    return false;
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  const authHeader = request.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  return tokens.some((token) => token === queryToken || token === bearerToken);
}

function clampLimit(value) {
  const parsed = Number.parseInt(value ?? '50', 10);

  if (!Number.isFinite(parsed)) {
    return 50;
  }

  return Math.min(Math.max(parsed, 1), 100);
}

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function toCsv(messages) {
  const columns = ['createdAt', 'name', 'email', 'organization', 'topic', 'message', 'sourcePage', 'referrer'];
  const rows = messages.map((message) => columns.map((column) => escapeCsv(message[column])).join(','));
  return [columns.join(','), ...rows].join('\n');
}

async function readMessages(store, limit) {
  const listed = await store.list({
    prefix: 'contact:message:',
    limit: 1000
  });
  const keys = listed.keys
    .map((key) => key.name)
    .sort()
    .reverse()
    .slice(0, limit);

  const messages = await Promise.all(
    keys.map(async (key) => {
      const value = await store.get(key);

      if (!value) {
        return null;
      }

      try {
        return {
          key,
          ...JSON.parse(value)
        };
      } catch {
        return {
          key,
          createdAt: null,
          parseError: true
        };
      }
    })
  );

  return {
    listComplete: listed.list_complete,
    messages: messages.filter(Boolean)
  };
}

export async function onRequestGet({ request, env }) {
  const store = getContactStore(env);

  if (!store) {
    return json(
      {
        error: 'Contact storage is not configured.'
      },
      { status: 501 }
    );
  }

  if (!isAuthorized(request, env)) {
    return json(
      {
        error: 'Unauthorized.'
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get('limit'));
  const { listComplete, messages } = await readMessages(store, limit);

  if (url.searchParams.get('format') === 'csv') {
    return new Response(toCsv(messages), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="zaratuk-contact-messages.csv"',
        'cache-control': 'no-store'
      }
    });
  }

  return json({
    generatedAt: new Date().toISOString(),
    limit,
    listComplete,
    count: messages.length,
    messages
  });
}
