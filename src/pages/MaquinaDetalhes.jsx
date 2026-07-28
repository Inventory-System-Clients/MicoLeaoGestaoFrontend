import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { Navbar } from "../components/Navbar";
import { AlertBox, Badge } from "../components/UIComponents";
import api from "../services/api";

const statusMapa = {
  EM_OPERACAO: { label: "Em operação", variant: "success" },
  EM_MANUTENCAO: { label: "Em manutenção", variant: "warning" },
  PRONTA_PARA_SAIDA: { label: "Pronta para saída", variant: "info" },
  PARADA: { label: "Parada", variant: "danger" },
  SEM_LOJA: { label: "Sem loja", variant: "default" },
  INATIVA: { label: "Inativa", variant: "danger" },
};

const numero = (valor) => Number(valor || 0);

const formatarDataHora = (valor) => {
  if (!valor) return "-";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR");
};

const obterStatus = (maquina) => {
  if (!maquina?.ativo) return statusMapa.INATIVA;
  if (!maquina?.lojaId) return statusMapa.SEM_LOJA;
  return statusMapa[maquina.statusOperacao || maquina.status_operacao] || statusMapa.PARADA;
};

const obterProdutoMovimentacao = (movimentacao) => {
  const detalhe = movimentacao?.detalhesProdutos?.[0];
  return detalhe?.produto || detalhe || null;
};

export function MaquinaDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [maquina, setMaquina] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [estoque, setEstoque] = useState(null);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const carregarDados = async () => {
      try {
        setLoading(true);
        setError("");
        const [maquinaRes, movimentacoesRes, estoqueRes] = await Promise.all([
          api.get(`/maquinas/${id}`),
          api.get(`/movimentacoes?maquinaId=${id}&limite=200`),
          api.get(`/maquinas/${id}/estoque`).catch(() => ({ data: null })),
        ]);

        setMaquina(maquinaRes.data);
        setMovimentacoes(movimentacoesRes.data || []);
        setEstoque(estoqueRes.data);
      } catch (err) {
        setError(err.response?.data?.error || "Erro ao carregar máquina.");
      } finally {
        setLoading(false);
      }
    };

    carregarDados();
  }, [id]);

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

  if (loading) return <PageLoader />;
  if (error) return <AlertBox type="error" message={error} />;
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

        <section className="rounded-lg border border-orange-100 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-gray-900">
            🔄 Histórico de Movimentações
          </h2>

          <div className="mb-5 grid grid-cols-1 gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                📅 Data Inicial
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
                📅 Data Final
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
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-600">
                      {formatarDataHora(mov.dataColeta || mov.createdAt)}
                    </span>
                    <button
                      type="button"
                      className="rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700"
                      onClick={() => navigate("/movimentacoes")}
                    >
                      Editar
                    </button>
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
                      {numero(mov.retiradaProduto)}
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
      </main>
      <Footer />
    </div>
  );
}

export default MaquinaDetalhes;
