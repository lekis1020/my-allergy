"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value = "",
  onChange,
  placeholder = "Search papers...",
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, 300);

  // Track sync state using React "store previous value in state" pattern
  const [prevValue, setPrevValue] = useState(value);
  const [syncing, setSyncing] = useState(false);

  // Sync external value prop into local state (replaces useEffect+setState)
  if (prevValue !== value) {
    setPrevValue(value);
    if (value !== localValue) {
      setSyncing(true);
      setLocalValue(value);
    }
  }

  // Clear syncing flag when debounced value catches up to external value
  if (syncing && debouncedValue === value) {
    setSyncing(false);
  }

  // Notify parent of debounced local changes (skip echo from external sync)
  useEffect(() => {
    if (!syncing && debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, value, syncing]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-10"
      />
      {localValue && (
        <button
          onClick={() => {
            setLocalValue("");
            onChange("");
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
