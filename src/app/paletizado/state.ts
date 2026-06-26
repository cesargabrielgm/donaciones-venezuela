export type PackState = {
  ok: boolean;
  message: string | null;
  variant: "success" | "error" | "warning" | null;
};

export const idlePack: PackState = { ok: false, message: null, variant: null };
