import { useState, useEffect } from "react";
import api from "../api";

interface Restricciones { cc: string[]; dv: string[]; clientes: string[] }
interface User { username: string; role: string; restricciones?: Restricciones }

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  });

  const login = async (username: string, password: string) => {
    const { data } = await api.post("/auth/login", { username, password });
    localStorage.setItem("token", data.token);
    const userObj = { username: data.username, role: data.role, restricciones: data.restricciones };
    localStorage.setItem("user", JSON.stringify(userObj));
    setUser(userObj);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return { user, login, logout, isAdmin: user?.role === "admin" };
}
