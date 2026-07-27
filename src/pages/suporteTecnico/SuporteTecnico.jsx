import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { SuporteTecnicoLayout } from "./SuporteTecnicoLayout";
import { MovimentacaoModal } from "./MovimentacaoModal";
import { ItemFormModal } from "./ItemFormModal";

export function SuporteTecnico() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === "ADMIN";

  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const [movimentacao, setMovimentacao] = useState(null); // { item, tipo }
  const [itemEmEdicao, setItemEmEdicao] = useState(null);
  const [mostrarFormNovo, setMostrarFormNovo] = useState(false);
  const [itemParaDesativar, setItemParaDesativar] = useState(null);
  const [desativando, setDesativando] = useState(false);

  const carregarItens = useCallback(async () => {
    try {
      setLoading(true);
      setErro("");
      const params = {};
      if (filtroTipo) params.tipo = filtroTipo;
      if (busca.trim()) params.busca = busca.trim();
      const response = await api.get("/suporte-tecnico/itens", { params });
      setItens(response.data || []);
    } catch (error) {
      setErro(
        error.response?.data?.error ||
          "Erro ao carregar os itens de suporte técnico.",
      );
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [filtroTipo, busca]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      carregarItens();
    }, 300);
    return () => clearTimeout(timeout);
  }, [carregarItens]);

  const handleDesativar = async () => {
    if (!itemParaDesativar) return;
    try {
      setDesativando(true);
      await api.delete(`/suporte-tecnico/itens/${itemParaDesativar.id}`);
      setItemParaDesativar(null);
      carregarItens();
    } catch (error) {
      setErro(
        error.response?.data?.error || "Erro ao desativar o item.",
      );
      setItemParaDesativar(null);
    } finally {
      setDesativando(false);
    }
  };

  return (
    <SuporteTecnicoLayout activeTab="itens">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Itens em Estoque</h2>
          <p className="text-slate-400 text-sm mt-1">
            Dê entrada ou saída rapidamente e mantenha o estoque técnico em dia.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setMostrarFormNovo(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-colors flex items-center gap-2 self-start"
          >
            <span className="text-lg leading-none">+</span> Novo Item
          </button>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou código..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors"
        />
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="px-4 py-2.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors cursor-pointer"
        >
          <option value="">Todos os tipos</option>
          <option value="PECA">🔧 Peças</option>
          <option value="PRODUTO">📦 Produtos</option>
        </select>
      </div>

      {erro && (
        <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-xl p-4 mb-6">
          {erro}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">Carregando itens...</div>
      ) : itens.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl text-center py-16">
          <div className="text-5xl mb-4">🔧</div>
          <p className="text-slate-300 font-semibold">Nenhum item encontrado</p>
          <p className="text-slate-500 text-sm mt-1">
            {busca || filtroTipo
              ? "Tente ajustar a busca ou o filtro."
              : isAdmin
                ? "Cadastre o primeiro item para começar."
                : "Ainda não há itens cadastrados."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {itens.map((item) => {
            const estoqueBaixo = item.quantidade <= item.estoqueMinimo;
            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-lg hover:border-cyan-700 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl">
                        {item.tipo === "PECA" ? "🔧" : "📦"}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white truncate">
                          {item.nome}
                        </h3>
                        {item.codigo && (
                          <p className="text-xs text-slate-400">{item.codigo}</p>
                        )}
                      </div>
                    </div>
                    {estoqueBaixo && (
                      <span className="flex-shrink-0 text-xs font-semibold bg-amber-900/60 text-amber-300 border border-amber-700 px-2 py-1 rounded-lg">
                        ⚠️ Estoque baixo
                      </span>
                    )}
                  </div>

                  {item.descricao && (
                    <p className="text-sm text-slate-400 mb-3 line-clamp-2">
                      {item.descricao}
                    </p>
                  )}

                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <p className="text-3xl font-bold text-cyan-300">
                        {item.quantidade}
                      </p>
                      <p className="text-xs text-slate-500">
                        em estoque · mín. {item.estoqueMinimo}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMovimentacao({ item, tipo: "ENTRADA" })}
                      className="flex-1 bg-green-700/80 hover:bg-green-600 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                    >
                      + Entrada
                    </button>
                    <button
                      onClick={() => setMovimentacao({ item, tipo: "SAIDA" })}
                      className="flex-1 bg-red-700/80 hover:bg-red-600 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                    >
                      − Saída
                    </button>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 pt-1 border-t border-slate-800 mt-1">
                      <button
                        onClick={() => setItemEmEdicao(item)}
                        className="flex-1 text-xs font-semibold text-slate-300 hover:text-cyan-300 py-1.5 transition-colors"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => setItemParaDesativar(item)}
                        className="flex-1 text-xs font-semibold text-slate-300 hover:text-red-400 py-1.5 transition-colors"
                      >
                        🗑️ Desativar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {movimentacao && (
        <MovimentacaoModal
          item={movimentacao.item}
          tipo={movimentacao.tipo}
          onClose={() => setMovimentacao(null)}
          onSuccess={() => {
            setMovimentacao(null);
            carregarItens();
          }}
        />
      )}

      {mostrarFormNovo && (
        <ItemFormModal
          onClose={() => setMostrarFormNovo(false)}
          onSuccess={() => {
            setMostrarFormNovo(false);
            carregarItens();
          }}
        />
      )}

      {itemEmEdicao && (
        <ItemFormModal
          item={itemEmEdicao}
          onClose={() => setItemEmEdicao(null)}
          onSuccess={() => {
            setItemEmEdicao(null);
            carregarItens();
          }}
        />
      )}

      {itemParaDesativar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-slate-900 border border-cyan-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-3">Desativar Item</h2>
            <p className="text-slate-300 mb-6">
              Tem certeza que deseja desativar{" "}
              <span className="font-semibold text-white">
                {itemParaDesativar.nome}
              </span>
              ? Ele deixará de aparecer na listagem, mas o histórico de
              movimentações continuará acessível.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setItemParaDesativar(null)}
                disabled={desativando}
                className="px-5 py-2.5 rounded-xl font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDesativar}
                disabled={desativando}
                className="px-5 py-2.5 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-500 shadow-lg transition-colors disabled:opacity-50"
              >
                {desativando ? "Desativando..." : "Desativar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuporteTecnicoLayout>
  );
}
