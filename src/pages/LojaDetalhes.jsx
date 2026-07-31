import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, Badge, AlertBox } from "../components/UIComponents";
import { PageLoader, EmptyState } from "../components/Loading";

const obterStatusLoja = (loja) => {
  const status = loja.statusOperacao || loja.status_operacao;

  if (status === "EM_IMPLANTACAO") {
    return { label: "Em implantação", variant: "warning" };
  }

  if (status === "INATIVA" || loja.ativo === false) {
    return { label: "Inativa", variant: "danger" };
  }

  return { label: "Ativa", variant: "success" };
};

const formatarDataLoja = (valor) => {
  if (!valor) return "Não informado";
  const data = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(data.getTime())) return "Não informado";
  return data.toLocaleDateString("pt-BR");
};

const paraDataISO = (data) => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

const dataDeHoje = () => paraDataISO(new Date());

const dataDiasAtras = (dias) => {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  return paraDataISO(data);
};

export function LojaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loja, setLoja] = useState(null);
  const [maquinas, setMaquinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [maquinaSelecionada, setMaquinaSelecionada] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [loadingMovimentacoes, setLoadingMovimentacoes] = useState(false);
  const [dataInicio, setDataInicio] = useState(() => dataDiasAtras(30));
  const [dataFim, setDataFim] = useState(dataDeHoje);

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [lojaRes, maquinasRes, movimentacoesRes, produtosRes] =
        await Promise.all([
          api.get(`/lojas/${id}`),
          api.get(`/maquinas`),
          api.get(`/movimentacoes`, { params: { lojaId: id, limite: 200 } }),
          api.get(`/produtos`),
        ]);

      const maquinasDaLoja = maquinasRes.data.filter((m) => m.lojaId === id);
      const todasMovimentacoes = movimentacoesRes.data;
      const produtos = produtosRes.data;

      // Enriquecer cada máquina com estoque atual e último produto
      const maquinasEnriquecidas = await Promise.all(
        maquinasDaLoja.map(async (maquina) => {
          try {
            // Buscar estoque atual da API
            const estoqueRes = await api.get(`/maquinas/${maquina.id}/estoque`);
            const estoqueAtual = estoqueRes.data.estoqueAtual || 0;

            // Buscar última movimentação desta máquina
            const movsDaMaquina = todasMovimentacoes
              .filter((mov) => mov.maquinaId === maquina.id)
              .sort(
                (a, b) =>
                  new Date(b.dataColeta || b.createdAt) -
                  new Date(a.dataColeta || a.createdAt),
              );

            let ultimoProduto = null;
            if (movsDaMaquina.length > 0) {
              const ultimaMov = movsDaMaquina[0];
              const produtoId = ultimaMov.detalhesProdutos?.[0]?.produtoId;
              ultimoProduto = produtos.find((p) => p.id === produtoId);
            }

            return {
              ...maquina,
              estoqueAtual,
              ultimoProduto,
            };
          } catch (error) {
            console.error(
              `Erro ao buscar dados da máquina ${maquina.id}:`,
              error,
            );
            return {
              ...maquina,
              estoqueAtual: 0,
              ultimoProduto: null,
            };
          }
        }),
      );

      setLoja(lojaRes.data);
      setMaquinas(maquinasEnriquecidas);
    } catch (error) {
      setError(
        "Erro ao carregar dados: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const carregarMovimentacoes = async (maquinaId, inicio, fim) => {
    try {
      setLoadingMovimentacoes(true);
      const movRes = await api.get(`/movimentacoes`, {
        params: {
          maquinaId,
          dataInicio: inicio || undefined,
          dataFim: fim || undefined,
          limite: 200,
        },
      });
      setMovimentacoes(movRes.data || []);
    } catch (error) {
      console.error("Erro ao carregar movimentações:", error);
      setMovimentacoes([]);
    } finally {
      setLoadingMovimentacoes(false);
    }
  };

  const handleSelecionarMaquina = (maquina) => {
    if (maquinaSelecionada?.id === maquina.id) {
      setMaquinaSelecionada(null);
      setMovimentacoes([]);
    } else {
      setMaquinaSelecionada(maquina);
      carregarMovimentacoes(maquina.id, dataInicio, dataFim);
    }
  };

  const handleAplicarFiltrosMovimentacoes = () => {
    if (!maquinaSelecionada) return;
    carregarMovimentacoes(maquinaSelecionada.id, dataInicio, dataFim);
  };

  const handleLimparFiltrosMovimentacoes = () => {
    const inicioPadrao = dataDiasAtras(30);
    const fimPadrao = dataDeHoje();
    setDataInicio(inicioPadrao);
    setDataFim(fimPadrao);
    if (maquinaSelecionada) {
      carregarMovimentacoes(maquinaSelecionada.id, inicioPadrao, fimPadrao);
    }
  };

  if (loading) return <PageLoader />;
  if (error || !loja) {
    return (
      <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AlertBox type="error" message={error || "Loja não encontrada"} />
        </div>
        <Footer />
      </div>
    );
  }

  const maquinasAtivas = maquinas.filter((m) => m.ativo).length;
  const capacidadeTotal = maquinas.reduce(
    (sum, m) => sum + (m.capacidadePadrao || 0),
    0,
  );
  const estoqueTotal = maquinas.reduce(
    (sum, m) => sum + (m.estoqueAtual || 0),
    0,
  );
  const ocupacaoMedia =
    capacidadeTotal > 0
      ? Math.round((estoqueTotal / capacidadeTotal) * 100)
      : 0;
  const statusLoja = obterStatusLoja(loja);

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={loja.nome}
          subtitle="Detalhes da loja e suas máquinas"
          icon="🏪"
          action={{
            label: "Editar Loja",
            onClick: () => navigate(`/lojas/${id}/editar`),
          }}
        />

        {/* Informações da Loja */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 card-gradient">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Informações da Loja
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-500">
                  Nome
                </label>
                <p className="text-lg font-bold text-gray-900">{loja.nome}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-500">
                  Status
                </label>
                <div className="mt-1">
                  <Badge variant={statusLoja.variant}>{statusLoja.label}</Badge>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-500">
                  Endereço
                </label>
                <p className="text-gray-900">
                  {loja.endereco}
                  {loja.cidade && loja.estado && (
                    <span className="text-gray-600">
                      {" "}
                      - {loja.cidade}, {loja.estado}
                    </span>
                  )}
                  {loja.cep && (
                    <span className="text-gray-600"> - CEP: {loja.cep}</span>
                  )}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-500">
                  Telefone
                </label>
                <p className="text-gray-900">{loja.telefone}</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-500">
                  Valor da Ficha
                </label>
                <p className="text-gray-900 font-semibold">
                  R${" "}
                  {Number(loja.valorFichaPadrao ?? 2.5).toLocaleString(
                    "pt-BR",
                    { minimumFractionDigits: 2 },
                  )}
                </p>
              </div>

              {loja.responsavel && (
                <div>
                  <label className="text-sm font-semibold text-gray-500">
                    Responsável
                  </label>
                  <p className="text-gray-900">{loja.responsavel}</p>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-gray-500">
                  Data de início
                </label>
                <p className="text-gray-900">
                  {formatarDataLoja(loja.dataInicio || loja.data_inicio)}
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-500">
                  Vencimento do extintor
                </label>
                <p className="text-gray-900">
                  {formatarDataLoja(
                    loja.dataVencimentoExtintor ||
                      loja.data_vencimento_extintor,
                  )}
                </p>
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-gray-500">
                  Observações
                </label>
                <p className="whitespace-pre-wrap text-gray-900">
                  {loja.observacoes || "Sem observações"}
                </p>
              </div>
            </div>
          </div>

          {/* Estatísticas */}
          <div className="space-y-4">
            <div className="stat-card bg-gradient-to-br from-primary/10 to-primary/5">
              <div className="text-3xl mb-2">🎰</div>
              <div className="text-2xl font-bold text-gray-900">
                {maquinas.length}
              </div>
              <div className="text-sm text-gray-600">Total de Máquinas</div>
            </div>

            <div className="stat-card bg-gradient-to-br from-green-500/10 to-green-500/5">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-2xl font-bold text-gray-900">
                {maquinasAtivas}
              </div>
              <div className="text-sm text-gray-600">Máquinas Ativas</div>
            </div>

            <div className="stat-card bg-gradient-to-br from-secondary/10 to-secondary/5">
              <div className="text-3xl mb-2">📊</div>
              <div className="text-2xl font-bold text-gray-900">
                {ocupacaoMedia}%
              </div>
              <div className="text-sm text-gray-600">Ocupação Média</div>
            </div>
          </div>
        </div>

        {/* Lista de Máquinas */}
        <div className="card-gradient">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
              </svg>
              Máquinas da Loja ({maquinas.length})
            </h3>
            <button
              onClick={() => navigate("/maquinas/nova")}
              className="btn-primary text-sm"
            >
              + Nova Máquina
            </button>
          </div>

          {maquinas.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {maquinas.map((maquina) => {
                  // Estoque calculado a partir de movimentações, não está no objeto máquina
                  const estoqueAtual = maquina.estoqueAtual || 0;
                  const ocupacao =
                    maquina.capacidadePadrao > 0
                      ? Math.round(
                          (estoqueAtual / maquina.capacidadePadrao) * 100,
                        )
                      : 0;
                  const isSelected = maquinaSelecionada?.id === maquina.id;

                  return (
                    <div
                      key={maquina.id}
                      className={`p-4 bg-white rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-primary shadow-lg"
                          : "border-gray-200 hover:border-primary"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => handleSelecionarMaquina(maquina)}
                        >
                          <h4 className="font-bold text-gray-900">
                            {maquina.nome}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {maquina.codigo}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={maquina.ativo ? "success" : "danger"}>
                            {maquina.ativo ? "Ativa" : "Inativa"}
                          </Badge>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/maquinas/${maquina.id}/editar`);
                            }}
                            className="text-primary hover:text-primary-dark"
                            title="Editar máquina"
                          >
                            ✏️
                          </button>
                        </div>
                      </div>

                      <div
                        className="space-y-2 cursor-pointer"
                        onClick={() => handleSelecionarMaquina(maquina)}
                      >
                        {maquina.ultimoProduto && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tipo:</span>
                            <span className="font-semibold flex items-center gap-1">
                              <span>{maquina.ultimoProduto.emoji || "🧸"}</span>
                              <span>{maquina.ultimoProduto.nome}</span>
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Capacidade:</span>
                          <span className="font-semibold">
                            {maquina.capacidadePadrao || 0}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Estoque Atual:</span>
                          <span className="font-semibold text-primary">
                            {estoqueAtual}
                          </span>
                        </div>

                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-600">Ocupação:</span>
                            <span className="font-semibold">
                              {ocupacao}% (
                              {maquina.capacidadePadrao - estoqueAtual} faltam)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                ocupacao < 30
                                  ? "bg-red-500"
                                  : ocupacao < 60
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                              style={{ width: `${Math.min(ocupacao, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {maquina.modelo && (
                        <p className="text-xs text-gray-500 mt-3">
                          Modelo: {maquina.modelo}
                        </p>
                      )}

                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-primary font-medium">
                            👇 Ver histórico abaixo
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Histórico de Movimentações */}
              {maquinaSelecionada && (
                <div className="card mt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">🔄</span>
                    Histórico de Movimentações - {maquinaSelecionada.nome}
                  </h3>

                  {/* Filtros de Data */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          📅 Data Inicial
                        </label>
                        <input
                          type="date"
                          value={dataInicio}
                          onChange={(e) => setDataInicio(e.target.value)}
                          className="input-field w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          📅 Data Final
                        </label>
                        <input
                          type="date"
                          value={dataFim}
                          onChange={(e) => setDataFim(e.target.value)}
                          className="input-field w-full"
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleAplicarFiltrosMovimentacoes}
                        disabled={loadingMovimentacoes}
                        className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        🔎 Aplicar filtros
                      </button>
                      <button
                        type="button"
                        onClick={handleLimparFiltrosMovimentacoes}
                        className="text-sm text-primary hover:text-primary-dark flex items-center gap-1"
                      >
                        ✕ Limpar filtros (últimos 30 dias)
                      </button>
                    </div>
                  </div>

                  {loadingMovimentacoes ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                      <p className="text-gray-600 mt-4">
                        Carregando movimentações...
                      </p>
                    </div>
                  ) : movimentacoes.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {movimentacoes.map((mov) => (
                          <div
                            key={mov.id}
                            className="p-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-600">
                                {new Date(
                                  mov.dataColeta || mov.createdAt,
                                ).toLocaleDateString("pt-BR")}{" "}
                                às{" "}
                                {new Date(
                                  mov.dataColeta || mov.createdAt,
                                ).toLocaleTimeString("pt-BR")}
                              </span>
                            </div>
                            <div className="grid grid-cols-5 gap-4 mt-3 text-sm">
                              <div>
                                <p className="text-gray-600">Total Pré</p>
                                <p className="font-semibold">
                                  {mov.totalPre || 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Saíram</p>
                                <p className="font-semibold text-red-600">
                                  {mov.sairam || 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600">Abastecidas</p>
                                <p className="font-semibold text-green-600">
                                  {mov.abastecidas || 0}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600 flex items-center gap-1">
                                  <span>📦</span> Total Atual
                                </p>
                                <p className="font-semibold text-purple-600">
                                  {(mov.totalPre || 0) +
                                    (mov.abastecidas || 0) -
                                    (mov.sairam || 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-600 flex items-center gap-1">
                                  <span>🎫</span> Fichas
                                </p>
                                <p className="font-semibold text-blue-600">
                                  {mov.fichas || 0}
                                </p>
                              </div>
                            </div>
                            {mov.observacoes && (
                              <p className="text-sm text-gray-600 mt-3 italic">
                                💬 {mov.observacoes}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-6xl mb-4">📭</p>
                      <p className="text-gray-600">
                        Nenhuma movimentação registrada para esta máquina
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon="🎰"
              title="Nenhuma máquina cadastrada"
              message="Esta loja ainda não possui máquinas cadastradas. Adicione a primeira máquina!"
              action={{
                label: "Nova Máquina",
                onClick: () => navigate("/maquinas/nova"),
              }}
            />
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
