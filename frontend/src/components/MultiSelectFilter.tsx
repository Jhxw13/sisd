import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface MultiSelectFilterProps {
  label: string;
  options: Array<string | { label: string; value: string }>;
  value: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
  emptyLabel?: string;
  className?: string;
}

export function MultiSelectFilter({
  label,
  options,
  value,
  onChange,
  multi = true,
  emptyLabel,
  className,
}: MultiSelectFilterProps) {
  const normalized = options.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt,
  );

  const toggle = (item: string) => {
    if (multi) {
      onChange(value.includes(item) ? value.filter((v) => v !== item) : [...value, item]);
      return;
    }
    onChange(value.includes(item) ? [] : [item]);
  };

  const buttonLabel =
    value.length > 0
      ? multi
        ? `${value.length} selecionado(s)`
        : value[0]
      : emptyLabel || label;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" className={`justify-between border border-border ${className || ""}`}>
          <span className="truncate">{buttonLabel}</span>
          <ChevronDown className="w-4 h-4 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-2 bg-[#0b1628] border border-[#1f2c46] text-foreground">
        <div className="max-h-56 overflow-auto space-y-1 pr-1">
          {normalized.length === 0 && (
            <p className="px-2 py-2 text-xs text-muted-foreground">Sem opcoes para selecionar.</p>
          )}
          {normalized.map((item) => {
            const checked = value.includes(item.value);
            return (
              <button
                type="button"
                key={item.value}
                onClick={() => toggle(item.value)}
                className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5 text-left"
              >
                <Checkbox checked={checked} />
                <span className="text-sm flex-1 truncate">{item.label}</span>
                {checked && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
