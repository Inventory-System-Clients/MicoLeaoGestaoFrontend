import { useState, useEffect } from "react";
import api from "../../services/api";
import { CATEGORIAS_POR_TIPO } from "./categoriaUtils";

const formatarDataCurta = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export function MovimentacaoModal({ item, tipo, onClose, onSuccess }) {
  const [categoria, setCategoria] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const [devolucoesPendentes, setDevolucoesPendentes] = useState([]);
  const [carregandoDevolucoes, setCarregandoDevolucoes] = useState(false);
  const [devolucaoPendenteId, setDevolucaoPendenteId] = useState("");

  const isEntrada = tipo === "ENTRADA";
  const isDevolucao = categoria === "DEVOLUCAO";
  const opcoesCategoria = CATEGORIAS_POR_TIPO[tipo] || [];

  useEffect(() => {
    if (!isEntrada) return;
    let ativo = true;
    setCarregandoDevolucoes(true);
    api
      .get("/suporte-tecnico/devolucoes-pendentes", {
        params: { itemId: item.id },
      })
      .then((res) => {
        if (ativo) setDevolucoesPendentes(res.data || []);
      })
      .catch(() => {
        if (ativo) setDevolucoesPendentes([]);
      })
      .finally(() => {
        if (ativo) setCarregandoDevolucoes(false);
      });
    return () => {
      ativo = false;
    };
  }, [isEntrada, item.id]);

  const handleSelecionarCategoria = (novaCategoria) => {
    setCategoria(novaCategoria);
    setErro("");
    if (novaCategoria !== "DEVOLUCAO") {
      setDevolucaoPendenteId("");
      setQuantidade("");
    }
  };

  const handleSelecionarDevolucao = (id) => {
    setDevolucaoPendenteId(id);
    const devolucao = devolucoesPendentes.find((d) => d.id === id);
    if (devolucao) {
      setQuantidade(String(devolucao.quantidade));
      if (!motivo.trim()) {
        setMotivo(devolucao.motivo || "");
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");

    if (!categoria) {
      setErro("Selecione a categoria da movimentação.");
      return;
    }
    if (isDevolucao && !devolucaoPendenteId) {
      setErro("Selecione a devolução pendente correspondente.");
      return;
    }

    const qtd = Number(quantidade);
    if (!qtd || qtd <= 0) {
      setErro("Informe uma quantidade válida (maior que zero).");
      return;
    }
    if (!motivo.trim()) {
      setErro("Informe o motivo da movimentação.");
      return;
    }

    try {
      setEnviando(true);
      await api.post("/suporte-tecnico/movimentacoes", {
        itemId: item.id,
        tipo,
        categoria,
        quantidade: qtd,
        motivo: motivo.trim(),
        ...(isDevolucao ? { devolucaoPendenteId } : {}),
      });
      onSuccess();
    } catch (error) {
      setErro(
        error.response?.data?.error ||
          "Erro ao registrar a movimentação. Tente novamente.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-slate-900 border border-cyan-800 rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {isEntrada ? "➕ Entrada" : "➖ Saída"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 bg-slate-800/60 rounded-lg p-3 border border-slate-700">
          <p className="text-sm text-slate-300">
            {item.tipo === "PECA" ? "🔧" : "📦"}{" "}
            <span className="font-semibold text-white">{item.nome}</span>
            {item.codigo && (
              <span className="text-slate-400"> · {item.codigo}</span>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Quantidade atual: <span className="font-semibold text-cyan-300">{item.quantidade}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Categoria
            </label>
            <div className="grid grid-cols-2 gap-2">
              {opcoesCategoria.map((opcao) => {
                const desabilitada =
                  opcao.value === "DEVOLUCAO" &&
                  !carregandoDevolucoes &&
                  devolucoesPendentes.length === 0;
                return (
                  <button
                    key={opcao.value}
                    type="button"
                    disabled={desabilitada}
                    onClick={() => handleSelecionarCategoria(opcao.value)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                      categoria === opcao.value
                        ? "bg-cyan-600 border-cyan-500 text-white"
                        : desabilitada
                          ? "bg-slate-800/40 border-slate-800 text-slate-600 cursor-not-allowed"
                          : "bg-slate-800 border-slate-700 text-slate-300 hover:border-cyan-600"
                    }`}
                  >
                    {opcao.label}
                  </button>
                );
              })}
            </div>
            {isEntrada && !carregandoDevolucoes && devolucoesPendentes.length === 0 && (
              <p className="text-xs text-slate-500 mt-2">
                Não há devoluções pendentes para este item.
              </p>
            )}
          </div>

          {isDevolucao ? (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Devolução pendente
              </label>
              {carregandoDevolucoes ? (
                <p className="text-sm text-slate-400">
                  Carregando devoluções pendentes...
                </p>
              ) : (
                <select
                  value={devolucaoPendenteId}
                  onChange={(e) => handleSelecionarDevolucao(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors cursor-pointer"
                >
                  <option value="">Selecione a devolução...</option>
                  {devolucoesPendentes.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.quantidade} un. · {formatarDataCurta(d.createdAt)} ·{" "}
                      {d.movimentacaoOrigem?.usuario?.nome || "—"}
                    </option>
                  ))}
                </select>
              )}

              {devolucaoPendenteId && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Quantidade (travada pela devolução selecionada)
                  </label>
                  <input
                    type="number"
                    value={quantidade}
                    readOnly
                    className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border-2 border-slate-800 text-cyan-300 font-semibold outline-none cursor-not-allowed"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Quantidade
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors"
                placeholder="Ex: 2"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Motivo
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors resize-none"
              placeholder={
                isEntrada
                  ? "Ex: Reposição de estoque"
                  : "Ex: Usado na manutenção da máquina 12 da Loja Shopping"
              }
            />
          </div>

          {erro && (
            <div className="mb-4 bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg p-3">
              {erro}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="px-5 py-2.5 rounded-xl font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className={`px-5 py-2.5 rounded-xl font-semibold text-white shadow-lg transition-colors disabled:opacity-50 ${
                isEntrada
                  ? "bg-green-600 hover:bg-green-500"
                  : "bg-red-600 hover:bg-red-500"
              }`}
            >
              {enviando ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
