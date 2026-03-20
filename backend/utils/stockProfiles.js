import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GetCommand, PutCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../services/dynamodb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROFILES_PATH = join(__dirname, '..', 'data', 'stockProfiles.json');

// In-memory fallback flag — set once on first DynamoDB failure
let useFallback = false;
let fallbackCache = null;

function loadFallbackProfiles() {
  if (!fallbackCache) {
    fallbackCache = JSON.parse(readFileSync(PROFILES_PATH, 'utf-8'));
  }
  return fallbackCache;
}

// --- DynamoDB helpers ---

async function getItem(pk) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { pk, sk: 'PROFILE' },
  }));
  return result.Item || null;
}

async function putItem(item) {
  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: { ...item, sk: 'PROFILE' },
  }));
}

async function deleteItem(pk) {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { pk, sk: 'PROFILE' },
  }));
}

async function scanAll() {
  const items = [];
  let lastKey;
  do {
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

// --- Public API (same signatures as before) ---

export async function loadProfiles() {
  if (useFallback) return loadFallbackProfiles();

  try {
    const items = await scanAll();
    const profiles = { industries: {}, tickers: {} };

    for (const item of items) {
      const { pk, sk, type, name, symbol, ...data } = item;
      if (type === 'industry') {
        profiles.industries[name] = data;
      } else if (type === 'ticker') {
        profiles.tickers[symbol] = data;
      }
    }

    return profiles;
  } catch (err) {
    console.warn('DynamoDB unavailable, falling back to JSON file:', err.message);
    useFallback = true;
    return loadFallbackProfiles();
  }
}

export async function saveProfiles(data) {
  if (useFallback) {
    writeFileSync(PROFILES_PATH, JSON.stringify(data, null, 2));
    fallbackCache = data;
    return;
  }

  try {
    // Write all industry profiles
    for (const [name, profile] of Object.entries(data.industries)) {
      await putItem({
        pk: `INDUSTRY#${name}`,
        type: 'industry',
        name,
        ...profile,
      });
    }

    // Write all ticker profiles
    for (const [symbol, profile] of Object.entries(data.tickers)) {
      await putItem({
        pk: `TICKER#${symbol}`,
        type: 'ticker',
        symbol,
        ...profile,
      });
    }
  } catch (err) {
    console.warn('DynamoDB write failed, falling back to JSON file:', err.message);
    useFallback = true;
    writeFileSync(PROFILES_PATH, JSON.stringify(data, null, 2));
    fallbackCache = data;
  }
}

export function invalidateCache() {
  fallbackCache = null;
  // Note: useFallback is intentionally NOT reset here.
  // DynamoDB availability doesn't change during a process lifecycle.
  // To force a re-check (e.g., after starting DynamoDB), restart the server.
}

// Force JSON fallback mode (for tests that need to read the current JSON file)
export function forceFallback() {
  useFallback = true;
  fallbackCache = null;
}

export async function getStockProfile(symbol, yahooIndustry) {
  if (useFallback) {
    return getStockProfileFromData(loadFallbackProfiles(), symbol, yahooIndustry);
  }

  try {
    const upperSymbol = symbol.toUpperCase();

    const tickerItem = await getItem(`TICKER#${upperSymbol}`);
    const tickerProfile = tickerItem
      ? (() => { const { pk, sk, type, symbol: _s, ...rest } = tickerItem; return rest; })()
      : null;

    const industryKey = tickerProfile?.industry || yahooIndustry || null;

    let industryProfile = null;
    if (industryKey) {
      const industryItem = await getItem(`INDUSTRY#${industryKey}`);
      if (industryItem) {
        const { pk, sk, type, name, ...rest } = industryItem;
        industryProfile = rest;
      }
    }

    if (!industryProfile && !tickerProfile) return null;

    return mergeProfiles(industryProfile, tickerProfile, industryKey);
  } catch (err) {
    console.warn('DynamoDB unavailable, falling back to JSON file:', err.message);
    useFallback = true;
    return getStockProfileFromData(loadFallbackProfiles(), symbol, yahooIndustry);
  }
}

// --- Profile CRUD helpers for routes ---

export async function getIndustryProfile(key) {
  if (useFallback) {
    const profiles = loadFallbackProfiles();
    return profiles.industries[key] || null;
  }
  try {
    const item = await getItem(`INDUSTRY#${key}`);
    if (!item) return null;
    const { pk, sk, type, name, ...rest } = item;
    return rest;
  } catch (err) {
    console.warn('DynamoDB read failed:', err.message);
    useFallback = true;
    return loadFallbackProfiles().industries[key] || null;
  }
}

export async function getTickerProfile(symbol) {
  if (useFallback) {
    const profiles = loadFallbackProfiles();
    return profiles.tickers[symbol.toUpperCase()] || null;
  }
  try {
    const item = await getItem(`TICKER#${symbol.toUpperCase()}`);
    if (!item) return null;
    const { pk, sk, type, symbol: _s, ...rest } = item;
    return rest;
  } catch (err) {
    console.warn('DynamoDB read failed:', err.message);
    useFallback = true;
    return loadFallbackProfiles().tickers[symbol.toUpperCase()] || null;
  }
}

export async function putIndustryProfile(key, data) {
  if (useFallback) {
    const profiles = loadFallbackProfiles();
    profiles.industries[key] = { ...profiles.industries[key], ...data };
    writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
    fallbackCache = profiles;
    return profiles.industries[key];
  }
  const merged = { ...((await getIndustryProfile(key)) || {}), ...data };
  await putItem({ pk: `INDUSTRY#${key}`, type: 'industry', name: key, ...merged });
  return merged;
}

export async function putTickerProfile(symbol, data) {
  const upper = symbol.toUpperCase();
  if (useFallback) {
    const profiles = loadFallbackProfiles();
    profiles.tickers[upper] = { ...profiles.tickers[upper], ...data };
    writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
    fallbackCache = profiles;
    return profiles.tickers[upper];
  }
  const merged = { ...((await getTickerProfile(upper)) || {}), ...data };
  await putItem({ pk: `TICKER#${upper}`, type: 'ticker', symbol: upper, ...merged });
  return merged;
}

export async function deleteIndustryProfile(key) {
  if (useFallback) {
    const profiles = loadFallbackProfiles();
    if (!profiles.industries[key]) return false;
    delete profiles.industries[key];
    writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
    fallbackCache = profiles;
    return true;
  }
  const existing = await getIndustryProfile(key);
  if (!existing) return false;
  await deleteItem(`INDUSTRY#${key}`);
  return true;
}

export async function deleteTickerProfile(symbol) {
  const upper = symbol.toUpperCase();
  if (useFallback) {
    const profiles = loadFallbackProfiles();
    if (!profiles.tickers[upper]) return false;
    delete profiles.tickers[upper];
    writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2));
    fallbackCache = profiles;
    return true;
  }
  const existing = await getTickerProfile(upper);
  if (!existing) return false;
  await deleteItem(`TICKER#${upper}`);
  return true;
}

// --- Internal merge logic (unchanged from original) ---

function getStockProfileFromData(profiles, symbol, yahooIndustry) {
  const upperSymbol = symbol.toUpperCase();
  const tickerProfile = profiles.tickers[upperSymbol] || null;
  const industryKey = tickerProfile?.industry || yahooIndustry || null;
  const industryProfile = industryKey ? profiles.industries[industryKey] || null : null;

  if (!industryProfile && !tickerProfile) return null;

  return mergeProfiles(industryProfile, tickerProfile, industryKey);
}

function mergeProfiles(industryProfile, tickerProfile, industryKey) {
  const promptContext = [
    ...(industryProfile?.promptContext || []),
    ...(tickerProfile?.additionalContext || []),
  ];

  // Merge ticker scenarios over industry scenarios
  const industryScenarios = industryProfile?.scenarios ?? {};
  const tickerScenarios = tickerProfile?.scenarios ?? {};
  const mergedKeys = new Set([...Object.keys(industryScenarios), ...Object.keys(tickerScenarios)]);
  const mergedScenarios = {};
  for (const key of mergedKeys) {
    mergedScenarios[key] = { ...(industryScenarios[key] || {}), ...(tickerScenarios[key] || {}) };
  }
  const scenarios = mergedKeys.size > 0 ? mergedScenarios : null;

  return {
    sectorPEOverride: industryProfile?.sectorPEOverride ?? null,
    fairPERange: industryProfile?.fairPERange ?? null,
    scenarios,
    promptContext,
    dataOverrides: tickerProfile?.dataOverrides || null,
    valuationNotes: tickerProfile?.valuationNotes || null,
    peers: tickerProfile?.peers || industryProfile?.peers || null,
    matched: {
      ticker: !!tickerProfile,
      industry: industryKey,
    },
  };
}
