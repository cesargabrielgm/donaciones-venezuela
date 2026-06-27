export type ResetState = {
  message: string | null;
  variant: "info" | "error" | null;
};

export const initialResetState: ResetState = { message: null, variant: null };
