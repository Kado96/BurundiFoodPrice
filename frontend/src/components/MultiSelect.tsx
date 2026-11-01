import { useState, useRef, useEffect, useMemo } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
  color?: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  maxBadges?: number;
  className?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Sélectionner...",
  allLabel = "Tous",
  maxBadges = 2,
  className,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [alignRight, setAlignRight] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside & calculate alignment to avoid screen edge clipping
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Auto focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);

      // Check if dropdown would overflow the right viewport boundary
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // If the element's left plus expected dropdown width (~280px) exceeds viewport width
        if (rect.left + 280 > window.innerWidth - 12) {
          setAlignRight(true);
        } else {
          setAlignRight(false);
        }
      }
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Options map for fast label lookup
  const optionsMap = useMemo(() => {
    const map = new Map<string, MultiSelectOption>();
    options.forEach((opt) => map.set(opt.value, opt));
    return map;
  }, [options]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase().trim();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, search]);

  const allSelected = options.length > 0 && selected.length === options.length;
  const isNoneSelected = selected.length === 0;

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map((o) => o.value));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const removeBadge = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== value));
  };

  return (
    <div
      className={cn(
        "relative inline-block w-full text-left",
        isOpen && "relative z-[9999]",
        className
      )}
      ref={containerRef}
    >
      {/* Trigger Button */}
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          } else if (e.key === "Escape") {
            setIsOpen(false);
          }
        }}
        className={cn(
          "flex min-h-10 w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-card px-3 py-1.5 text-sm shadow-xs transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40",
          isOpen && "ring-2 ring-primary/40 border-primary"
        )}
      >
        <div className="flex flex-1 min-w-0 flex-wrap items-center gap-1.5">
          {isNoneSelected ? (
            <span className="truncate text-muted-foreground font-normal">{placeholder || allLabel}</span>
          ) : allSelected ? (
            <span className="flex min-w-0 items-center gap-1.5 font-semibold text-foreground truncate">
              <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                {options.length}
              </span>
              <span className="truncate">{allLabel}</span>
            </span>
          ) : (
            <>
              {selected.slice(0, maxBadges).map((val) => {
                const opt = optionsMap.get(val);
                return (
                  <span
                    key={val}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground max-w-[120px] sm:max-w-[150px] truncate"
                  >
                    {opt?.color && (
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    <span className="truncate">{opt?.label ?? val}</span>
                    <button
                      type="button"
                      aria-label={`Supprimer ${opt?.label ?? val}`}
                      onClick={(e) => removeBadge(val, e)}
                      className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}

              {selected.length > maxBadges && (
                <span className="inline-flex shrink-0 items-center rounded-md bg-primary/15 px-1.5 py-0.5 text-xs font-bold text-primary">
                  +{selected.length - maxBadges}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-1 pl-1 shrink-0 text-muted-foreground">
          {selected.length > 0 && !isNoneSelected && (
            <button
              type="button"
              title="Effacer la sélection"
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
          />
        </div>
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className={cn(
            "absolute z-[9999] mt-1 max-h-80 overflow-hidden rounded-xl border border-border bg-popover shadow-xl animate-in fade-in-0 zoom-in-95",
            "left-0 right-0 w-auto sm:left-0 sm:right-auto sm:min-w-[260px] sm:max-w-xs max-w-[calc(100vw-24px)]",
            alignRight && "sm:right-0 sm:left-auto"
          )}
        >
          {/* Search Header */}
          <div className="border-b border-border p-2 bg-muted/20">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-md bg-background pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground outline-none border border-input focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-muted-foreground px-0.5">
              <button
                type="button"
                onClick={handleSelectAll}
                className="font-medium text-primary hover:underline transition-colors"
              >
                Tout sélectionner ({options.length})
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="hover:text-destructive transition-colors underline-offset-2 hover:underline"
              >
                Tout désélectionner
              </button>
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1.5 scrollbar-thin space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Aucun résultat trouvé
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selected.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isChecked}
                    tabIndex={0}
                    onClick={() => handleToggle(opt.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggle(opt.value);
                      }
                    }}
                    className={cn(
                      "group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors select-none outline-none",
                      isChecked
                        ? "bg-primary/10 text-primary font-medium hover:bg-primary/15"
                        : "hover:bg-accent text-foreground hover:text-accent-foreground"
                    )}
                  >
                    {/* Visual Checkbox */}
                    <div
                      className={cn(
                        "pointer-events-none flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all duration-150",
                        isChecked
                          ? "border-primary bg-primary text-primary-foreground shadow-xs"
                          : "border-input bg-background group-hover:border-primary/50"
                      )}
                    >
                      {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>

                    {opt.color && (
                      <span
                        className="pointer-events-none h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}

                    <span className="pointer-events-none flex-1 truncate">{opt.label}</span>

                    {opt.count !== undefined && (
                      <span className="pointer-events-none rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-normal">
                        {opt.count}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Status */}
          <div className="border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex justify-between items-center">
            <span>
              {selected.length === 0
                ? allLabel
                : `${selected.length} sélectionné${selected.length > 1 ? "s" : ""}`}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md px-2 py-0.5 font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
