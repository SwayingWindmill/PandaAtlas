import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ATLAS_SEARCH_PLACEHOLDER } from "@/lib/panda-atlas";

interface AtlasSearchProps {
  value: string;
  resultCount: number;
  onValueChange: (nextValue: string) => void;
}

export function AtlasSearch({ value, resultCount, onValueChange }: AtlasSearchProps) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={ATLAS_SEARCH_PLACEHOLDER}
          className="pl-11"
        />
      </div>
      <p className="text-[13px] leading-6 text-zinc-500">当前命中 {resultCount} 个地图对象</p>
    </div>
  );
}

