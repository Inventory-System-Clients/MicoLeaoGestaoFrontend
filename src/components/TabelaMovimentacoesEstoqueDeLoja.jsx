import React from "react";

import api from "../services/api";

export default function TabelaMovimentacoesEstoqueDeLoja({
  movimentacoesEstoqueLoja = [],
  lojas = [],
  produtos = [],
  filtroLojaEstoque = "",
  filtroDataInicioEstoque = "",
  filtroDataFimEstoque = "",
  filtroResponsavelEstoque = "",
  setEditandoEstoqueLoja,
  setExcluindoEstoqueLoja,
  onChangeEstoqueLoja, // Função para recarregar estoque consolidado
}) {
  // Função para deletar movimentação e recarregar estoque consolidado
  const handleDelete = async (mov) => {
    if (!window.confirm("Tem certeza que deseja deletar esta movimentação?"))
      return;
    try {
      await api.delete(`/movimentacao-estoque-loja/${mov.id}`);
      if (typeof onChangeEstoqueLoja === "function") onChangeEstoqueLoja();
    } catch (err) {
      alert("Erro ao deletar movimentação de estoque de loja.");
    }
  };

  // Função para editar movimentação (apenas abre modal, recarrega estoque deve ser feito após salvar no modal principal)

  const movimentacoesFiltradas = movimentacoesEstoqueLoja.filter((mov) => {
    const dataMovimentacao = mov.dataMovimentacao?.slice(0, 10);
    const hoje = new Date().toISOString().slice(0, 10);
    const semFiltroDeData = !filtroDataInicioEstoque && !filtroDataFimEstoque;
    const dentroDoPeriodo = semFiltroDeData
      ? dataMovimentacao === hoje
      : (!filtroDataInicioEstoque ||
          (dataMovimentacao && dataMovimentacao >= filtroDataInicioEstoque)) &&
        (!filtroDataFimEstoque ||
          (dataMovimentacao && dataMovimentacao <= filtroDataFimEstoque));

    return (
      (!filtroLojaEstoque || mov.loja?.id === filtroLojaEstoque) &&
      (!filtroResponsavelEstoque ||
        (mov.usuario?.nome &&
          mov.usuario.nome
            .toLowerCase()
            .includes(filtroResponsavelEstoque.toLowerCase()))) &&
      dentroDoPeriodo
    );
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 md:px-6 py-3 border-b border-slate-200 bg-linear-to-r from-slate-50 to-white flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Resultados</p>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {movimentacoesFiltradas.length} registro(s)
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
            {movimentacoesFiltradas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-600">
                    Nenhuma movimentação encontrada
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Ajuste os filtros para visualizar outros registros.
                  </p>
                </td>
              </tr>
            )}

            {movimentacoesFiltradas.map((mov) => {
              const data = mov.dataMovimentacao
                ? new Date(mov.dataMovimentacao)
                : null;

              return (
                <tr
                  key={mov.id}
                  className="bg-white hover:bg-slate-50/70 transition-colors"
                >
                  <td className="px-4 py-3 align-middle whitespace-nowrap text-center">
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

                  <td className="px-4 py-3 align-middle text-center">
                    <p className="text-base font-semibold text-slate-800">
                      {mov.loja?.nome || mov.lojaId || "-"}
                    </p>
                  </td>

                  <td className="px-4 py-3 align-middle text-center">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-base font-medium text-slate-700">
                      {mov.usuario?.nome || "-"}
                    </span>
                  </td>

                  <td className="px-4 py-3 align-middle text-center">
                    {mov.produtosEnviados && mov.produtosEnviados.length > 0 ? (
                      <ul className="space-y-1">
                        {mov.produtosEnviados.map((prod, index) => {
                          // Debug: log da primeira entrada
                          if (index === 0) {
                            console.log("📦 Prod:", prod);
                            console.log(
                              "📦 Produtos lista:",
                              produtos.slice(0, 2),
                            );
                          }

                          // Tentar obter o produto de várias formas
                          let produtoRenderizado = null;

                          // 1. Se já vem o objeto produto completo
                          if (prod.produto?.id) {
                            produtoRenderizado = prod.produto;
                          }

                          // 2. Se não, tenta encontrar pelo ID em múltiplos campos
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

                          // 3. Se mesmo assim não achou, usa fallback
                          const emojiDisplay =
                            produtoRenderizado?.emoji || "📦";
                          const nomeDisplay =
                            produtoRenderizado?.nome ||
                            prod.produto?.nome ||
                            prod.produtoId ||
                            "Desconhecido";

                          return (
                            <li
                              key={prod.id || `${mov.id}-${index}`}
                              className="text-base text-slate-700 leading-snug flex items-center justify-center gap-2"
                            >
                              <span>{emojiDisplay}</span>
                              <span>{nomeDisplay}</span>
                              <span className="font-bold">
                                {" "}
                                — {prod.quantidade}
                              </span>{" "}
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

                  <td className="px-4 py-3 align-middle text-center">
                    <button
                      className="inline-flex items-center justify-center rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-bold text-base px-4 py-2 shadow-sm transition-all"
                      onClick={() => setEditandoEstoqueLoja(mov)}
                    >
                      Editar
                    </button>
                  </td>

                  <td className="px-4 py-3 align-middle text-center">
                    <button
                      className="inline-flex items-center justify-center rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-base px-4 py-2 shadow-sm transition-all"
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
