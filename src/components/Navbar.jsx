import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";

export function Navbar() {
  const { usuario, logout, alertasManutencaoCount } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const temAlertaManutencao = alertasManutencaoCount > 0;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className="bg-linear-to-r from-black via-neutral-900 to-red-950 text-white shadow-2xl border-b-4 border-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <Link
              to="/"
              className="flex items-center space-x-2 sm:space-x-3 group"
            >
              <img
                src="/LogoMicoLeao.png"
                alt="Mico Leao"
                className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 object-contain rounded-xl bg-white/95 p-1 transition-transform duration-300 group-hover:scale-110"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            </Link>

            {/* Menu Desktop */}
            <div className="hidden lg:block ml-12">
              <div className="flex items-center space-x-2">
                <Link
                  to="/"
                  className={`    rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive("/")
                      ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  📊 Dashboard
                </Link>
                <Link
                  to="/movimentacoes"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive("/movimentacoes")
                      ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  📦 Movimentações
                </Link>
                <Link
                  to="/manutencao"
                  className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    temAlertaManutencao
                      ? "text-white animate-blink-alert"
                      : isActive("/manutencao")
                        ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                        : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  🛠️ Manutenção
                  {temAlertaManutencao && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-red-600 shadow">
                      {alertasManutencaoCount}
                    </span>
                  )}
                </Link>
                {usuario?.role !== "FUNCIONARIO" && (
                  <>
                    <Link
                      to="/maquinas"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive("/maquinas")
                          ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      🎮 Máquinas
                    </Link>
                    <Link
                      to="/lojas"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive("/lojas")
                          ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      🏪 Lojas
                    </Link>
                    <Link
                      to="/produtos"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive("/produtos")
                          ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      🧸 Produtos
                    </Link>
                    <Link
                      to="/produtos-a-comprar"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive("/produtos-a-comprar")
                          ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      🛒 Carrinho
                    </Link>
                  </>
                )}
                {usuario?.role === "ADMIN" && (
                  <>
                    <Link
                      to="/analise-estoque"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive("/analise-estoque")
                          ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      Estoque Detalhado
                    </Link>
                    <Link
                      to="/graficos"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive("/graficos")
                          ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      📈 Gráficos
                    </Link>
                    <Link
                      to="/relatorios"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive("/relatorios")
                          ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      📄 Relatórios
                    </Link>
                    <Link
                      to="/usuarios"
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive("/usuarios")
                          ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg scale-105"
                          : "text-gray-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      👥 Usuários
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* User Info e Logout */}
          <div className="flex items-center space-x-4">
            {/* Botão Hamburger Mobile */}
            <button
              onClick={toggleMenu}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Menu"
            >
              <svg
                className="w-6 h-6"
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

            <div className="hidden md:block text-right bg-white/5 px-4 py-2 rounded-lg border border-white/10">
              <div className="text-sm font-semibold text-white">
                {usuario?.nome}
              </div>
              <div className="text-xs text-accent-cream flex items-center justify-end gap-1">
                {usuario?.role === "ADMIN" ? (
                  <>
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Administrador
                  </>
                ) : (
                  "Funcionário"
                )}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
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

      {/* Menu Mobile Dropdown */}
      {isMenuOpen && (
        <div className="lg:hidden bg-neutral-950 border-t border-white/10">
          <div className="px-4 py-3 space-y-2">
            <Link
              to="/"
              onClick={closeMenu}
              className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive("/")
                  ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                  : "text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              📊 Dashboard
            </Link>
            <Link
              to="/movimentacoes"
              onClick={closeMenu}
              className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                isActive("/movimentacoes")
                  ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                  : "text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              📦 Movimentações
            </Link>
            <Link
              to="/manutencao"
              onClick={closeMenu}
              className={`relative flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                temAlertaManutencao
                  ? "text-white animate-blink-alert"
                  : isActive("/manutencao")
                    ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              🛠️ Manutenção
              {temAlertaManutencao && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-red-600 shadow">
                  {alertasManutencaoCount}
                </span>
              )}
            </Link>
            {usuario?.role !== "FUNCIONARIO" && (
              <>
                <Link
                  to="/maquinas"
                  onClick={closeMenu}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive("/maquinas")
                      ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  🎮 Máquinas
                </Link>
                <Link
                  to="/lojas"
                  onClick={closeMenu}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive("/lojas")
                      ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  🏪 Lojas
                </Link>
                <Link
                  to="/produtos"
                  onClick={closeMenu}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive("/produtos")
                      ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  🧸 Produtos
                </Link>
                <Link
                  to="/produtos-a-comprar"
                  onClick={closeMenu}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive("/produtos-a-comprar")
                      ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  🛒 Produtos a Comprar
                </Link>
              </>
            )}
            {usuario?.role === "ADMIN" && (
              <>
                <Link
                  to="/analise-estoque"
                  onClick={closeMenu}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive("/analise-estoque")
                      ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  Estoque Detalhado
                </Link>
                <Link
                  to="/graficos"
                  onClick={closeMenu}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive("/graficos")
                      ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  📈 Gráficos
                </Link>
                <Link
                  to="/relatorios"
                  onClick={closeMenu}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive("/relatorios")
                      ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  📄 Relatórios
                </Link>
                <Link
                  to="/usuarios"
                  onClick={closeMenu}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive("/usuarios")
                      ? "bg-linear-to-r from-primary to-accent-yellow text-white shadow-lg"
                      : "text-gray-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  👥 Usuários
                </Link>
              </>
            )}
            {/* User Info Mobile */}
            <div className="md:hidden mt-4 pt-4 border-t border-white/10">
              <div className="bg-white/5 px-4 py-3 rounded-lg border border-white/10 mb-3">
                <div className="text-sm font-semibold text-white">
                  {usuario?.nome}
                </div>
                <div className="text-xs text-accent-cream flex items-center gap-1 mt-1">
                  {usuario?.role === "ADMIN" ? (
                    <>
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Administrador
                    </>
                  ) : (
                    "Funcionário"
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
