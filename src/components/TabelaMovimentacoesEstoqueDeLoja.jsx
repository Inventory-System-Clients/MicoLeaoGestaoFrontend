import api from "../services/api";
import { confirmar, erro } from "../utils/alerts";

export default function TabelaMovimentacoesEstoqueDeLoja({
  movimentacoesEstoqueLoja = [],
  produtos = [],
  setEditandoEstoqueLoja,
  onChangeEstoqueLoja,
}) {
  const handleDelete = async (mov) => {
    const confirmado = await confirmar({
      title: "Deletar movimentação?",
      text: "Esta movimentação de estoque será removida.",
      confirmButtonText: "Deletar",
    });
    if (!confirmado) return;

    try {
      await api.delete(`/movimentacao-estoque-loja/${mov.id}`);
      if (typeof onChangeEstoqueLoja === "function") onChangeEstoqueLoja();
    } catch {
      erro("Erro ao deletar", "Erro ao deletar movimentação de estoque de loja.");
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-linear-to-r from-slate-50 to-white px-4 py-3 md:px-6">
        <p className="text-sm font-semibold text-slate-700">Resultados</p>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {movimentacoesEstoqueLoja.length} registro(s)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full table-auto">
          <thead>
            <tr className="bg-slate-50/80 text-slate-700">
              <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wide">
                Data/Hora
              </th>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wide">
                Loja de Destino
              </th>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wide">
                Responsável
              </th>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wide">
                Produtos Enviados
              </th>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wide">
                Editar
              </th>
              <th className="px-4 py-3 text-center text-sm font-bold uppercase tracking-wide">
                Deletar
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {movimentacoesEstoqueLoja.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-600">
                    Nenhuma movimentação encontrada
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Ajuste os filtros para visualizar outros registros.
                  </p>
                </td>
              </tr>
            )}

            {movimentacoesEstoqueLoja.map((mov) => {
              const data = mov.dataMovimentacao
                ? new Date(mov.dataMovimentacao)
                : null;

              return (
                <tr
                  key={mov.id}
                  className="bg-white transition-colors hover:bg-slate-50/70"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-center align-middle">
                    {data ? (
                      <div>
                        <p className="text-base font-semibold text-slate-800">
                          {data.toLocaleDateString("pt-BR")}
                        </p>
                        <p className="text-sm text-slate-500">
                          {data.toLocaleTimeString("pt-BR")}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-500">-</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center align-middle">
                    <p className="text-base font-semibold text-slate-800">
                      {mov.loja?.nome || mov.lojaId || "-"}
                    </p>
                  </td>

                  <td className="px-4 py-3 text-center align-middle">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-base font-medium text-slate-700">
                      {mov.usuario?.nome || "-"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-center align-middle">
                    {mov.produtosEnviados && mov.produtosEnviados.length > 0 ? (
                      <ul className="space-y-1">
                        {mov.produtosEnviados.map((prod, index) => {
                          let produtoRenderizado = null;

                          if (prod.produto?.id) {
                            produtoRenderizado = prod.produto;
                          }

                          const prodIdValue = prod.produtoId || prod.produto_id;
                          if (
                            !produtoRenderizado &&
                            prodIdValue &&
                            produtos.length > 0
                          ) {
                            produtoRenderizado = produtos.find(
                              (p) => String(p.id) === String(prodIdValue),
                            );
                          }

                          const emojiDisplay = produtoRenderizado?.emoji || "📦";
                          const nomeDisplay =
                            produtoRenderizado?.nome ||
                            prod.produto?.nome ||
                            prod.produtoId ||
                            "Desconhecido";

                          return (
                            <li
                              key={prod.id || `${mov.id}-${index}`}
                              className="flex items-center justify-center gap-2 text-base leading-snug text-slate-700"
                            >
                              <span>{emojiDisplay}</span>
                              <span>{nomeDisplay}</span>
                              <span className="font-bold"> — {prod.quantidade}</span>{" "}
                              <span
                                className={`font-semibold ${
                                  prod.tipoMovimentacao === "entrada"
                                    ? "text-emerald-600"
                                    : "text-red-600"
                                }`}
                              >
                                [{prod.tipoMovimentacao}]
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <span className="text-sm text-slate-500">-</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center align-middle">
                    <button
                      className="inline-flex items-center justify-center rounded-xl bg-amber-400 px-4 py-2 text-base font-bold text-white shadow-sm transition-all hover:bg-amber-500"
                      onClick={() => setEditandoEstoqueLoja(mov)}
                    >
                      Editar
                    </button>
                  </td>

                  <td className="px-4 py-3 text-center align-middle">
                    <button
                      className="inline-flex items-center justify-center rounded-xl bg-red-500 px-4 py-2 text-base font-bold text-white shadow-sm transition-all hover:bg-red-600"
                      onClick={() => handleDelete(mov)}
                    >
                      Deletar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
