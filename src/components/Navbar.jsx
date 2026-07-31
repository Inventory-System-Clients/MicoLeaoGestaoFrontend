import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useAlertas } from "../contexts/AlertasContext";

export function Navbar() {
  const {
    usuario,
    logout,
    alertasManutencaoCount,
    minhasManutencoesPendentesCount,
  } = useAuth();
  const { totalGeral } = useAlertas();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const podeVerAlertas = ["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role);
  const contadorManutencao = podeVerAlertas
    ? alertasManutencaoCount
    : minhasManutencoesPendentesCount;
  const temAlertaManutencao = contadorManutencao > 0;
  const isActive = (path) => location.pathname === path;
  const perfilLabel =
    usuario?.role === "DESENVOLVEDOR"
      ? "Desenvolvedor"
      : usuario?.role === "ADMIN"
        ? "Administrador"
        : usuario?.role === "FUNCIONARIO_ESTOQUE"
          ? "Funcionário de Estoque"
          : usuario?.role === "ENTREGADOR"
            ? "Entregador"
          : "Funcionário";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeMenu = () => setIsMenuOpen(false);

  const itensSoltos = [
    {
      to: "/",
      label: "Dashboard",
      icon: "📊",
      roles: ["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO", "FUNCIONARIO_ESTOQUE"],
    },
  ];

  const ADMIN_ROLES = ["ADMIN", "DESENVOLVEDOR"];
  const ESTOQUE_ROLES = ["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_ESTOQUE"];
  const ENVIO_ROLES = [...ESTOQUE_ROLES, "ENTREGADOR"];

  const grupos = [
    {
      id: "operacional",
      label: "Operacional",
      icon: "🛠️",
      itens: [
        { to: "/roteiros", label: "Roteiros", icon: "🗺️" },
        { to: "/manutencao", label: "Manutenção", icon: "🛠️", alert: true },
        { to: "/conferencia-lacre", label: "Conferência de Lacre", icon: "🔏" },
        {
          to: "/sangrias",
          label: "Sangria",
          icon: "💰",
          roles: ["FUNCIONARIO"],
        },
        {
          to: "/gastos-variaveis",
          label: "Lançar Gasto Variável",
          icon: "🧾",
          roles: ["FUNCIONARIO"],
        },
      ],
    },
    {
      id: "financeiro",
      label: "Financeiro",
      icon: "💰",
      itens: [
        { to: "/sangrias", label: "Sangria", icon: "💰", roles: ADMIN_ROLES },
        {
          to: "/registrar-dinheiro",
          label: "Registrar Dinheiro",
          icon: "💵",
          roles: ADMIN_ROLES,
        },
        {
          to: "/gastos-variaveis",
          label: "Gasto Variável",
          icon: "🧾",
          roles: ADMIN_ROLES,
        },
      ],
    },
    {
      id: "estoque-compras",
      label: "Estoque e Compras",
      icon: "📦",
      itens: [
        { to: "/estoque", label: "Estoque", icon: "📦", roles: ESTOQUE_ROLES },
        { to: "/envios", label: "Envios", icon: "📦", roles: ENVIO_ROLES },
        { to: "/compras", label: "Compras", icon: "🛒", roles: ESTOQUE_ROLES },
        {
          to: "/fabricacao-pelucia",
          label: "Fabricação de Pelúcia",
          icon: "🧵",
          roles: ADMIN_ROLES,
        },
        { to: "/pecas", label: "Peças", icon: "🔧", roles: ADMIN_ROLES },
      ],
    },
    {
      id: "cadastros",
      label: "Cadastros",
      icon: "🗂️",
      itens: [
        { to: "/lojas", label: "Lojas", icon: "🏪", roles: ADMIN_ROLES },
        { to: "/maquinas", label: "Máquinas", icon: "🎮", roles: ADMIN_ROLES },
        { to: "/produtos", label: "Produtos", icon: "🧸", roles: ADMIN_ROLES },
        { to: "/usuarios", label: "Usuários", icon: "👥", roles: ADMIN_ROLES },
      ],
    },
    {
      id: "analise",
      label: "Análise",
      icon: "📈",
      itens: [
        {
          to: "/movimentacoes",
          label: "Histórico de Movimentações",
          icon: "🔄",
          roles: ADMIN_ROLES,
        },
        {
          to: "/analise-estoque",
          label: "Estoque Detalhado",
          icon: "📦",
          roles: ADMIN_ROLES,
        },
        { to: "/graficos", label: "Gráficos", icon: "📈", roles: ADMIN_ROLES },
        { to: "/relatorios", label: "Relatórios", icon: "📄", roles: ADMIN_ROLES },
      ],
    },
    {
      id: "suporte",
      label: "Suporte",
      icon: "🆘",
      itens: [
        {
          to: "/desenvolvimento",
          label: "Desenvolvimento",
          icon: "</>",
          roles: ADMIN_ROLES,
        },
        { to: "/treinamentos", label: "Treinamentos", icon: "▶" },
      ],
    },
  ];

  const gruposVisiveis = grupos
    .map((grupo) => ({
      ...grupo,
      itens: grupo.itens.filter(
        (item) => !item.roles || item.roles.includes(usuario?.role),
      ),
    }))
    .filter((grupo) => grupo.itens.length > 0);

  const [gruposAbertos, setGruposAbertos] = useState({});
  const toggleGrupo = (id) =>
    setGruposAbertos((prev) => ({ ...prev, [id]: !prev[id] }));

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
          <div className="mx-auto max-w-7xl space-y-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {itensSoltos
                .filter((item) => !item.roles || item.roles.includes(usuario?.role))
                .map((item) => {
                const active = isActive(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={closeMenu}
                    className={`relative flex min-h-12 items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                      active
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
                  </Link>
                );
              })}
            </div>

            <div className="space-y-2">
              {gruposVisiveis.map((grupo) => {
                const aberto = Boolean(gruposAbertos[grupo.id]);
                const grupoTemAlerta = grupo.itens.some(
                  (item) => item.alert && temAlertaManutencao,
                );

                return (
                  <div
                    key={grupo.id}
                    className="overflow-hidden rounded-lg border border-white/10"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGrupo(grupo.id)}
                      className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-gray-200 transition-colors hover:bg-white/10"
                      aria-expanded={aberto}
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-lg" aria-hidden="true">
                          {grupo.icon}
                        </span>
                        {grupo.label}
                        {grupoTemAlerta && !aberto && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                            {contadorManutencao}
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-xs transition-transform duration-200 ${
                          aberto ? "rotate-90" : ""
                        }`}
                        aria-hidden="true"
                      >
                        ▶
                      </span>
                    </button>

                    {aberto && (
                      <div className="grid grid-cols-1 gap-2 border-t border-white/10 bg-black/20 p-3 sm:grid-cols-2 lg:grid-cols-3">
                        {grupo.itens.map((item) => {
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
                                  {contadorManutencao}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-white/10 pt-3">
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
