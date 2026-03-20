import { useState, useCallback, useRef, useEffect } from 'react';
import { streamAnalysis } from '../api/stockApi';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const CACHE_KEY_PREFIX = 'analysis_';

function getCached(symbol) {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + symbol);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.timestamp < CACHE_TTL) return entry;
    localStorage.removeItem(CACHE_KEY_PREFIX + symbol);
    return null;
  } catch { return null; }
}

function setCached(symbol, data) {
  localStorage.setItem(CACHE_KEY_PREFIX + symbol, JSON.stringify({ ...data, timestamp: Date.now() }));
}

export { getCached, setCached };

export function useClaudeStream() {
  const [rawText, setRawText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [cached, setCachedState] = useState(false);
  const [computedTargets, setComputedTargets] = useState(null);
  const [fairValue, setFairValue] = useState(null);
  const [generatingProfile, setGeneratingProfile] = useState(false);
  const [peerComparison, setPeerComparison] = useState(null);
  const cancelRef = useRef(null);
  const rawTextRef = useRef('');

  const loadCachedAnalysis = useCallback((symbol) => {
    const entry = getCached(symbol);
    if (entry) {
      setAnalysis(entry.analysis);
      setComputedTargets(entry.computedTargets ?? null);
      setFairValue(entry.fairValue ?? null);
      setPeerComparison(entry.peerComparison ?? null);
      setError(null);
      setRawText('');
      setCachedState(true);
      setGeneratingProfile(false);
      return true;
    }
    setAnalysis(null);
    setComputedTargets(null);
    setFairValue(null);
    setPeerComparison(null);
    setCachedState(false);
    return false;
  }, []);

  const startAnalysis = useCallback((symbol) => {
    if (cancelRef.current) cancelRef.current();

    setRawText('');
    setAnalysis(null);
    setStreaming(true);
    setError(null);
    setCachedState(false);
    setComputedTargets(null);
    setFairValue(null);
    setPeerComparison(null);
    setGeneratingProfile(false);
    rawTextRef.current = '';

    let targets = null;
    let fv = null;
    let peers = null;
    cancelRef.current = streamAnalysis(
      symbol,
      (chunk) => {
        rawTextRef.current += chunk;
        setRawText(rawTextRef.current);
      },
      () => {
        setStreaming(false);
        setGeneratingProfile(false);
        try {
          // Strip markdown code fences if present
          let text = rawTextRef.current.trim();
          if (text.startsWith('```')) {
            text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          }
          const parsed = JSON.parse(text);
          setAnalysis(parsed);
          setCached(symbol, { analysis: parsed, computedTargets: targets, fairValue: fv, peerComparison: peers });
        } catch {
          setError('Failed to parse Claude response as JSON');
        }
      },
      (err) => {
        setStreaming(false);
        setGeneratingProfile(false);
        setError(err.message);
      },
      (pt) => {
        targets = pt;
        setComputedTargets(pt);
      },
      (fvData) => {
        fv = fvData;
        setFairValue(fvData);
      },
      () => {
        setGeneratingProfile(true);
      },
      () => {
        // Keep discovery loader visible for the entire streaming session.
        // generatingProfile resets in onDone/onError.
      },
      (peerData) => {
        peers = peerData;
        setPeerComparison(peerData);
      }
    );
  }, []);

  useEffect(() => {
    return () => cancelRef.current?.();
  }, []);

  return { rawText, analysis, streaming, error, cached, computedTargets, fairValue, generatingProfile, peerComparison, startAnalysis, loadCachedAnalysis };
}
