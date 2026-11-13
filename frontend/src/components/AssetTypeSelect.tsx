import { Select } from "./ui/select";
import { ASSET_TYPES, EDITABLE_ASSET_TYPES } from "../lib/assetTypes";
import type { AssetType } from "../types";

interface AssetTypeSelectProps {
  value: AssetType;
  onChange: (value: AssetType) => void;
}

export default function AssetTypeSelect({ value, onChange }: AssetTypeSelectProps) {
  const options = EDITABLE_ASSET_TYPES.some((type) => type.value === value)
    ? EDITABLE_ASSET_TYPES
    : [
        ...EDITABLE_ASSET_TYPES,
        ...ASSET_TYPES.filter((type) => type.value === value),
      ];

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value as AssetType)}
    >
      {options.map((type) => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </Select>
  );
}
