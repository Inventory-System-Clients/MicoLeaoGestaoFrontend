import { useState } from "react";
import api from "../../services/api";

export function ItemFormModal({ item, onClose, onSuccess }) {
  const isEdicao = !!item;
  const [nome, setNome] = useState(item?.nome || "");
  const [tipo, setTipo] = useState(item?.tipo || "PECA");
  const [codigo, setCodigo] = useState(item?.codigo || "");
  const [descricao, setDescricao] = useState(item?.descricao || "");
  const [estoqueMinimo, setEstoqueMinimo] = useState(
    item?.estoqueMinimo != null ? String(item.estoqueMinimo) : "0",
  );
  const [quantidade, setQuantidade] = useState("0");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");

    if (!nome.trim()) {
      setErro("Informe o nome do item.");
      return;
    }

    try {
      setEnviando(true);
      if (isEdicao) {
        await api.put(`/suporte-tecnico/itens/${item.id}`, {
          nome: nome.trim(),
          tipo,
          codigo: codigo.trim() || undefined,
          descricao: descricao.trim() || undefined,
          estoqueMinimo: Number(estoqueMinimo) || 0,
        });
      } else {
        await api.post("/suporte-tecnico/itens", {
          nome: nome.trim(),
          tipo,
          codigo: codigo.trim() || undefined,
          descricao: descricao.trim() || undefined,
          estoqueMinimo: Number(estoqueMinimo) || 0,
          quantidade: Number(quantidade) || 0,
        });
      }
      onSuccess();
    } catch (error) {
      setErro(
        error.response?.data?.error ||
          `Erro ao ${isEdicao ? "editar" : "criar"} o item. Tente novamente.`,
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-slate-900 border border-cyan-800 rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {isEdicao ? "✏️ Editar Item" : "➕ Novo Item"}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Nome *
            </label>
            <input
              type="text"
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors"
              placeholder="Ex: Motor de Garra"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Tipo *
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors cursor-pointer"
            >
              <option value="PECA">🔧 Peça</option>
              <option value="PRODUTO">📦 Produto</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Código
            </label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors"
              placeholder="Ex: MOT-001"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Descrição
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors resize-none"
              placeholder="Ex: Motor usado nas garras das máquinas"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Estoque Mínimo
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {!isEdicao && (
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Estoque Inicial
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border-2 border-slate-700 text-white outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            )}
          </div>

          {isEdicao && (
            <p className="text-xs text-slate-500">
              A quantidade em estoque não pode ser editada aqui — use os botões de
              Entrada/Saída para ajustar o saldo.
            </p>
          )}

          {erro && (
            <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-lg p-3">
              {erro}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
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
              className="px-5 py-2.5 rounded-xl font-semibold text-white bg-cyan-600 hover:bg-cyan-500 shadow-lg transition-colors disabled:opacity-50"
            >
              {enviando ? "Salvando..." : isEdicao ? "Salvar Alterações" : "Criar Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
