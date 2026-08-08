import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { Navbar } from "../components/Navbar";
import { useAuth } from "../contexts/AuthContext";
import { AlertBox, Badge, Modal } from "../components/UIComponents";
import api from "../services/api";
import { confirmar } from "../utils/alerts";

const statusMapa = {
  EM_OPERACAO: { label: "Em operação", variant: "success" },
  EM_MANUTENCAO: { label: "Em manutenção", variant: "warning" },
  PRONTA_PARA_SAIDA: { label: "Pronta para saída", variant: "info" },
  PARADA: { label: "Parada", variant: "danger" },
  SEM_LOJA: { label: "Sem loja", variant: "info" },
  INATIVA: { label: "Inativa", variant: "danger" },
};

const statusManutencaoMapa = {
  ABERTA: { label: "Aberta", variant: "warning" },
  EM_ANDAMENTO: { label: "Em andamento", variant: "info" },
  AGUARDANDO_PECA: { label: "Aguardando peça", variant: "danger" },
  CONCLUIDA: { label: "Concluída", variant: "success" },
};

const tipoProblemaMapa = {
  MECANICO: "Mecânico",
  ELETRICO: "Elétrico",
  SOFTWARE: "Software/Sistema",
  LIMPEZA: "Limpeza/Higienização",
  ESTRUTURAL: "Estrutural da loja",
  OUTRO: "Outro",
};

const numero = (valor) => Number(valor || 0);

const formatarDataHora = (valor) => {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR");
};

const formatarDataInput = (valor) => {
  if (!valor) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  const dataLocal = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
  return dataLocal.toISOString().slice(0, 16);
};

const obterStatus = (maquina) => {
  if (!maquina?.ativo) return statusMapa.INATIVA;
  if (!maquina?.lojaId) return statusMapa.SEM_LOJA;
  return (
    statusMapa[maquina.statusOperacao || maquina.status_operacao] ||
    statusMapa.PARADA
  );
};

const obterProdutoMovimentacao = (movimentacao) => {
  const detalhe = movimentacao?.detalhesProdutos?.[0];
  return detalhe?.produto || detalhe || null;
};

const obterRetiradaMovimentacao = (movimentacao) => {
  if (!Array.isArray(movimentacao?.detalhesProdutos)) return 0;
  return movimentacao.detalhesProdutos.reduce(
    (total, detalhe) => total + Number(detalhe.retiradaProduto || 0),
    0,
  );
};

export function MaquinaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [maquina, setMaquina] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [estoque, setEstoque] = useState(null);
  const [historicoManutencao, setHistoricoManutencao] = useState(null);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const [movimentacaoEditando, setMovimentacaoEditando] = useState(null);
  const [formMovimentacao, setFormMovimentacao] = useState(null);
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);
  const [deletandoMovimentacaoId, setDeletandoMovimentacaoId] = useState(null);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      setFatalError("");
      const [maquinaRes, movimentacoesRes, estoqueRes, manutencaoRes] =
        await Promise.all([
          api.get(`/maquinas/${id}`),
          api.get(`/movimentacoes?maquinaId=${id}&limite=200`),
          api.get(`/maquinas/${id}/estoque`).catch(() => ({ data: null })),
          api.get(`/manutencoes/maquina/${id}`).catch(() => ({ data: null })),
        ]);

      setMaquina(maquinaRes.data);
      setMovimentacoes(movimentacoesRes.data || []);
      setEstoque(estoqueRes.data);
      setHistoricoManutencao(manutencaoRes.data);
    } catch (err) {
      setFatalError(err.response?.data?.error || "Erro ao carregar máquina.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const movimentacoesFiltradas = useMemo(() => {
    return movimentacoes.filter((mov) => {
      const dataMov = new Date(mov.dataColeta || mov.createdAt);
      const inicio = dataInicio ? new Date(`${dataInicio}T00:00:00`) : null;
      const fim = dataFim ? new Date(`${dataFim}T23:59:59`) : null;
      if (inicio && dataMov < inicio) return false;
      if (fim && dataMov > fim) return false;
      return true;
    });
  }, [movimentacoes, dataInicio, dataFim]);

  const adminOuDev = ["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"].includes(
    usuario?.role,
  );
  const usuarioPodeEditar = (movimentacao) =>
    adminOuDev || movimentacao.usuarioId === usuario?.id;

  const abrirEdicaoMovimentacao = (movimentacao) => {
    setActionError("");
    setSuccess("");
    setMovimentacaoEditando(movimentacao);
    setFormMovimentacao({
      dataColeta: formatarDataInput(movimentacao.dataColeta),
      totalPre: movimentacao.totalPre ?? 0,
      sairam: movimentacao.sairam ?? 0,
      abastecidas: movimentacao.abastecidas ?? 0,
      retiradaProduto: obterRetiradaMovimentacao(movimentacao),
      fichas: movimentacao.fichas ?? 0,
      contadorIn: movimentacao.contadorIn ?? "",
      contadorOut: movimentacao.contadorOut ?? "",
      quantidade_notas_entrada: movimentacao.quantidade_notas_entrada ?? "",
      valor_entrada_maquininha_pix:
        movimentacao.valor_entrada_maquininha_pix ?? "",
      tipoOcorrencia: movimentacao.tipoOcorrencia || "Normal",
      observacoes: movimentacao.observacoes || "",
    });
  };

  const fecharEdicao = () => {
    setMovimentacaoEditando(null);
    setFormMovimentacao(null);
  };

  const atualizarCampoMovimentacao = (campo, valor) => {
    setFormMovimentacao((atual) => ({ ...atual, [campo]: valor }));
  };

  const montarNumero = (valor, inteiro = true) => {
    if (valor === "" || valor === null || valor === undefined) return null;
    const numeroConvertido = inteiro ? parseInt(valor, 10) : parseFloat(valor);
    return Number.isFinite(numeroConvertido) ? numeroConvertido : 0;
  };

  const totalPosEditado = formMovimentacao
    ? Number(formMovimentacao.totalPre || 0) +
      Number(formMovimentacao.abastecidas || 0) -
      Number(formMovimentacao.retiradaProduto || 0)
    : 0;

  const salvarMovimentacao = async (event) => {
    event.preventDefault();
    if (!movimentacaoEditando || !formMovimentacao) return;

    try {
      setSalvandoMovimentacao(true);
      setActionError("");
      setSuccess("");

      const payload = {
        dataColeta: formMovimentacao.dataColeta || undefined,
        totalPre: montarNumero(formMovimentacao.totalPre),
        sairam: montarNumero(formMovimentacao.sairam),
        abastecidas: montarNumero(formMovimentacao.abastecidas),
        retiradaProduto: montarNumero(formMovimentacao.retiradaProduto),
        totalPos: totalPosEditado,
        fichas: montarNumero(formMovimentacao.fichas),
        contadorIn: montarNumero(formMovimentacao.contadorIn),
        contadorOut: montarNumero(formMovimentacao.contadorOut),
        quantidade_notas_entrada: montarNumero(
          formMovimentacao.quantidade_notas_entrada,
        ),
        valor_entrada_maquininha_pix: montarNumero(
          formMovimentacao.valor_entrada_maquininha_pix,
          false,
        ),
        tipoOcorrencia: formMovimentacao.tipoOcorrencia || "Normal",
        observacoes: formMovimentacao.observacoes || null,
      };

      if (Array.isArray(movimentacaoEditando.detalhesProdutos)) {
        payload.produtos = movimentacaoEditando.detalhesProdutos
          .filter((detalhe) => detalhe?.produtoId || detalhe?.produto?.id)
          .map((detalhe, index) => ({
            produtoId: detalhe.produtoId || detalhe.produto?.id,
            quantidadeSaiu:
              index === 0 ? payload.sairam : Number(detalhe.quantidadeSaiu || 0),
            quantidadeAbastecida:
              index === 0
                ? payload.abastecidas
                : Number(detalhe.quantidadeAbastecida || 0),
            retiradaProduto:
              index === 0
                ? payload.retiradaProduto
                : Number(detalhe.retiradaProduto || 0),
          }));
      }

      await api.put(`/movimentacoes/${movimentacaoEditando.id}`, payload);
      fecharEdicao();
      setSuccess("Movimentação atualizada com sucesso.");
      await carregarDados();
    } catch (err) {
      setActionError(
        err.response?.data?.error || "Erro ao atualizar movimentação.",
      );
    } finally {
      setSalvandoMovimentacao(false);
    }
  };

  const deletarMovimentacao = async (movimentacao) => {
    const confirmado = await confirmar({
      title: "Excluir movimentação?",
      text: "Essa ação não pode ser desfeita.",
      confirmButtonText: "Excluir",
    });
    if (!confirmado) return;

    try {
      setDeletandoMovimentacaoId(movimentacao.id);
      setActionError("");
      setSuccess("");
      await api.delete(`/movimentacoes/${movimentacao.id}`);
      setSuccess("Movimentação excluída com sucesso.");
      await carregarDados();
    } catch (err) {
      setActionError(err.response?.data?.error || "Erro ao excluir movimentação.");
    } finally {
      setDeletandoMovimentacaoId(null);
    }
  };

  if (loading) return <PageLoader />;
  if (fatalError) return <AlertBox type="error" message={fatalError} />;
  if (!maquina) return <AlertBox type="error" message="Máquina não encontrada." />;

  const status = obterStatus(maquina);
  const ultimaMovimentacao = movimentacoes[0];
  const produtoAtual = obterProdutoMovimentacao(ultimaMovimentacao);
  const estoqueAtual =
    estoque?.estoqueAtual ?? ultimaMovimentacao?.totalPos ?? maquina.estoqueAtual ?? 0;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-lg border border-orange-100 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Buscar Lojas e Máquinas
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              className="font-semibold text-primary hover:text-primary/80"
              onClick={() => navigate(-1)}
            >
              ← Voltar
            </button>
            <span className="text-gray-400">/</span>
            <span className="font-semibold text-gray-700">
              {maquina.loja?.nome || "Sem loja"}
            </span>
            <span className="text-gray-400">/</span>
            <span className="font-semibold text-gray-700">
              {maquina.codigo} - {maquina.nome}
            </span>
          </div>
        </section>

        {actionError && (
          <div className="mb-4">
            <AlertBox
              type="error"
              message={actionError}
              onClose={() => setActionError("")}
            />
          </div>
        )}
        {success && (
          <div className="mb-4">
            <AlertBox
              type="success"
              message={success}
              onClose={() => setSuccess("")}
            />
          </div>
        )}

        <section className="mb-6 rounded-lg border border-orange-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                📊 Informações da Máquina
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Dados operacionais e configuração atual.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={() => navigate(`/maquinas/${maquina.id}/editar`)}
            >
              Editar máquina
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <p className="text-sm text-gray-600">Código</p>
              <p className="font-bold text-gray-900">{maquina.codigo}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Nome</p>
              <p className="font-bold text-gray-900">{maquina.nome || "-"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tipo</p>
              <p className="font-bold text-gray-900">
                {produtoAtual ? (
                  <span>
                    {produtoAtual.emoji ? `${produtoAtual.emoji} ` : ""}
                    {produtoAtual.nome}
                  </span>
                ) : (
                  maquina.tipo || "-"
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Capacidade</p>
              <p className="font-bold text-gray-900">
                {maquina.capacidadePadrao || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Estoque Atual</p>
              <p className="font-bold text-gray-900">{estoqueAtual}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Valor da Ficha</p>
              <p className="font-bold text-gray-900">
                R$ {Number(maquina.valorFicha || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fichas para jogar</p>
              <p className="font-bold text-gray-900">
                {maquina.fichasNecessarias || "-"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <div className="mt-1">
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
            </div>
          </div>

          {maquina.localizacao && (
            <div className="mt-5 rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-semibold text-gray-600">Localização</p>
              <p className="mt-1 text-gray-800">{maquina.localizacao}</p>
            </div>
          )}
        </section>

        <section className="mb-6 rounded-lg border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-gray-900">
            🛠️ Histórico de Manutenção
          </h2>

          {historicoManutencao?.recorrente && (
            <div className="mb-4">
              <AlertBox
                type="warning"
                message={`⚠️ Manutenção recorrente: ${historicoManutencao.recorrenciaMotivos.join(" ")}`}
              />
            </div>
          )}

          {!historicoManutencao?.manutencoes?.length ? (
            <p className="text-sm text-gray-600">
              Nenhuma manutenção registrada para esta máquina.
            </p>
          ) : (
            <div className="space-y-3">
              {historicoManutencao.manutencoes.map((item) => {
                const statusInfo =
                  statusManutencaoMapa[item.status] || {
                    label: item.status,
                    variant: "info",
                  };
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-gray-900">
                        {item.titulo}
                      </p>
                      <Badge variant={statusInfo.variant} size="sm">
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-700">
                      {item.descricao}
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-gray-600">
                      <p>
                        Tipo de problema:{" "}
                        {tipoProblemaMapa[item.tipoProblema] ||
                          item.tipoProblema ||
                          "-"}
                      </p>
                      <p>Responsável: {item.responsavel?.nome || "-"}</p>
                      <p>Aberto em: {formatarDataHora(item.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-gray-900">
            🔄 Histórico de Movimentações
          </h2>

          <div className="mb-5 grid grid-cols-1 gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                🗓️ Data Inicial
              </label>
              <input
                type="date"
                className="input-field"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                🗓️ Data Final
              </label>
              <input
                type="date"
                className="input-field"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            {movimentacoesFiltradas.map((mov) => (
              <article
                key={mov.id}
                className="rounded-lg border border-orange-100 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <Badge variant={mov.tipo === "entrada" ? "success" : "danger"}>
                    {mov.tipo === "entrada" ? "📥 Entrada" : "📤 Saída"}
                  </Badge>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-gray-600">
                      {formatarDataHora(mov.dataColeta || mov.createdAt)}
                    </span>
                    {usuarioPodeEditar(mov) && (
                      <button
                        type="button"
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700"
                        onClick={() => abrirEdicaoMovimentacao(mov)}
                      >
                        Editar
                      </button>
                    )}
                    {adminOuDev && (
                      <button
                        type="button"
                        className="rounded-md bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={deletandoMovimentacaoId === mov.id}
                        onClick={() => deletarMovimentacao(mov)}
                      >
                        {deletandoMovimentacaoId === mov.id
                          ? "Excluindo..."
                          : "Excluir"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-b border-slate-200 pb-3 text-sm md:grid-cols-6">
                  <div>
                    <p className="text-gray-500">Total Pré</p>
                    <p className="font-bold">{numero(mov.totalPre)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Saíram</p>
                    <p className="font-bold text-red-600">{numero(mov.sairam)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Abastecidas</p>
                    <p className="font-bold text-green-600">
                      {numero(mov.abastecidas)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Retirada</p>
                    <p className="font-bold text-pink-600">
                      {obterRetiradaMovimentacao(mov)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Atual</p>
                    <p className="font-bold text-purple-700">{numero(mov.totalPos)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Fichas</p>
                    <p className="font-bold text-blue-700">{numero(mov.fichas)}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-gray-500">🧮 Contador IN</p>
                    <p className="font-bold">{mov.contadorIn ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">🧮 Contador OUT</p>
                    <p className="font-bold">{mov.contadorOut ?? "-"}</p>
                  </div>
                </div>

                {mov.observacoes && (
                  <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-gray-700">
                    {mov.observacoes}
                  </p>
                )}
              </article>
            ))}

            {movimentacoesFiltradas.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-gray-500">
                Nenhuma movimentação encontrada para esta máquina.
              </div>
            )}
          </div>
        </section>

        <Modal
          isOpen={!!movimentacaoEditando}
          onClose={fecharEdicao}
          title="Editar movimentação"
          size="xl"
        >
          {formMovimentacao && (
            <form onSubmit={salvarMovimentacao} className="space-y-5">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                Ajuste os dados da movimentação. O total atual será recalculado
                como atual na máquina + abastecidas - retirada.
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-700">
                    🗓️ Data da coleta
                  </span>
                  <input
                    type="datetime-local"
                    className="input-field"
                    value={formMovimentacao.dataColeta}
                    onChange={(e) =>
                      atualizarCampoMovimentacao("dataColeta", e.target.value)
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-700">
                    📦 Total Pré
                  </span>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={formMovimentacao.totalPre}
                    onChange={(e) =>
                      atualizarCampoMovimentacao("totalPre", e.target.value)
                    }
                  />
                </label>
                <div className="rounded-lg border border-orange-100 bg-orange-50 p-4">
                  <p className="text-sm font-semibold text-orange-700">
                    📦 Total Atual
                  </p>
                  <p className="mt-2 text-2xl font-bold text-orange-700">
                    {totalPosEditado}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-700">
                    📤 Saíram
                  </span>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={formMovimentacao.sairam}
                    onChange={(e) =>
                      atualizarCampoMovimentacao("sairam", e.target.value)
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-700">
                    📥 Abastecidas
                  </span>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={formMovimentacao.abastecidas}
                    onChange={(e) =>
                      atualizarCampoMovimentacao("abastecidas", e.target.value)
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-700">
                    ❌ Retirada
                  </span>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={formMovimentacao.retiradaProduto}
                    onChange={(e) =>
                      atualizarCampoMovimentacao(
                        "retiradaProduto",
                        e.target.value,
                      )
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-700">
                    🧮 Contador IN
                  </span>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={formMovimentacao.contadorIn}
                    onChange={(e) =>
                      atualizarCampoMovimentacao("contadorIn", e.target.value)
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-700">
                    🧮 Contador OUT
                  </span>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={formMovimentacao.contadorOut}
                    onChange={(e) =>
                      atualizarCampoMovimentacao("contadorOut", e.target.value)
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-700">
                    🪙 Fichas
                  </span>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={formMovimentacao.fichas}
                    onChange={(e) =>
                      atualizarCampoMovimentacao("fichas", e.target.value)
                    }
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-700">
                    💵 Valor em Notas (R$)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-field"
                    value={formMovimentacao.quantidade_notas_entrada}
                    onChange={(e) =>
                      atualizarCampoMovimentacao(
                        "quantidade_notas_entrada",
                        e.target.value,
                      )
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-700">
                    💳 Valor Digital (Pix/Maquininha)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-field"
                    value={formMovimentacao.valor_entrada_maquininha_pix}
                    onChange={(e) =>
                      atualizarCampoMovimentacao(
                        "valor_entrada_maquininha_pix",
                        e.target.value,
                      )
                    }
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-gray-700">
                    📝 Ocorrência
                  </span>
                  <input
                    type="text"
                    className="input-field"
                    value={formMovimentacao.tipoOcorrencia}
                    onChange={(e) =>
                      atualizarCampoMovimentacao("tipoOcorrencia", e.target.value)
                    }
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700">
                  Observação
                </span>
                <textarea
                  className="input-field min-h-[96px]"
                  value={formMovimentacao.observacoes}
                  onChange={(e) =>
                    atualizarCampoMovimentacao("observacoes", e.target.value)
                  }
                />
              </label>

              <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={fecharEdicao}
                  disabled={salvandoMovimentacao}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={salvandoMovimentacao}
                >
                  {salvandoMovimentacao ? "Salvando..." : "Salvar movimentação"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      </main>
      <Footer />
    </div>
  );
}

export default MaquinaDetalhes;
