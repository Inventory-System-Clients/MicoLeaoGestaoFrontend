import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, Badge, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

const obterStatusMaquina = (maquina) => {
  const status = maquina.statusOperacao || maquina.status_operacao;
  const mapa = {
    EM_OPERACAO: { label: "Em operação", variant: "success" },
    EM_MANUTENCAO: { label: "Em manutenção", variant: "warning" },
    PRONTA_PARA_SAIDA: { label: "Pronta para saída", variant: "info" },
    PARADA: { label: "Parada", variant: "danger" },
    EM_TRANSPORTE: { label: "Em transporte", variant: "warning" },
  };

  if (status && mapa[status]) return mapa[status];
  if (maquina.ativo === false) return mapa.PARADA;
  return mapa.EM_OPERACAO;
};

export function MaquinaDetalhes() {
  const { id } = useParams();
  // const location = useLocation(); // Removido pois não é utilizado
  const [maquina, setMaquina] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [estoqueAtual, setEstoqueAtual] = useState(null);
  const [alertaInconsistencia, setAlertaInconsistencia] = useState(null);
  const [alertaAbastecimento, setAlertaAbastecimento] = useState(null);
  const [produtoUltimaMov, setProdutoUltimaMov] = useState(null);

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line
  }, [id]);

  // Atualiza o estoque atual e produto da última movimentação sempre que as movimentações mudam
  useEffect(() => {
    if (movimentacoes && movimentacoes.length > 0) {
      // Considera o campo totalPos, se existir, senão tenta outros nomes comuns
      const ultimaMov = movimentacoes[0];
      const totalPos =
        ultimaMov.totalPos ?? ultimaMov.total_pos ?? ultimaMov.totalpos ?? null;
      setEstoqueAtual(totalPos);

      // Extrai produto da última movimentação
      if (
        ultimaMov.detalhesProdutos &&
        Array.isArray(ultimaMov.detalhesProdutos) &&
        ultimaMov.detalhesProdutos.length > 0
      ) {
        const prod = ultimaMov.detalhesProdutos[0];
        setProdutoUltimaMov({ nome: prod.nome, emoji: prod.emoji });
      } else {
        setProdutoUltimaMov(null);
      }
    } else {
      setEstoqueAtual(null);
      setProdutoUltimaMov(null);
    }
  }, [movimentacoes]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [
        maquinaRes,
        movimentacoesRes,
        resInconsistencia,
        resAbastecimento,
      ] = await Promise.all([
        api.get(`/maquinas/${id}`),
        api.get(`/movimentacoes?maquinaId=${id}`),
        api.get(
          `/relatorios/alertas-movimentacao-inconsistente?maquinaId=${id}`,
        ),
        api.get(`/relatorios/alertas-abastecimento-incompleto?maquinaId=${id}`),
      ]);
      setMaquina(maquinaRes.data);
      setMovimentacoes(movimentacoesRes.data);

      // Valida se o alerta realmente pertence a esta máquina
      const alertaInc = resInconsistencia.data?.alertas?.[0];
      if (alertaInc && String(alertaInc.maquinaId) === String(id)) {
        setAlertaInconsistencia(alertaInc);
      } else {
        setAlertaInconsistencia(null);
      }

      const alertaAbast = resAbastecimento.data?.alertas?.[0];
      if (alertaAbast && String(alertaAbast.maquinaId) === String(id)) {
        setAlertaAbastecimento(alertaAbast);
      } else {
        setAlertaAbastecimento(null);
      }
    } catch (error) {
      setError(
        "Erro ao carregar dados: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader />;

  if (error) return <AlertBox type="error" message={error} />;

  if (!maquina)
    return <AlertBox type="error" message="Máquina não encontrada." />;
  const statusMaquina = obterStatusMaquina(maquina);

  return (
    <div className="min-h-screen bg-background-light">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-4 mb-4">
          <button
            className="btn-secondary"
            onClick={() =>
              window.history.length > 1
                ? window.history.back()
                : window.location.assign("/alertas")
            }
          >
            Voltar para Alertas
          </button>
          <button
            className="btn-danger"
            onClick={async () => {
              try {
                await api.delete(
                  `/relatorios/alertas-movimentacao-inconsistente/${maquina.alertaId}`,
                  { data: { maquinaId: maquina.id } },
                );
                window.location.assign("/alertas");
              } catch (error) {
                alert("Erro ao marcar como corrigido.", error);
              }
            }}
            disabled={!maquina.alertaId}
            title="Marcar este alerta como corrigido"
          >
            Corrigido
          </button>
        </div>
        <PageHeader
          title={`Informações da Máquina: ${maquina.nome}`}
          subtitle={maquina.codigo}
          icon="🎰"
        />
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          {/* Nome da loja */}
          <p className="mb-2 text-sm text-gray-700">
            <strong>Loja:</strong>{" "}
            {maquina.lojaNome || maquina.loja?.nome || "-"}
          </p>
          <div className="mb-4">
            <Badge variant={statusMaquina.variant}>{statusMaquina.label}</Badge>
          </div>
          {/* Detalhes dos alertas */}
          {alertaInconsistencia && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-yellow-900">
              <strong>Alerta de Inconsistência:</strong>
              <br />
              {(() => {
                const movs = movimentacoes.slice(0, 2);
                if (movs.length < 2)
                  return <span>Não há movimentações suficientes.</span>;
                const atual = movs[0];
                const anterior = movs[1];
                const diffOut =
                  (atual.contadorOut || 0) - (anterior.contadorOut || 0);
                const diffIn =
                  (atual.contadorIn || 0) - (anterior.contadorIn || 0);
                const saida = atual.sairam ?? 0;
                const fichas = atual.fichas ?? 0;
                const outInconsistente = diffOut !== saida;
                const inInconsistente = diffIn !== fichas;
                return (
                  <>
                    {outInconsistente && (
                      <div className="mb-2">
                        <span className="font-bold text-yellow-800">
                          Saída (OUT):
                        </span>
                        <br />
                        Contador OUT anterior:{" "}
                        <strong>{anterior.contadorOut ?? "-"}</strong>
                        <br />
                        Contador OUT atual:{" "}
                        <strong>{atual.contadorOut ?? "-"}</strong>
                        <br />
                        Era para ter saído: <strong>{diffOut}</strong>
                        <br />
                        Saída registrada: <strong>{saida}</strong>
                        <br />
                        Diferença: <strong>{diffOut - saida}</strong>
                      </div>
                    )}
                    {inInconsistente && (
                      <div className="mb-2">
                        <span className="font-bold text-yellow-800">
                          Entrada (IN):
                        </span>
                        <br />
                        Contador IN anterior:{" "}
                        <strong>{anterior.contadorIn ?? "-"}</strong>
                        <br />
                        Contador IN atual:{" "}
                        <strong>{atual.contadorIn ?? "-"}</strong>
                        <br />
                        Era para ter entrado: <strong>{diffIn}</strong>
                        <br />
                        Fichas registradas: <strong>{fichas}</strong>
                        <br />
                        Diferença: <strong>{diffIn - fichas}</strong>
                      </div>
                    )}
                    {!outInconsistente && !inInconsistente && (
                      <span>Sem inconsistência detectada.</span>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          {alertaAbastecimento && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded text-yellow-900">
              <strong>Alerta de Abastecimento Incompleto:</strong>
              <br />
              {alertaAbastecimento.mensagem ||
                `Abastecimento incompleto: padrão ${alertaAbastecimento.padrao}, tinha ${alertaAbastecimento.anterior}, abastecido ${alertaAbastecimento.abastecido}. Motivo: ${alertaAbastecimento.observacao || "-"}`}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p>
                <strong>Tipo:</strong>{" "}
                {produtoUltimaMov ? (
                  <span>
                    {produtoUltimaMov.emoji ? (
                      <span>{produtoUltimaMov.emoji}</span>
                    ) : null}{" "}
                    {produtoUltimaMov.nome}
                  </span>
                ) : (
                  <>
                    {maquina.emoji ? <span>{maquina.emoji}</span> : null}{" "}
                    {maquina.tipo || "-"}
                  </>
                )}
              </p>
              <p>
                <strong>Capacidade:</strong>{" "}
                {maquina.capacidadePadrao || maquina.capacidade || "-"}
              </p>
              <p>
                <strong>Estoque Atual:</strong>{" "}
                {estoqueAtual !== null && estoqueAtual !== undefined
                  ? estoqueAtual
                  : "-"}
              </p>
              <p>
                <strong>Valor da Ficha:</strong> R${" "}
                {typeof maquina.valorFicha === "number"
                  ? maquina.valorFicha.toFixed(2)
                  : maquina.valorFicha || "-"}
              </p>
            </div>
            <div>
              <p>
                <strong>Força Fraca:</strong> {maquina.forcaFraca ?? "-"}%
              </p>
              <p>
                <strong>Força Forte:</strong> {maquina.forcaForte ?? "-"}%
              </p>
              <p>
                <strong>Força Premium:</strong> {maquina.forcaPremium ?? "-"}%
              </p>
              <p>
                <strong>Jogadas Premium:</strong>{" "}
                {maquina.jogadasPremium ?? "-"}
              </p>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">Últimas 2 Movimentações</h2>
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          {movimentacoes.length < 2 ? (
            <p className="text-gray-500">
              Nenhuma movimentação suficiente encontrada.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2">Data</th>
                  <th className="text-left py-2">Contador IN</th>
                  <th className="text-left py-2">Contador OUT</th>
                  <th className="text-left py-2">Fichas</th>
                  <th className="text-left py-2">Saída</th>
                  <th className="text-left py-2">Observação</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.slice(0, 2).map((mov) => (
                  <tr key={mov.id} className="border-b">
                    <td>
                      {new Date(mov.dataColeta || mov.createdAt).toLocaleString(
                        "pt-BR",
                      )}
                    </td>
                    <td>{mov.contadorIn ?? "-"}</td>
                    <td>{mov.contadorOut ?? "-"}</td>
                    <td>{mov.fichas ?? "-"}</td>
                    <td>{mov.sairam ?? "-"}</td>
                    <td>{mov.observacoes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default MaquinaDetalhes;
