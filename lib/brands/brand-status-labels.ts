import type { BrandStatus } from "@/types/database";

export const BRAND_STATUS_OPTIONS: readonly {
  value: BrandStatus;
  label: string;
}[] = [
  { value: "new", label: "Marca nueva" },
  { value: "existing", label: "Marca existente" },
  { value: "in_progress", label: "En construcción" },
] as const;
