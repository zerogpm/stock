export async function fetchSearchSuggestions(query) {
  const res = await fetch(`/api/search/${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchStockData(symbol) {
  const res = await fetch(`/api/stock/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`Failed to fetch stock data: ${res.statusText}`);
  return res.json();
}

export async function fetchNews(symbol) {
  const res = await fetch(`/api/news/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`Failed to fetch news: ${res.statusText}`);
  return res.json();
}

export function streamAnalysis(symbol, onChunk, onDone, onError, onPriceTargets, onFairValue, onGeneratingProfile, onProfileGenerated, onPeerComparison) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Analysis request failed: ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            if (data.generatingProfile) {
              onGeneratingProfile?.(data.symbol);
            } else if (data.profileGenerated) {
              onProfileGenerated?.();
            } else if (data.peerComparison) {
              onPeerComparison?.(data.peerComparison);
            } else if (data.fairValue) {
              onFairValue?.(data.fairValue);
            } else if (data.priceTargets) {
              onPriceTargets?.(data.priceTargets);
            } else if (data.done) {
              onDone();
            } else if (data.error) {
              onError(new Error(data.error));
            } else {
              onChunk(data.text);
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') onError(err);
    }
  })();

  return () => controller.abort();
}
