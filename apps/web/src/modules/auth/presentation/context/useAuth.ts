import { useContext } from "react";
import { AuthContext } from "@/modules/auth/presentation/context/authContextValue";

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
