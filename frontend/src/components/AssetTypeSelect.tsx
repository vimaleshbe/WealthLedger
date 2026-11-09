import { Select } from "./ui/select";
import { SELECTABLE_ASSET_TYPES } from "../lib/assetTypes";
import type { AssetType } from "../types";

interface AssetTypeSelectProps {
  value: AssetType;
  onChange: (value: AssetType) => void;
}

export default function AssetTypeSelect({ value, onChange }: AssetTypeSelectProps) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value as AssetType)}
    >
      {SELECTABLE_ASSET_TYPES.map((type) => (
        <option key={type.value} value={type.value}>
          {type.label}
        </option>
      ))}
    </Select>
  );
}
