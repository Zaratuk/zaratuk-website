const DOWNLOADS = {
  'data-health-panel.pbiviz': {
    filePath: '/downloads/data-health-panel.pbiviz',
    product: 'data-health-panel',
    name: 'Data Health Panel'
  },
  'pipeline-health-monitor.pbiviz': {
    filePath: '/downloads/pipeline-health-monitor.pbiviz',
    product: 'pipeline-health-monitor',
    name: 'Pipeline Health Monitor'
  },
  'llm-usage-monitor.mez': {
    filePath: '/downloads/llm-usage-monitor.mez',
    product: 'llm-usage-monitor',
    name: 'LLM Usage Monitor'
  }
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {})
    }
  });
}

function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function incrementCounter(kv, key) {
  const current = Number.parseInt((await kv.get(key)) ?? '0', 10);
  const next = Number.isFinite(current) ? current + 1 : 1;
  await kv.put(key, String(next));
  return next;
}

async function trackDownload(context, download) {
  const { env, request } = context;
  const kv = env.DOWNLOAD_COUNTS;
  const today = getDateKey();

  if (kv) {
    await Promise.all([
      incrementCounter(kv, `downloads:total:${download.product}`),
      incrementCounter(kv, `downloads:daily:${today}:${download.product}`),
      kv.put(`downloads:last:${download.product}`, new Date().toISOString())
    ]);
  }

  if (env.DOWNLOAD_EVENTS) {
    const url = new URL(request.url);
    env.DOWNLOAD_EVENTS.writeDataPoint({
      blobs: [
        download.product,
        download.name,
        request.headers.get('referer') ?? '',
        request.headers.get('user-agent') ?? '',
        url.pathname
      ],
      doubles: [1],
      indexes: [download.product]
    });
  }
}

export async function onRequestGet(context) {
  const { env, params, request, waitUntil } = context;
  const filename = params.filename;
  const download = DOWNLOADS[filename];

  if (!download) {
    return json({ error: 'Unknown download.' }, { status: 404 });
  }

  const assetUrl = new URL(download.filePath, request.url);
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl, request));

  if (!assetResponse.ok) {
    return assetResponse;
  }

  waitUntil(trackDownload(context, download));

  const headers = new Headers(assetResponse.headers);
  headers.set('content-type', 'application/octet-stream');
  headers.set('content-disposition', `attachment; filename="${filename}"`);
  headers.set('cache-control', 'private, no-store');

  return new Response(assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers
  });
}
