import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import { SuporteTecnicoLayout } from "./SuporteTecnicoLayout";

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

export function SuporteTecnicoDevolucoesPendentes() {
  const [devolucoes, setDevolucoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const carregarDevolucoes = useCallback(async () => {
    try {
      setLoading(true);
      setErro("");
      const response = await api.get("/suporte-tecnico/devolucoes-pendentes", {
        params: { status: "PENDENTE" },
      });
      setDevolucoes(response.data || []);
    } catch (error) {
      setErro(
        error.response?.data?.error ||
          "Erro ao carregar as devoluções pendentes.",
      );
      setDevolucoes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDevolucoes();
  }, [carregarDevolucoes]);

  return (
    <SuporteTecnicoLayout activeTab="devolucoes">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Devoluções Pendentes
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Trocas registradas que ainda aguardam a peça/produto de volta.
          </p>
        </div>
        <button
          onClick={carregarDevolucoes}
          className="text-sm font-semibold text-cyan-300 hover:text-cyan-200 border border-cyan-800 hover:border-cyan-600 px-4 py-2 rounded-xl transition-colors self-start"
        >
          🔄 Atualizar
        </button>
      </div>

      {erro && (
        <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm rounded-xl p-4 mb-6">
          {erro}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">
          Carregando devoluções pendentes...
        </div>
      ) : devolucoes.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl text-center py-16">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-slate-300 font-semibold">
            Nenhuma devolução pendente
          </p>
          <p className="text-slate-500 text-sm mt-1">
            Todas as trocas registradas já foram resolvidas.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-800/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Item
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Quantidade
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Motivo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Troca registrada por
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {devolucoes.map((dev) => (
                  <tr key={dev.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-sm text-white">
                      <div className="flex items-center gap-2">
                        <span>{dev.item?.tipo === "PECA" ? "🔧" : "📦"}</span>
                        <div>
                          <div className="font-medium">{dev.item?.nome}</div>
                          {dev.item?.codigo && (
                            <div className="text-xs text-slate-500">
                              {dev.item.codigo}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-900/50 text-teal-300 border border-teal-700">
                        {dev.quantidade} un.
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 max-w-xs">
                      {dev.motivo}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                      {dev.movimentacaoOrigem?.usuario?.nome || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">
                      {formatarDataHora(dev.createdAt)}
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
