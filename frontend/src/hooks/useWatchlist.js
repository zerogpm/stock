import { useState, useCallback } from 'react';

const STORAGE_KEY = 'watchlist';

function readWatchlist() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(readWatchlist);

  const addStock = useCallback((symbol) => {
    const upper = symbol.toUpperCase();
    setWatchlist((prev) => {
      if (prev.includes(upper)) return prev;
      const next = [...prev, upper];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removeStock = useCallback((symbol) => {
    const upper = symbol.toUpperCase();
    setWatchlist((prev) => {
      const next = prev.filter((s) => s !== upper);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isInWatchlist = useCallback((symbol) => {
    return watchlist.includes(symbol?.toUpperCase());
  }, [watchlist]);

  return { watchlist, addStock, removeStock, isInWatchlist };
}
