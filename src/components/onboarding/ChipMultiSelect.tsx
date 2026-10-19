'use client';

import React, { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';

interface ChipMultiSelectProps {
  label?: string;
  helperText?: string;
  placeholder?: string;
  selected: string[];
  onChange: (items: string[]) => void;
  suggestions?: string[];
  error?: string;
}

export const ChipMultiSelect: React.FC<ChipMultiSelectProps> = ({
  label,
  helperText,
  placeholder = 'Type and press Enter to add...',
  selected = [],
  onChange,
  suggestions = [],
  error,
}) => {
  const [inputValue, setInputValue] = useState('');

  const addChip = (item: string) => {
    const trimmed = item.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
    }
    setInputValue('');
  };

  const removeChip = (itemToRemove: string) => {
    onChange(selected.filter((item) => item !== itemToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && selected.length > 0) {
      removeChip(selected[selected.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A]">
          {label}
        </label>
      )}

      {/* Selected Chips & Input Box */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-2.5 min-h-[48px] flex flex-wrap items-center gap-1.5 focus-within:border-cyan-600 focus-within:ring-2 focus-within:ring-cyan-600/15 transition-all">
        {selected.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#ECFEFF] border border-cyan-200 text-cyan-800 text-xs font-semibold"
          >
            <span>{item}</span>
            <button
              type="button"
              onClick={() => removeChip(item)}
              className="text-cyan-600 hover:text-cyan-950 p-0.5 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => inputValue && addChip(inputValue)}
          placeholder={selected.length === 0 ? placeholder : 'Add more...'}
          className="flex-1 min-w-[140px] bg-transparent text-sm text-[#0F172A] placeholder:text-[#94A3B8] outline-none px-2 py-0.5"
        />
      </div>

      {/* Helper text or error */}
      {error ? (
        <p className="text-xs text-rose-600 font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-[12px] text-[#94A3B8]">{helperText}</p>
      ) : null}

      {/* Suggested Quick Add Chips */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-[#94A3B8] font-semibold mr-1">Suggestions:</span>
          {suggestions
            .filter((s) => !selected.includes(s))
            .slice(0, 6)
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addChip(s)}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#475569] hover:text-[#0F172A] border border-[#E2E8F0] transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{s}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
};
