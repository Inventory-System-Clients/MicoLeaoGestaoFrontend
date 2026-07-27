import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import { SuporteTecnicoLayout } from "./SuporteTecnicoLayout";
import { CATEGORIA_LABELS, CATEGORIA_BADGE_CLASSES } from "./categoriaUtils";

const formatarDataHora = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function SuporteTecnicoHistorico() {
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [filtroItemId, setFiltroItemId] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroUsuarioId, setFiltroUsuarioId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  useEffect(() => {
    api
      .get("/suporte-tecnico/itens")
      .then((res) => setItens(res.data || []))
      .catch(() => setItens([]));
  }, []);

  const carregarMovimentacoes = useCallback(async () => {
    try {
      setLoading(true);
      setErro("");
      const params = {};
      if (filtroItemId) params.itemId = filtroItemId;
      if (filtroTipo) params.tipo = filtroTipo;
      if (filtroCategoria) params.categoria = filtroCategoria;
      if (filtroUsuarioId) params.usuarioId = filtroUsuarioId;
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;

      const response = await api.get("/suporte-tecnico/movimentacoes", {
        params,
      });
      setMovimentacoes(response.data || []);
    } catch (error) {
      setErro(
        error.response?.data?.error ||
          "Erro ao carregar o histórico de movimentações.",
      );
      setMovimentacoes([]);
    } finally {
      setLoading(false);
    }
  }, [filtroItemId, filtroTipo, filtroCategoria, filtroUsuarioId, dataInicio, dataFim]);

  useEffect(() => {
    carregarMovimentacoes();
  }, [carregarMovimentacoes]);

  const usuariosUnicos = Array.from(
    new Map(
      movimentacoes
        .filter((m) => m.usuario)
        .map((m) => [m.usuario.id, m.usuario]),
    ).values(),
  );

  const limparFiltros = () => {
    setFiltroItemId("");
    setFiltroTipo("");
    setFiltroCategoria("");
    setFiltroUsuarioId("");
    setDataInicio("");
    setDataFim("");
  };

  return (
    <SuporteTecnicoLayout activeTab="historico">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">
          Histórico de Movimentações
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Quem mexeu, quando e por quê.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <select
            value={filtroItemId}
            onChange={(e) => setFiltroItemId(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white text-sm outline-none focus:border-cyan-500 transition-colors cursor-pointer"
          >
            <option value="">Todos os itens</option>
            {itens.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome} {item.codigo ? `(${item.codigo})` : ""}
              </option>
            ))}
          </select>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white text-sm outline-none focus:border-cyan-500 transition-colors cursor-pointer"
          >
            <option value="">Todos os tipos</option>
            <option value="ENTRADA">Entrada</option>
            <option value="SAIDA">Saída</option>
          </select>

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white text-sm outline-none focus:border-cyan-500 transition-colors cursor-pointer"
          >
            <option value="">Todas as categorias</option>
            {Object.entries(CATEGORIA_LABELS).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={filtroUsuarioId}
            onChange={(e) => setFiltroUsuarioId(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white text-sm outline-none focus:border-cyan-500 transition-colors cursor-pointer"
          >
            <option value="">Todos os usuários</option>
            {usuariosUnicos.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white text-sm outline-none focus:border-cyan-500 transition-colors"
          />

          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white text-sm outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
        {(filtroItemId || filtroTipo || filtroCategoria || filtroUsuarioId || dataInicio || dataFim) && (
          <button
            onClick={limparFiltros}
            className="mt-3 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {erro && (
        <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-xl p-4 mb-6">
          {erro}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">
          Carregando histórico...
        </div>
      ) : movimentacoes.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl text-center py-16">
          <div className="text-5xl mb-4">🕒</div>
          <p className="text-slate-300 font-semibold">
            Nenhuma movimentação encontrada
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Ajuste os filtros ou registre a primeira movimentação.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Data/Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Quantidade
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Motivo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Usuário
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {movimentacoes.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                      {formatarDataHora(mov.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">
                      <div className="flex items-center gap-2">
                        <span>{mov.item?.tipo === "PECA" ? "🔧" : "📦"}</span>
                        <div>
                          <div className="font-medium">{mov.item?.nome}</div>
                          {mov.item?.codigo && (
                            <div className="text-xs text-slate-500">
                              {mov.item.codigo}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          mov.tipo === "ENTRADA"
                            ? "bg-green-900/50 text-green-300 border border-green-700"
                            : "bg-red-900/50 text-red-300 border border-red-700"
                        }`}
                      >
                        {mov.tipo === "ENTRADA" ? "Entrada" : "Saída"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {mov.categoria && (
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            CATEGORIA_BADGE_CLASSES[mov.categoria] ||
                            "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {CATEGORIA_LABELS[mov.categoria] || mov.categoria}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {mov.quantidade}
                      <span className="text-xs text-slate-500 ml-1">
                        ({mov.quantidadeAnterior} → {mov.quantidadeAtual})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 max-w-xs">
                      {mov.motivo}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                      {mov.usuario?.nome}
                      {mov.usuario?.role && (
                        <span className="text-xs text-slate-500 block">
                          {mov.usuario.role === "ADMIN" ? "Administrador" : "Funcionário"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SuporteTecnicoLayout>
  );
}
