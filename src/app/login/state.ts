export type AuthState = {
  step: "email" | "code";
  email: string;
  message: string | null;
  variant: "info" | "error";
};

export const initialAuthState: AuthState = {
  step: "email",
  email: "",
  message: null,
  variant: "info",
};
