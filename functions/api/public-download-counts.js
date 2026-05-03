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

async function getNumber(kv, key) {
  return Number.parseInt((await kv.get(key)) ?? '0', 10) || 0;
}

export async function onRequestGet({ env }) {
  if (!env.DOWNLOAD_COUNTS) {
    return json(
      {
        error: 'DOWNLOAD_COUNTS KV binding is not configured.'
      },
      { status: 501 }
    );
  }

  const products = await Promise.all(
    PRODUCTS.map(async (product) => ({
      ...product,
      total: await getNumber(env.DOWNLOAD_COUNTS, `downloads:total:${product.key}`)
    }))
  );

  return json({
    generatedAt: new Date().toISOString(),
    products
  });
}
