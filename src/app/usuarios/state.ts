export type AdminState = {
  ok: boolean;
  message: string | null;
  variant: "success" | "error" | null;
};

export const idleAdmin: AdminState = { ok: false, message: null, variant: null };
