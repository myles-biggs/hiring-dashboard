"use client";

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  freeTextValue?: string;
  onFreeTextChange?: (value: string) => void;
  freeTextPlaceholder?: string;
}

export function SkillsSelector({
  label,
  options,
  selected,
  onChange,
  freeTextValue = "",
  onFreeTextChange,
  freeTextPlaceholder = "Other skills...",
}: Props) {
  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{label}</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              selected.includes(opt.value)
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {onFreeTextChange && (
        <input
          type="text"
          value={freeTextValue}
          onChange={(e) => onFreeTextChange(e.target.value)}
          placeholder={freeTextPlaceholder}
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
      )}
    </div>
  );
}
