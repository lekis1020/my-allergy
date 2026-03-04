"use client";

import { useState, useEffect, useRef } from "react";
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
  const syncingFromExternalValueRef = useRef(false);

  useEffect(() => {
    if (value === localValue) return;
    syncingFromExternalValueRef.current = true;
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (syncingFromExternalValueRef.current) {
      // Ignore debounced echo produced by external state sync (e.g. topic click).
      if (debouncedValue === value) {
        syncingFromExternalValueRef.current = false;
      }
      return;
    }

    if (debouncedValue !== value) {
      onChange(debouncedValue);
    }
  }, [debouncedValue, onChange, value]);

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
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
