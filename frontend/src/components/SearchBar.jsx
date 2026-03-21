import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchSearchSuggestions } from '@/api/stockApi';

export default function SearchBar({ onSearch }) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  const closeSuggestions = useCallback(() => {
    setShowDropdown(false);
    setSuggestions([]);
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setInput(val);
    setActiveIndex(-1);

    clearTimeout(timerRef.current);
    const trimmed = val.trim();
    if (!trimmed) {
      closeSuggestions();
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const results = await fetchSearchSuggestions(trimmed);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch {
        closeSuggestions();
      }
    }, 300);
  };

  const selectSymbol = (symbol) => {
    setInput(symbol);
    closeSuggestions();
    onSearch(symbol);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const symbol = input.trim().toUpperCase();
    if (symbol) {
      closeSuggestions();
      onSearch(symbol);
    }
  };

  const handleKeyDown = (e) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSymbol(suggestions[activeIndex].symbol);
    } else if (e.key === 'Escape') {
      closeSuggestions();
    }
  };

  return (
    <form
      className="flex gap-2 mb-6 relative"
      onSubmit={handleSubmit}
      ref={wrapperRef}
    >
      <div className="relative flex-1">
        <Input
          id="search-input"
          type="text"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(closeSuggestions, 150)}
          placeholder="Enter symbol (e.g. AAPL, RY.TO)"
          className="text-base"
          autoComplete="off"
        />
        {showDropdown && (
          <ul className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md overflow-hidden">
            {suggestions.map((s, i) => (
              <li
                key={s.symbol}
                className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer text-sm ${
                  i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                }`}
                onMouseDown={() => selectSymbol(s.symbol)}
              >
                <span>
                  <span className="font-semibold">{s.symbol}</span>
                  {s.name && (
                    <span className="ml-2 text-muted-foreground">{s.name}</span>
                  )}
                </span>
                {s.exchange && (
                  <span className="text-xs text-muted-foreground shrink-0">{s.exchange}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-200 text-white"
      >
        Search
      </Button>
    </form>
  );
}
