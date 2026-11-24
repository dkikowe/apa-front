import {
  locationLabel,
  locationOptions,
  regionLabel,
  SETTLEMENTS,
} from "../../../shared/locations";
import { Field } from "./common";
const options = locationOptions();
export function LocationSelect({
  region,
  village,
  onChange,
  error,
}: {
  region: string;
  village: string;
  onChange: (region: string, village: string) => void;
  error?: string;
}) {
  const value = region || village ? JSON.stringify([region, village]) : "";
  const legacy = value && !options.some((option) => option.value === value);
  return (
    <Field label="Елді мекен" error={error}>
      <select
        value={value}
        onChange={(event) => {
          const selected = options.find(
            (option) => option.value === event.target.value,
          );
          if (selected) onChange(selected.region, selected.village);
          else if (!event.target.value) onChange("", "");
        }}
      >
        <option value="">Елді мекенді таңдаңыз</option>
        {legacy && (
          <option value={value}>
            {locationLabel(region, village)} (сақталған мекенжай)
          </option>
        )}
        {Object.keys(SETTLEMENTS).map((group) => (
          <optgroup key={group} label={regionLabel(group)}>
            {options
              .filter((option) => option.region === group)
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <span className="small-note">
        {locationLabel(region, village) ||
          "Елді мекенді таңдасаңыз, облыс пен аудан бірге толтырылады."}
      </span>
    </Field>
  );
}
