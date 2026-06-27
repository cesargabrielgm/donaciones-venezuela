export type LocState = {
  ok: boolean;
  message: string | null;
  variant: "success" | "error" | null;
};

export const idleLoc: LocState = { ok: false, message: null, variant: null };
