import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function SuporteTecnicoLayout({ activeTab, children }) {
  const navigate = useNavigate();
  const { usuario, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 border-b-4 border-cyan-500 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button
                onClick={() => navigate("/")}
                className="flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-white bg-white/5 hover:bg-white/10 border border-cyan-800 px-3 py-2 rounded-lg transition-colors flex-shrink-0"
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
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span className="hidden sm:inline">Voltar ao Dashboard</span>
              </button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 truncate">
                  <span>🔧</span>
                  <span className="truncate">Suporte Técnico</span>
                </h1>
                <p className="text-xs text-cyan-300/70 hidden sm:block">
                  Controle de peças e produtos técnicos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="hidden md:block text-right bg-white/5 px-4 py-2 rounded-lg border border-cyan-900">
                <div className="text-sm font-semibold text-white">
                  {usuario?.nome}
                </div>
                <div className="text-xs text-cyan-300/80">
                  {usuario?.role === "ADMIN" ? "Administrador" : "Funcionário"}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="bg-red-600/80 hover:bg-red-600 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors"
              >
                Sair
              </button>
            </div>
          </div>

          <nav className="flex gap-2 pb-3">
            <button
              onClick={() => navigate("/suporte-tecnico")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "itens"
                  ? "bg-cyan-600 text-white shadow-lg"
                  : "text-cyan-200/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              📋 Itens em Estoque
            </button>
            {usuario?.role === "ADMIN" && (
              <button
                onClick={() => navigate("/suporte-tecnico/historico")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "historico"
                    ? "bg-cyan-600 text-white shadow-lg"
                    : "text-cyan-200/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                🕒 Histórico de Movimentações
              </button>
            )}
            {usuario?.role === "ADMIN" && (
              <button
                onClick={() => navigate("/suporte-tecnico/devolucoes-pendentes")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === "devolucoes"
                    ? "bg-cyan-600 text-white shadow-lg"
                    : "text-cyan-200/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                🔁 Devoluções Pendentes
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="border-t border-cyan-900/60 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-cyan-300/50">
          Área de Suporte Técnico · Mico Leao
        </div>
      </footer>
    </div>
  );
}
