export type ActionState = {
  ok: boolean;
  message: string | null;
  variant: "success" | "error" | null;
};

export const idleState: ActionState = { ok: false, message: null, variant: null };
