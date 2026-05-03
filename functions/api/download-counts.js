const PRODUCTS = [
  {
    key: 'data-health-panel',
    name: 'Data Health Panel'
  },
  {
    key: 'pipeline-health-monitor',
    name: 'Pipeline Health Monitor'
  },
  {
    key: 'llm-usage-monitor',
    name: 'LLM Usage Monitor'
  }
];

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

function isAuthorized(request, env) {
  const expectedToken = env.DOWNLOAD_COUNTS_TOKEN;

  if (!expectedToken) {
    return false;
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token');
  const authHeader = request.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  return queryToken === expectedToken || bearerToken === expectedToken;
}

function getDateKey(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date.toISOString().slice(0, 10);
}

async function getNumber(kv, key) {
  return Number.parseInt((await kv.get(key)) ?? '0', 10) || 0;
}

export async function onRequestGet({ env, request }) {
  if (!env.DOWNLOAD_COUNTS) {
    return json(
      {
        error: 'DOWNLOAD_COUNTS KV binding is not configured.'
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
  const requestedDays = Number.parseInt(url.searchParams.get('days') ?? '30', 10);
  const days = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : 30, 1), 90);

  const products = await Promise.all(
    PRODUCTS.map(async (product) => {
      const daily = await Promise.all(
        Array.from({ length: days }, async (_, offset) => {
          const date = getDateKey(offset);
          const count = await getNumber(env.DOWNLOAD_COUNTS, `downloads:daily:${date}:${product.key}`);
          return { date, count };
        })
      );

      daily.reverse();

      return {
        ...product,
        total: await getNumber(env.DOWNLOAD_COUNTS, `downloads:total:${product.key}`),
        lastDownloadAt: await env.DOWNLOAD_COUNTS.get(`downloads:last:${product.key}`),
        daily
      };
    })
  );

  return json({
    generatedAt: new Date().toISOString(),
    days,
    products
  });
}
