export type AuthState = {
  message: string | null;
  variant: "error" | null;
  email: string;
};

export const initialAuthState: AuthState = { message: null, variant: null, email: "" };
