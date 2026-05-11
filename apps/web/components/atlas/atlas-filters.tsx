import type {
  AtlasInstitutionTypeFilter,
  AtlasRegionFilter,
  AtlasStatusFilter
} from "@/lib/panda-atlas";
import { Select } from "@/components/ui/select";
import { REGION_OPTIONS, STATUS_OPTIONS, TYPE_OPTIONS } from "./helpers";

interface AtlasFiltersProps {
  regionFilter: AtlasRegionFilter;
  statusFilter: AtlasStatusFilter;
  typeFilter: AtlasInstitutionTypeFilter;
  onRegionChange: (nextValue: AtlasRegionFilter) => void;
  onStatusChange: (nextValue: AtlasStatusFilter) => void;
  onTypeChange: (nextValue: AtlasInstitutionTypeFilter) => void;
}

export function AtlasFilters({
  regionFilter,
  statusFilter,
  typeFilter,
  onRegionChange,
  onStatusChange,
  onTypeChange
}: AtlasFiltersProps) {
  return (
    <div className="space-y-3">
      <label className="space-y-2">
        <span className="block text-[13px] leading-6 text-zinc-500">区域范围</span>
        <Select
          value={regionFilter}
          onChange={(event) => onRegionChange(event.target.value as AtlasRegionFilter)}
        >
          {REGION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>

      <label className="space-y-2">
        <span className="block text-[13px] leading-6 text-zinc-500">状态类型</span>
        <Select
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value as AtlasStatusFilter)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>

      <label className="space-y-2">
        <span className="block text-[13px] leading-6 text-zinc-500">对象类型</span>
        <Select
          value={typeFilter}
          onChange={(event) => onTypeChange(event.target.value as AtlasInstitutionTypeFilter)}
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}

