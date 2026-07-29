import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useAlertas } from "../contexts/AlertasContext";

export function Navbar() {
  const { usuario, logout, alertasManutencaoCount } = useAuth();
  const { totalGeral } = useAlertas();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const temAlertaManutencao = alertasManutencaoCount > 0;
  const podeVerAlertas = ["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role);
  const isActive = (path) => location.pathname === path;
  const perfilLabel =
    usuario?.role === "DESENVOLVEDOR"
      ? "Desenvolvedor"
      : usuario?.role === "ADMIN"
        ? "Administrador"
        : usuario?.role === "FUNCIONARIO_ESTOQUE"
          ? "Funcionário de Estoque"
          : "Funcionário";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMenu = () => setIsMenuOpen(false);

  const menuItems = [
    { to: "/desenvolvimento", label: "Desenvolvimento", icon: "</>" },
    { to: "/treinamentos", label: "Treinamentos", icon: "▶" },
    { to: "/roteiros", label: "Roteiros", icon: "🗺️" },
    { to: "/", label: "Dashboard", icon: "📊" },
    { to: "/movimentacoes", label: "Movimentações", icon: "📦" },
    { to: "/manutencao", label: "Manutenção", icon: "🛠️", alert: true },
    { to: "/conferencia-lacre", label: "Conferência de Lacre", icon: "🔏" },
    ...(["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_ESTOQUE"].includes(
      usuario?.role,
    )
      ? [
          { to: "/estoque", label: "Estoque", icon: "📦" },
          { to: "/envios", label: "Envios", icon: "📦" },
          { to: "/compras", label: "Compras", icon: "🛒" },
        ]
      : []),
    ...(["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role)
      ? [
          {
            to: "/fabricacao-pelucia",
            label: "Fabricação de Pelúcia",
            icon: "🧵",
          },
          { to: "/pecas", label: "Peças", icon: "🔧" },
          { to: "/maquinas", label: "Máquinas", icon: "🎮" },
          { to: "/lojas", label: "Lojas", icon: "🏪" },
          { to: "/produtos", label: "Produtos", icon: "🧸" },
        ]
      : []),
    ...(["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role)
      ? [
          { to: "/analise-estoque", label: "Estoque Detalhado", icon: "📦" },
          { to: "/graficos", label: "Gráficos", icon: "📈" },
          { to: "/relatorios", label: "Relatórios", icon: "📄" },
          { to: "/usuarios", label: "Usuários", icon: "👥" },
        ]
      : []),
  ];

  return (
    <nav className="bg-linear-to-r from-black via-neutral-900 to-red-950 text-white shadow-2xl border-b-4 border-primary">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-3">
          <Link to="/" className="flex shrink-0 items-center group">
            <img
              src="/LogoMicoLeao.png"
              alt="Mico Leao"
              className="h-16 w-16 rounded-xl bg-white/95 object-contain p-1 transition-transform duration-300 group-hover:scale-105 sm:h-20 sm:w-20"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </Link>

          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-right bg-white/5 px-4 py-2 rounded-lg border border-white/10 sm:block">
              <div className="truncate text-sm font-semibold text-white">
                {usuario?.nome}
              </div>
              <div className="text-xs text-accent-cream">
                {perfilLabel}
              </div>
            </div>

            {podeVerAlertas && (
              <button
                type="button"
                onClick={() => navigate("/alertas")}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold shadow-lg transition-all duration-200 hover:-translate-y-0.5 sm:px-4 ${
                  totalGeral > 0
                    ? "animate-pulse bg-linear-to-r from-yellow-500 to-orange-600 text-white hover:from-yellow-600 hover:to-orange-700"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                <span className="text-lg leading-none">🔔</span>
                <span className="hidden sm:inline">Alertas</span>
                {totalGeral > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-xs font-black text-white">
                    {totalGeral > 99 ? "99+" : totalGeral}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              className="rounded-lg p-2 transition-colors hover:bg-white/10"
              aria-label="Menu"
              aria-expanded={isMenuOpen}
            >
              <svg
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg bg-linear-to-r from-red-500 to-red-600 px-4 py-2.5 text-sm font-semibold shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:from-red-600 hover:to-red-700 hover:shadow-xl"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sair
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="border-t border-white/10 bg-neutral-950">
          <div className="mx-auto grid max-w-7xl gap-2 px-4 py-3 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8">
            {menuItems.map((item) => {
              const active = isActive(item.to);
              const alert = item.alert && temAlertaManutencao;

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={closeMenu}
                  className={`relative flex min-h-12 items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                    alert
                      ? "text-white animate-blink-alert"
                      : active
                        ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                        : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="text-lg" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {alert && (
                    <span className="ml-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-red-600 shadow">
                      {alertasManutencaoCount}
                    </span>
                  )}
                </Link>
              );
            })}

            <div className="border-t border-white/10 pt-3 sm:col-span-2 lg:col-span-3">
              <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 sm:hidden">
                <div className="truncate text-sm font-semibold text-white">
                  {usuario?.nome}
                </div>
                <div className="mt-1 text-xs text-accent-cream">
                  {perfilLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
