import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
} from "react";
import api from "../services/api";

export const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alertasManutencaoCount, setAlertasManutencaoCount] = useState(0);
  const [minhasManutencoesPendentesCount, setMinhasManutencoesPendentesCount] =
    useState(0);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const usuarioSalvo = localStorage.getItem("usuario");

    if (token && usuarioSalvo) {
      setUsuario(JSON.parse(usuarioSalvo));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }

    setLoading(false);
  }, []);

  const atualizarAlertasManutencaoCount = useCallback(async () => {
    if (!["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role)) return;
    try {
      const response = await api.get("/alertas-movimentacao");
      const dados = response.data;
      setAlertasManutencaoCount(Array.isArray(dados) ? dados.length : 0);
    } catch {
      // Silencioso: não bloqueia a navegação por falha ao buscar alertas.
    }
  }, [usuario?.role]);

  useEffect(() => {
    if (!["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role)) return;

    const buscar = async () => {
      try {
        const response = await api.get("/alertas-movimentacao");
        const dados = response.data;
        setAlertasManutencaoCount(Array.isArray(dados) ? dados.length : 0);
      } catch {
        // Silencioso: não bloqueia a navegação por falha ao buscar alertas.
      }
    };

    buscar();
    const intervalId = setInterval(buscar, 30000);

    return () => clearInterval(intervalId);
  }, [usuario?.role]);

  // Manutenções pendentes atribuídas ao próprio funcionário (responsável ou
  // na lista de quem pode visualizar/resolver) — o backend já filtra
  // /manutencoes assim para quem não é ADMIN/DESENVOLVEDOR.
  const atualizarMinhasManutencoesPendentesCount = useCallback(async () => {
    if (!usuario || ["ADMIN", "DESENVOLVEDOR"].includes(usuario.role)) return;
    try {
      const response = await api.get("/manutencoes");
      const dados = response.data;
      setMinhasManutencoesPendentesCount(
        Array.isArray(dados) ? dados.length : 0,
      );
    } catch {
      // Silencioso: não bloqueia a navegação por falha ao buscar manutenções.
    }
  }, [usuario]);

  useEffect(() => {
    if (!usuario || ["ADMIN", "DESENVOLVEDOR"].includes(usuario.role)) return;

    const buscar = async () => {
      try {
        const response = await api.get("/manutencoes");
        const dados = response.data;
        setMinhasManutencoesPendentesCount(
          Array.isArray(dados) ? dados.length : 0,
        );
      } catch {
        // Silencioso: não bloqueia a navegação por falha ao buscar manutenções.
      }
    };

    buscar();
    const intervalId = setInterval(buscar, 30000);

    return () => clearInterval(intervalId);
  }, [usuario]);

  const login = async (email, senha) => {
    try {
      const response = await api.post("/auth/login", { email, senha });
      const { token, usuario: usuarioData } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("usuario", JSON.stringify(usuarioData));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      setUsuario(usuarioData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Erro ao fazer login",
      };
    }
  };

  const registrar = async (nome, email, senha, telefone) => {
    try {
      const response = await api.post("/auth/registrar", {
        nome,
        email,
        senha,
        telefone,
      });
      const { token, usuario: usuarioData } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("usuario", JSON.stringify(usuarioData));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      setUsuario(usuarioData);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || "Erro ao registrar",
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    delete api.defaults.headers.common["Authorization"];
    setUsuario(null);
  };

  const isAdmin = () => ["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role);

  const hasRole = (...roles) => roles.includes(usuario?.role);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        loading,
        login,
        registrar,
        logout,
        isAdmin,
        hasRole,
        signed: !!usuario,
        alertasManutencaoCount:
          ["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role)
            ? alertasManutencaoCount
            : 0,
        atualizarAlertasManutencaoCount,
        minhasManutencoesPendentesCount:
          !["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role)
            ? minhasManutencoesPendentesCount
            : 0,
        atualizarMinhasManutencoesPendentesCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
