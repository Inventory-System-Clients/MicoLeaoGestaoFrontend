import { useEffect, useState } from "react";
import api from "../services/api";
import { STATUS_TAREFA, dataBr, dataHoraBr, mensagemDeErro } from "../utils/tarefas";

// Tarefas do período no Relatório (pages/Relatorios.jsx): totais, por pessoa
// e a lista (com quem criou, para quem, quem fez e quando).
export function RelatorioTarefas({ dataInicio, dataFim, lojaId }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [mostrarLista, setMostrarLista] = useState(false);

  useEffect(() => {
    if (!dataInicio || !dataFim) return;
    api
      .get("/tarefas/relatorio", { params: { dataInicio, dataFim, lojaId: lojaId || undefined } })
      .then(({ data }) => {
        setDados(data);
        setErro("");
      })
      .catch((error) => setErro(mensagemDeErro(error, "Erro ao carregar as tarefas.")));
  }, [dataInicio, dataFim, lojaId]);

  if (erro) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>;
  if (!dados) return null;
  const { totais } = dados;

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xl font-bold text-gray-900">✅ Tarefas do período</h3>
        <span className="text-sm text-gray-500">
          {dataBr(dataInicio)} a {dataBr(dataFim)}
          {lojaId && lojaId !== "todas" ? " · tarefas desta loja" : ""}
        </span>
      </div>

      {totais.total === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma tarefa com dia neste período.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Total", totais.total, "text-gray-900"],
              ["Feitas", totais.feitas, "text-green-700"],
              ["Feitas no prazo", totais.noPrazo, "text-green-700"],
              ["Abertas", totais.abertas, "text-blue-700"],
              ["Atrasadas", totais.atrasadas, "text-red-700"],
              ["Recusadas", totais.recusadas, "text-amber-700"],
            ].map(([titulo, valor, cor]) => (
              <div key={titulo} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">{titulo}</p>
                <p className={`text-2xl font-black ${cor}`}>{valor}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Responsável</th>
                  <th>Total</th>
                  <th>Feitas</th>
                  <th>No prazo</th>
                  <th>Abertas</th>
                  <th>Atrasadas</th>
                  <th>Recusadas</th>
                </tr>
              </thead>
              <tbody>
                {dados.porResponsavel.map((linha) => (
                  <tr key={linha.nome}>
                    <td className="font-semibold">{linha.nome}</td>
                    <td>{linha.total}</td>
                    <td>{linha.feitas}</td>
                    <td>{linha.noPrazo}</td>
                    <td>{linha.abertas}</td>
                    <td className={linha.atrasadas ? "font-bold text-red-700" : ""}>{linha.atrasadas}</td>
                    <td>{linha.recusadas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button type="button" className="mt-3 text-sm font-semibold text-primary hover:underline" onClick={() => setMostrarLista((v) => !v)}>
            {mostrarLista ? "▲ Esconder tarefas" : `▼ Ver as ${totais.total} tarefas`}
          </button>
          {mostrarLista && (
            <div className="mt-2 overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Dia</th>
                    <th>Tarefa</th>
                    <th>Criou</th>
                    <th>Para</th>
                    <th>Status</th>
                    <th>Feita</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.tarefas.map((tarefa) => (
                    <tr key={tarefa.id}>
                      <td className="font-mono text-xs">{tarefa.codigo}</td>
                      <td className={tarefa.atrasada ? "font-bold text-red-700" : ""}>{tarefa.dataFim ? `${dataBr(tarefa.data)} a ${dataBr(tarefa.dataFim)}` : dataBr(tarefa.data)}</td>
                      <td>
                        {tarefa.titulo}
                        {tarefa.resultado?.mensagem && <span className="block text-xs text-gray-500">{tarefa.resultado.mensagem}</span>}
                      </td>
                      <td>{tarefa.criadoPor?.nome || "Sistema"}</td>
                      <td>{(tarefa.pessoas || []).map((p) => p.nome).join(", ") || tarefa.responsavel?.nome || "—"}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${(STATUS_TAREFA[tarefa.status] || {}).cor || ""}`}>
                          {(STATUS_TAREFA[tarefa.status] || {}).nome || tarefa.status}
                        </span>
                      </td>
                      <td className="text-xs">
                        {tarefa.feitaEm ? `${dataHoraBr(tarefa.feitaEm)} · ${tarefa.feitaPor?.nome || ""}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default RelatorioTarefas;
