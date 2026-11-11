import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { acessoATela } from "../utils/perfis";

export function PrivateRoute({ children, adminOnly = false, roles = [] }) {
  const { signed, loading, isAdmin, hasRole, usuario } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!signed) {
    return <Navigate to="/login" />;
  }

  // Regra de perfil de sempre; os ajustes de acesso do usuário podem
  // liberar ou bloquear a tela por cima dela. "/" sempre entra: a tela
  // inicial decide entre o Dashboard e a tela de acesso restrito.
  const regraDoPerfil =
    (!adminOnly || isAdmin()) && (roles.length === 0 || hasRole(...roles));

  if (
    location.pathname !== "/" &&
    !acessoATela(usuario, location.pathname, regraDoPerfil)
  ) {
    return <Navigate to="/" />;
  }

  return children;
}
