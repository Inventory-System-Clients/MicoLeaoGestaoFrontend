import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, Cell,
  ReferenceLine,
} from "recharts";

// ─── Constantes ───────────────────────────────────────────────────────────────
const NENHUMA_LOJA_VALUE = "";
const TODAS_LOJAS_VALUE  = "__TODAS_AS_LOJAS__";
const MESES_NOMES        = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const toN                = (v) => Number(v || 0);

// ─── Tooltip personalizado do gráfico anual ───────────────────────────────────
function TooltipAnual({ active, payload, label, formatMoney }) {
  if (!active || !payload?.length) return null;
  const fat  = toN(payload.find((p) => p.dataKey === "faturamento")?.value);
  const custo= toN(payload.find((p) => p.dataKey === "custo")?.value);
  const lucro= toN(payload.find((p) => p.dataKey === "lucro")?.value);
  const marg = fat > 0 ? ((lucro / fat) * 100).toFixed(1) : "0.0";
  const varMes = payload.find((p) => p.dataKey === "variacaoMes");
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 min-w-[220px]">
      <p className="font-bold text-gray-800 text-base mb-3 border-b pb-2">{label}</p>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-6">
          <span className="text-gray-500">Faturamento</span>
          <span className="font-semibold text-emerald-600">{formatMoney(fat)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-gray-500">Custo Total</span>
          <span className="font-semibold text-rose-500">{formatMoney(custo)}</span>
        </div>
        <div className="flex justify-between gap-6 border-t pt-1.5 mt-1.5">
          <span className="text-gray-700 font-medium">Lucro Líquido</span>
          <span className={`font-bold ${lucro >= 0 ? "text-blue-600" : "text-red-600"}`}>{formatMoney(lucro)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-gray-500">Margem</span>
          <span className={`font-semibold ${parseFloat(marg) >= 0 ? "text-blue-500" : "text-red-500"}`}>{marg}%</span>
        </div>
        {varMes && varMes.value !== null && (
          <div className="flex justify-between gap-6 border-t pt-1.5 mt-1.5">
            <span className="text-gray-500">vs mês anterior</span>
            <span className={`font-semibold ${varMes.value >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {varMes.value >= 0 ? "▲" : "▼"} {Math.abs(varMes.value).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function Graficos() {
  const [loading, setLoading]                 = useState(false);
  const [loadingAnual, setLoadingAnual]       = useState(false);
  const [lojas, setLojas]                     = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState(NENHUMA_LOJA_VALUE);
  const [dataInicio, setDataInicio]           = useState("");
  const [dataFim, setDataFim]                 = useState("");

  // ── Estado do painel anual ──
  const anoAtual = new Date().getFullYear();
  const [anoSelecionado, setAnoSelecionado]   = useState(anoAtual);
  const [dadosAnuais, setDadosAnuais]         = useState([]); // array de 12 meses
  const [metricaAnual, setMetricaAnual]       = useState("faturamento"); // faturamento | lucro | custo

  // ── Estado painel principal ──
  const [dadosTodasLojas, setDadosTodasLojas] = useState(null);
  const [dadosDashboard, setDadosDashboard]   = useState(null);
  const [dadosImpressao, setDadosImpressao]   = useState(null);
  const [rankingLucroBruto, setRankingLucroBruto] = useState([]);
  const [erro, setErro]                       = useState("");

  // ─── Anos disponíveis (3 anos atrás até atual) ───────────────────────────
  const anosDisponiveis = useMemo(() => {
    const anos = [];
    for (let a = anoAtual; a >= anoAtual - 4; a--) anos.push(a);
    return anos;
  }, [anoAtual]);

  // ─── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 7);
    setDataFim(hoje.toISOString().split("T")[0]);
    setDataInicio(seteDiasAtras.toISOString().split("T")[0]);

    setLoading(true);
    api.get("/lojas")
      .then((res) => {
        setLojas([
          { id: NENHUMA_LOJA_VALUE, nome: "Nenhum" },
          { id: TODAS_LOJAS_VALUE,  nome: "Todas as lojas" },
          ...(res.data || []),
        ]);
      })
      .catch(() => setErro("Erro ao carregar lista de lojas."))
      .finally(() => setLoading(false));
  }, []);

  // ─── Carregamento painel principal ────────────────────────────────────────
  const carregarDados = useCallback(async () => {
    if (!lojaSelecionada || lojaSelecionada === NENHUMA_LOJA_VALUE) return;
    if (!dataInicio || !dataFim) return;
    if (new Date(dataInicio) > new Date(dataFim)) {
      setErro("A data inicial não pode ser maior que a data final.");
      return;
    }
    setErro("");
    setLoading(true);
    setDadosTodasLojas(null);
    setDadosDashboard(null);
    setDadosImpressao(null);
    try {
      const params     = { dataInicio, dataFim };
      const isTodas    = lojaSelecionada === TODAS_LOJAS_VALUE;
      const paramsLoja = { ...params, lojaId: lojaSelecionada };
      const rankingPromise = api
        .get("/graficos/ranking-lucro-bruto-lojas", { params })
        .catch(() => ({ data: { rankingLucroBrutoLojas: [] } }));
      if (isTodas) {
        const [todasRes, rankingRes] = await Promise.all([
          api.get("/relatorios/todas-lojas", { params }),
          rankingPromise,
        ]);
        setDadosTodasLojas(todasRes.data || null);
        setRankingLucroBruto(rankingRes.data?.rankingLucroBrutoLojas || []);
      } else {
        const [dashRes, impressaoRes, rankingRes] = await Promise.all([
          api.get("/relatorios/dashboard", { params: paramsLoja }),
          api.get("/relatorios/impressao",  { params: paramsLoja }),
          rankingPromise,
        ]);
        setDadosDashboard(dashRes.data     || null);
        setDadosImpressao(impressaoRes.data || null);
        setRankingLucroBruto(rankingRes.data?.rankingLucroBrutoLojas || []);
      }
    } catch (err) {
      console.error("[Graficos] Erro:", err);
      setErro("Não foi possível carregar os dados do painel.");
    } finally {
      setLoading(false);
    }
  }, [lojaSelecionada, dataInicio, dataFim]);

  useEffect(() => {
    if (lojaSelecionada && lojaSelecionada !== NENHUMA_LOJA_VALUE && dataInicio && dataFim) {
      carregarDados();
    }
  }, [lojaSelecionada, dataInicio, dataFim, carregarDados]);

  // ─── Carregamento painel anual — 12 requisições paralelas ────────────────
  const carregarDadosAnuais = useCallback(async () => {
    if (!lojaSelecionada || lojaSelecionada === NENHUMA_LOJA_VALUE) return;

    setLoadingAnual(true);
    setDadosAnuais([]);

    const isTodas = lojaSelecionada === TODAS_LOJAS_VALUE;
    const mesAtual = lojaSelecionada ? new Date().getFullYear() === anoSelecionado
      ? new Date().getMonth() + 1 : 12 : 12;

    // Monta os 12 pares de datas (Jan → Dez)
    const periodos = Array.from({ length: 12 }, (_, i) => {
      const mes  = i + 1;
      const ini  = `${anoSelecionado}-${String(mes).padStart(2, "0")}-01`;
      const diasNoMes = new Date(anoSelecionado, mes, 0).getDate();
      const fim  = `${anoSelecionado}-${String(mes).padStart(2, "0")}-${String(diasNoMes).padStart(2, "0")}`;
      return { mes, ini, fim };
    });

    try {
      const resultados = await Promise.allSettled(
        periodos.map(({ ini, fim }) => {
          const params = { dataInicio: ini, dataFim: fim };
          if (isTodas) {
            return api.get("/relatorios/todas-lojas", { params });
          } else {
            // ⚠️ Usa /impressao porque é a fonte correta do faturamento consolidado
            // (valorBrutoConsolidadoLojaMaquinas = trocadora + máquinas via RegistroDinheiro)
            return api.get("/relatorios/impressao", { params: { ...params, lojaId: lojaSelecionada } });
          }
        })
      );

      const serie = resultados.map((res, i) => {
        const mes  = i + 1;
        const nome = MESES_NOMES[i];
        const isFuturo = anoSelecionado === anoAtual && mes > mesAtual;
        if (res.status !== "fulfilled" || isFuturo) {
          return { mes, nome, faturamento: null, custo: null, lucro: null, variacaoMes: null, semDados: true };
        }
        const data = res.value?.data;
        let fat = 0, custo = 0, lucro = 0;
        if (isTodas) {
          fat   = toN(data?.totais?.lucroBrutoTotal);
          custo = toN(data?.totais?.custoTotal);
          lucro = toN(data?.totais?.lucroLiquidoTotal);
        } else {
          // Campos exatos de gerarRelatorioImpressaoPorLoja → totais:
          // valorBrutoConsolidadoLojaMaquinas = faturamento bruto real (trocadora + máquinas)
          // gastoTotalPeriodo                 = custo total (produtos + fixo + variável)
          // valorLiquidoConsolidadoLojaMaquinas = lucro líquido (bruto - gastos)
          const t = data?.totais || {};
          fat   = toN(t.valorBrutoConsolidadoLojaMaquinas);
          custo = toN(t.gastoTotalPeriodo);
          lucro = toN(t.valorLiquidoConsolidadoLojaMaquinas);
        }
        return { mes, nome, faturamento: fat, custo, lucro, variacaoMes: null, semDados: false };
      });

      // Calcula variação percentual mês a mês
      for (let i = 1; i < serie.length; i++) {
        const ant = serie[i - 1];
        const cur = serie[i];
        if (!ant.semDados && !cur.semDados && ant.faturamento > 0) {
          cur.variacaoMes = ((cur.faturamento - ant.faturamento) / ant.faturamento) * 100;
        }
      }

      setDadosAnuais(serie);
    } catch (err) {
      console.error("[Graficos] Erro ao carregar dados anuais:", err);
    } finally {
      setLoadingAnual(false);
    }
  }, [lojaSelecionada, anoSelecionado, anoAtual]);

  useEffect(() => {
    if (lojaSelecionada && lojaSelecionada !== NENHUMA_LOJA_VALUE) {
      carregarDadosAnuais();
    }
  }, [lojaSelecionada, anoSelecionado, carregarDadosAnuais]);

  // ─── Dados do gráfico anual filtrados pela métrica ────────────────────────
  const dadosAnuaisVisiveis = useMemo(() =>
    dadosAnuais.filter((d) => !d.semDados),
  [dadosAnuais]);

  // Totais anuais acumulados
  const totaisAno = useMemo(() => {
    const validos = dadosAnuais.filter((d) => !d.semDados);
    return {
      faturamento: validos.reduce((a, d) => a + toN(d.faturamento), 0),
      custo:       validos.reduce((a, d) => a + toN(d.custo), 0),
      lucro:       validos.reduce((a, d) => a + toN(d.lucro), 0),
      meses:       validos.length,
    };
  }, [dadosAnuais]);

  // Melhor e pior mês
  const melhorMes = useMemo(() =>
    dadosAnuaisVisiveis.reduce((best, d) =>
      (d[metricaAnual] ?? -Infinity) > (best?.[metricaAnual] ?? -Infinity) ? d : best, null),
  [dadosAnuaisVisiveis, metricaAnual]);

  const piorMes = useMemo(() =>
    dadosAnuaisVisiveis.reduce((worst, d) =>
      (d[metricaAnual] ?? Infinity) < (worst?.[metricaAnual] ?? Infinity) ? d : worst, null),
  [dadosAnuaisVisiveis, metricaAnual]);

  const mediaAnual = useMemo(() => {
    if (!dadosAnuaisVisiveis.length) return 0;
    return dadosAnuaisVisiveis.reduce((a, d) => a + toN(d[metricaAnual]), 0) / dadosAnuaisVisiveis.length;
  }, [dadosAnuaisVisiveis, metricaAnual]);

  // ─── Modos e KPIs ─────────────────────────────────────────────────────────
  const totaisTodasLojas   = useMemo(() => dadosTodasLojas?.totais   || {}, [dadosTodasLojas]);
  const graficosTodasLojas = useMemo(() => dadosTodasLojas?.graficos || {}, [dadosTodasLojas]);
  const rankingLucroLojas  = useMemo(() => graficosTodasLojas.rankingLucroLojas  || [], [graficosTodasLojas]);
  const rankingGastoLojas  = useMemo(() => graficosTodasLojas.rankingGastoLojas  || [], [graficosTodasLojas]);
  const participacaoLojas  = useMemo(() => graficosTodasLojas.participacaoLojas  || [], [graficosTodasLojas]);
  const gastosFixosPorLoja = useMemo(() => graficosTodasLojas.gastosFixosPorLoja || [], [graficosTodasLojas]);
  const rankingProdutosTodas = useMemo(() => graficosTodasLojas.rankingProdutos  || [], [graficosTodasLojas]);

  const totaisDash    = useMemo(() => dadosDashboard?.totais || {}, [dadosDashboard]);
  const faturamentoTotal  = useMemo(() => toN(totaisDash.faturamento),          [totaisDash]);
  const custoTotalPeriodo = useMemo(() => toN(totaisDash.custoTotal),           [totaisDash]);
  const lucroLiquido      = useMemo(() => toN(totaisDash.lucro),                [totaisDash]);
  const dinheiro          = useMemo(() => toN(totaisDash.dinheiro),             [totaisDash]);
  const cartaoPix         = useMemo(() => toN(totaisDash.pix),                  [totaisDash]);
  const fichas            = useMemo(() => toN(totaisDash.fichas),               [totaisDash]);
  const saidas            = useMemo(() => toN(totaisDash.saidas),               [totaisDash]);
  const custoFixo         = useMemo(() => toN(totaisDash.custoFixoPeriodo),     [totaisDash]);
  const custoVariavel     = useMemo(() => toN(totaisDash.custoVariavelPeriodo), [totaisDash]);
  const custoProdutos     = useMemo(() => toN(totaisDash.custoProdutosTotal),   [totaisDash]);

  const composicaoCustos = useMemo(() => [
    { nome: "Produtos",  valor: custoProdutos },
    { nome: "Fixos",     valor: custoFixo     },
    { nome: "Variáveis", valor: custoVariavel },
  ].filter((i) => i.valor > 0), [custoProdutos, custoFixo, custoVariavel]);

  const recebimentos = useMemo(() => [
    { metodo: "Dinheiro",   valor: dinheiro  },
    { metodo: "Cartão/Pix", valor: cartaoPix },
  ], [dinheiro, cartaoPix]);

  const faturamentoTodas  = useMemo(() => toN(totaisTodasLojas.lucroBrutoTotal),    [totaisTodasLojas]);
  const lucroLiquidoTodas = useMemo(() => toN(totaisTodasLojas.lucroLiquidoTotal),  [totaisTodasLojas]);
  const custoTodas        = useMemo(() => toN(totaisTodasLojas.custoTotal),         [totaisTodasLojas]);
  const dinheiroTodas     = useMemo(() => toN(totaisTodasLojas.dinheiroTotal),      [totaisTodasLojas]);
  const cartaoPixTodas    = useMemo(() => toN(totaisTodasLojas.cartaoPixTotal),     [totaisTodasLojas]);
  const fichasTodas       = useMemo(() => toN(totaisTodasLojas.fichasTotal),        [totaisTodasLojas]);
  const saidasTodas       = useMemo(() => toN(totaisTodasLojas.produtosSairamTotal),[totaisTodasLojas]);

  const composicaoCustosTodas = useMemo(() => [
    { nome: "Produtos",  valor: toN(totaisTodasLojas.custoProdutosTotal) },
    { nome: "Fixos",     valor: toN(totaisTodasLojas.custoFixoTotal)     },
    { nome: "Variáveis", valor: toN(totaisTodasLojas.custoVariavelTotal) },
  ].filter((i) => i.valor > 0), [totaisTodasLojas]);

  const recebimentosTodas = useMemo(() => [
    { metodo: "Dinheiro",   valor: dinheiroTodas  },
    { metodo: "Cartão/Pix", valor: cartaoPixTodas },
  ], [dinheiroTodas, cartaoPixTodas]);

  const graficoFinanceiro = useMemo(() => {
    const base = dadosDashboard?.graficoFinanceiro;
    if (!Array.isArray(base) || base.length === 0) return [];
    return base.map((item) => ({
      data:         String(item.data).slice(0, 10),
      faturamento:  toN(item.faturamento),
      custoRateado: toN(item.custo),
      lucroRateado: toN(item.lucro),
    }));
  }, [dadosDashboard]);

  const fluxoProdutos = useMemo(() => {
    const mapa = new Map();
    (dadosImpressao?.produtosSairam || []).forEach((item) => {
      const k = String(item.id || item.nome);
      if (!mapa.has(k)) mapa.set(k, { nome: item.nome, saiu: 0, entrou: 0 });
      mapa.get(k).saiu += toN(item.quantidade);
    });
    (dadosImpressao?.produtosEntraram || []).forEach((item) => {
      const k = String(item.id || item.nome);
      if (!mapa.has(k)) mapa.set(k, { nome: item.nome, saiu: 0, entrou: 0 });
      mapa.get(k).entrou += toN(item.quantidade);
    });
    return Array.from(mapa.values())
      .sort((a, b) => Math.max(b.saiu, b.entrou) - Math.max(a.saiu, a.entrou))
      .slice(0, 10);
  }, [dadosImpressao]);

  const isTodas = lojaSelecionada === TODAS_LOJAS_VALUE;
  const kpiFaturamento  = isTodas ? faturamentoTodas  : faturamentoTotal;
  const kpiLiquido      = isTodas ? lucroLiquidoTodas : lucroLiquido;
  const kpiCusto        = isTodas ? custoTodas        : custoTotalPeriodo;
  const kpiDinheiro     = isTodas ? dinheiroTodas     : dinheiro;
  const kpiCartao       = isTodas ? cartaoPixTodas    : cartaoPix;
  const kpiFichas       = isTodas ? fichasTodas       : fichas;
  const kpiSaidas       = isTodas ? saidasTodas       : saidas;
  const kpiRecebimentos = isTodas ? recebimentosTodas : recebimentos;
  const kpiCustos       = isTodas ? composicaoCustosTodas : composicaoCustos;
  const kpiMargem       = kpiFaturamento ? (kpiLiquido / kpiFaturamento) * 100 : 0;
  const kpiIndiceCusto  = kpiFaturamento ? (kpiCusto  / kpiFaturamento) * 100 : 0;
  const rankingProdutosAtivo = isTodas ? rankingProdutosTodas : (dadosDashboard?.rankingProdutos || []);
  const performanceMaquinas  = isTodas ? [] : (dadosDashboard?.performanceMaquinas || []);

  const dadosDisponiveis = Boolean(
    lojaSelecionada && lojaSelecionada !== NENHUMA_LOJA_VALUE &&
    dataInicio && dataFim &&
    (isTodas ? dadosTodasLojas : dadosDashboard),
  );

  const formatMoney = (val) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
  const formatMoneyShort = (val) => {
    const v = toN(val);
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`;
    return formatMoney(v);
  };
  const formatDia = (str) =>
    new Date(str + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  const metricaLabel = { faturamento: "Faturamento", custo: "Custo Total", lucro: "Lucro Líquido" };
  const metricaCor   = { faturamento: "#10B981",     custo: "#EF4444",     lucro: "#3B82F6" };
  const metricaCorArea = { faturamento: "#10B98120", custo: "#EF444420",  lucro: "#3B82F620" };

  const temDadosAnuais = dadosAnuaisVisiveis.length > 0;
  const lojaAnualNome = lojaSelecionada === TODAS_LOJAS_VALUE ? "Todas as Lojas"
    : lojas.find((l) => String(l.id) === String(lojaSelecionada))?.nome || "Loja";

  if (loading && !dadosDisponiveis && !temDadosAnuais) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gray-50 bg-pattern teddy-pattern">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Painel de Controle e Gráficos" subtitle="Visão estratégica do seu negócio" icon="📊" />

        {/* ════════════════════════════════════════════════════════════
            BLOCO 1 — Filtros do painel de período
        ════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl shadow p-6 mb-8 border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Filtros do período</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Loja</label>
              <select value={lojaSelecionada} onChange={(e) => setLojaSelecionada(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border text-sm">
                {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Data Inicial</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Data Final</label>
              <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 border text-sm" />
            </div>
          </div>
        </div>

        {erro && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 text-red-700 rounded-r-lg">
            <p className="font-bold">Atenção</p><p>{erro}</p>
          </div>
        )}
        {loading && (
          <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 p-4 text-blue-700 rounded-r-lg text-sm">
            Atualizando dados do período...
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            BLOCO 2 — PAINEL ANUAL (sempre visível se loja selecionada)
        ════════════════════════════════════════════════════════════ */}
        {lojaSelecionada && lojaSelecionada !== NENHUMA_LOJA_VALUE && (
          <div className="bg-white rounded-xl shadow-lg border border-indigo-100 p-6 mb-8">

            {/* Cabeçalho do painel anual */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">📆</span>
                  Evolução Anual — {lojaAnualNome}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Comparativo mês a mês com variação percentual</p>
              </div>

              {/* Controles do painel anual */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Select de Ano */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-600">Ano:</label>
                  <select
                    value={anoSelecionado}
                    onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 font-bold px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {anosDisponiveis.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                {/* Selector de métrica */}
                <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm">
                  {Object.entries(metricaLabel).map(([key, label]) => (
                    <button key={key}
                      onClick={() => setMetricaAnual(key)}
                      className={`px-3 py-1.5 font-medium transition-all ${
                        metricaAnual === key
                          ? "bg-indigo-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* KPI Cards anuais */}
            {temDadosAnuais && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Faturamento Anual</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{formatMoneyShort(totaisAno.faturamento)}</p>
                  <p className="text-xs text-emerald-500 mt-1">{totaisAno.meses} meses</p>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                  <p className="text-xs text-rose-600 font-semibold uppercase tracking-wide">Custo Anual</p>
                  <p className="text-xl font-bold text-rose-700 mt-1">{formatMoneyShort(totaisAno.custo)}</p>
                  <p className="text-xs text-rose-500 mt-1">
                    {totaisAno.faturamento > 0 ? `${((totaisAno.custo / totaisAno.faturamento) * 100).toFixed(1)}% do faturamento` : "—"}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Lucro Anual</p>
                  <p className={`text-xl font-bold mt-1 ${totaisAno.lucro >= 0 ? "text-blue-700" : "text-red-600"}`}>
                    {formatMoneyShort(totaisAno.lucro)}
                  </p>
                  <p className="text-xs text-blue-500 mt-1">
                    {totaisAno.faturamento > 0 ? `Margem ${((totaisAno.lucro / totaisAno.faturamento) * 100).toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Média Mensal</p>
                  <p className="text-xl font-bold text-amber-700 mt-1">{formatMoneyShort(mediaAnual)}</p>
                  <p className="text-xs text-amber-500 mt-1">
                    {melhorMes ? `Melhor: ${melhorMes.nome}` : "—"}
                  </p>
                </div>
              </div>
            )}

            {/* Destaques: melhor e pior mês */}
            {temDadosAnuais && melhorMes && piorMes && (
              <div className="flex flex-wrap gap-3 mb-5">
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                  <span className="text-lg">🏆</span>
                  <span className="text-gray-600">Melhor mês:</span>
                  <span className="font-bold text-green-700">{melhorMes.nome}</span>
                  <span className="text-green-600 font-semibold">{formatMoneyShort(melhorMes[metricaAnual])}</span>
                </div>
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                  <span className="text-lg">📉</span>
                  <span className="text-gray-600">Pior mês:</span>
                  <span className="font-bold text-red-700">{piorMes.nome}</span>
                  <span className="text-red-600 font-semibold">{formatMoneyShort(piorMes[metricaAnual])}</span>
                </div>
              </div>
            )}

            {/* ── Gráfico de linha anual ── */}
            {loadingAnual ? (
              <div className="flex items-center justify-center h-80 text-gray-400">
                <div className="text-center">
                  <div className="inline-block w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mb-3" />
                  <p className="text-sm">Carregando dados mensais...</p>
                </div>
              </div>
            ) : temDadosAnuais ? (
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={dadosAnuaisVisiveis}
                    margin={{ top: 20, right: 40, left: 20, bottom: 10 }}
                  >
                    {/* Grid e eixos */}
                    <CartesianGrid strokeDasharray="4 4" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="nome"
                      tick={{ fontSize: 13, fontWeight: 600, fill: "#374151" }}
                      axisLine={{ stroke: "#e5e7eb" }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatMoneyShort}
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      axisLine={false}
                      tickLine={false}
                      width={72}
                    />
                    <YAxis
                      yAxisId="var"
                      orientation="right"
                      tickFormatter={(v) => v !== null ? `${v > 0 ? "+" : ""}${v?.toFixed(0)}%` : ""}
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      axisLine={false}
                      tickLine={false}
                      domain={[-100, 100]}
                      width={52}
                    />

                    <Tooltip
                      content={<TooltipAnual formatMoney={formatMoney} />}
                      cursor={{ stroke: "#c7d2fe", strokeWidth: 2, strokeDasharray: "4 4" }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: "16px", fontSize: "13px" }}
                    />

                    {/* Linha de média */}
                    <ReferenceLine
                      y={mediaAnual}
                      stroke={metricaCor[metricaAnual]}
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      strokeOpacity={0.5}
                      label={{
                        value: `Média ${formatMoneyShort(mediaAnual)}`,
                        position: "insideTopRight",
                        fontSize: 11,
                        fill: metricaCor[metricaAnual],
                        opacity: 0.8,
                      }}
                    />

                    {/* Linha de zero para lucro */}
                    {metricaAnual === "lucro" && (
                      <ReferenceLine y={0} stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" />
                    )}

                    {/* Linhas principais — sempre mostra faturamento, custo e lucro */}
                    <Line
                      type="monotoneX"
                      dataKey="faturamento"
                      name="Faturamento"
                      stroke="#10B981"
                      strokeWidth={metricaAnual === "faturamento" ? 3.5 : 1.5}
                      strokeOpacity={metricaAnual === "faturamento" ? 1 : 0.3}
                      dot={metricaAnual === "faturamento"
                        ? { r: 5, fill: "#10B981", stroke: "#fff", strokeWidth: 2 }
                        : false}
                      activeDot={{ r: 7, fill: "#10B981", stroke: "#fff", strokeWidth: 2 }}
                    />
                    <Line
                      type="monotoneX"
                      dataKey="custo"
                      name="Custo Total"
                      stroke="#EF4444"
                      strokeWidth={metricaAnual === "custo" ? 3.5 : 1.5}
                      strokeOpacity={metricaAnual === "custo" ? 1 : 0.3}
                      dot={metricaAnual === "custo"
                        ? { r: 5, fill: "#EF4444", stroke: "#fff", strokeWidth: 2 }
                        : false}
                      activeDot={{ r: 7, fill: "#EF4444", stroke: "#fff", strokeWidth: 2 }}
                    />
                    <Line
                      type="monotoneX"
                      dataKey="lucro"
                      name="Lucro Líquido"
                      stroke="#3B82F6"
                      strokeWidth={metricaAnual === "lucro" ? 3.5 : 1.5}
                      strokeOpacity={metricaAnual === "lucro" ? 1 : 0.3}
                      dot={metricaAnual === "lucro"
                        ? { r: 5, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2 }
                        : false}
                      activeDot={{ r: 7, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2 }}
                    />

                    {/* Linha de variação percentual (eixo direito) */}
                    <Line
                      yAxisId="var"
                      type="monotoneX"
                      dataKey="variacaoMes"
                      name="Variação % (mês ant.)"
                      stroke="#8B5CF6"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                      dot={{ r: 3, fill: "#8B5CF6", stroke: "#fff", strokeWidth: 1.5 }}
                      activeDot={{ r: 6, fill: "#8B5CF6" }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                Selecione uma loja para ver a evolução anual.
              </div>
            )}

            {/* Tabela resumo mensal */}
            {temDadosAnuais && (
              <div className="mt-6 overflow-x-auto rounded-xl border border-gray-100">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">Mês</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-emerald-600 uppercase tracking-wide">Faturamento</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-rose-500 uppercase tracking-wide">Custo</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-blue-600 uppercase tracking-wide">Lucro</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">Margem</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-purple-600 uppercase tracking-wide">Var. Mês</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dadosAnuaisVisiveis.map((d, idx) => {
                      const margem = d.faturamento > 0 ? (d.lucro / d.faturamento) * 100 : 0;
                      const isDestaque = d.nome === melhorMes?.nome;
                      const isPior     = d.nome === piorMes?.nome;
                      return (
                        <tr key={idx}
                          className={`transition-colors ${
                            isDestaque ? "bg-green-50" : isPior ? "bg-red-50" : "hover:bg-gray-50"
                          }`}>
                          <td className="px-4 py-2.5 font-semibold text-gray-800 flex items-center gap-1.5">
                            {isDestaque && <span className="text-base">🏆</span>}
                            {isPior && <span className="text-base">📉</span>}
                            {d.nome}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-emerald-700">{formatMoneyShort(d.faturamento)}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-rose-600">{formatMoneyShort(d.custo)}</td>
                          <td className={`px-4 py-2.5 text-right font-bold ${d.lucro >= 0 ? "text-blue-700" : "text-red-600"}`}>
                            {formatMoneyShort(d.lucro)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-500">{margem.toFixed(1)}%</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${
                            d.variacaoMes === null ? "text-gray-300"
                            : d.variacaoMes >= 0 ? "text-emerald-600" : "text-red-500"
                          }`}>
                            {d.variacaoMes === null ? "—"
                              : `${d.variacaoMes >= 0 ? "▲" : "▼"} ${Math.abs(d.variacaoMes).toFixed(1)}%`
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {temDadosAnuais && (
                    <tfoot>
                      <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold">
                        <td className="px-4 py-3 text-gray-700">TOTAL {anoSelecionado}</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{formatMoneyShort(totaisAno.faturamento)}</td>
                        <td className="px-4 py-3 text-right text-rose-600">{formatMoneyShort(totaisAno.custo)}</td>
                        <td className={`px-4 py-3 text-right ${totaisAno.lucro >= 0 ? "text-blue-700" : "text-red-600"}`}>
                          {formatMoneyShort(totaisAno.lucro)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {totaisAno.faturamento > 0 ? `${((totaisAno.lucro / totaisAno.faturamento) * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">—</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            BLOCO 3 — Painel de período (rankings, KPIs, gráficos)
        ════════════════════════════════════════════════════════════ */}
        {dadosDisponiveis && (
          <div className="space-y-8 animate-fade-in">

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <RankingCard titulo="Ranking: Total Vendas das Lojas"   icon="🏆" dados={rankingLucroBruto}  campoNome="lojaNome" campoValor="lucroBruto"            formatValor={formatMoney} />
              <RankingCard titulo="Ranking: Lucro Líquido das Lojas" icon="💰" dados={rankingLucroLojas}  campoNome="lojaNome" campoValor="lucroLiquido"           formatValor={formatMoney} />
              <RankingCard titulo="Ranking: Gasto Total das Lojas"   icon="🧾" dados={rankingGastoLojas}  campoNome="lojaNome" campoValor="custoTotal"             formatValor={formatMoney} />
              <RankingCard titulo="Ranking: Gasto Fixo das Lojas"    icon="🏠" dados={gastosFixosPorLoja} campoNome="lojaNome" campoValor="custoFixo"              formatValor={formatMoney} />
              <RankingCard titulo="Participação Percentual por Loja" icon="📊" dados={participacaoLojas}  campoNome="lojaNome" campoValor="participacaoLucroBruto" formatValor={(v) => `${toN(v).toFixed(2)}%`} />
            </div>

            <div className="flex flex-wrap gap-6">
              <KpiCard titulo="Faturamento Bruto" valor={formatMoney(kpiFaturamento)} icon="💰" cor="green" />
              <KpiCard titulo="Dinheiro"           valor={formatMoney(kpiDinheiro)}   icon="💵" cor="yellow" />
              <KpiCard titulo="Cartão/Pix"         valor={formatMoney(kpiCartao)}     icon="🟢" cor="cyan" />
              <KpiCard titulo="Lucro Líquido"      valor={formatMoney(kpiLiquido)}    icon="📈" cor="blue"
                extra={<><span className="font-semibold text-green-600">{kpiMargem.toFixed(1)}%</span><span className="text-gray-500 ml-1">Margem</span></>} />
              <KpiCard titulo="Custo Total"        valor={formatMoney(kpiCusto)}      icon="🧾" cor="rose"
                extra={`${kpiIndiceCusto.toFixed(1)}% do faturamento`} />
              <KpiCard titulo="Prêmios Entregues"  valor={kpiSaidas.toLocaleString("pt-BR")} icon="🧸" cor="orange" />
              <KpiCard titulo="Total Fichas"       valor={kpiFichas.toLocaleString("pt-BR")} icon="🎫" cor="purple"
                extra={kpiSaidas > 0 ? `Média: ${(kpiFichas / kpiSaidas).toFixed(1)} fichas/prêmio` : null} />
            </div>

            {!isTodas && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {graficoFinanceiro.length > 0 ? (
                    <GraficoCard titulo="Evolução Diária" icon="📅" height="h-80"
                      nota="Custos fixos e variáveis distribuídos por dia (rateio).">
                      <AreaChart data={graficoFinanceiro}>
                        <defs>
                          <linearGradient id="colorFat" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#10B981" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}   />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="data" tickFormatter={formatDia} tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => formatMoney(v)} labelFormatter={(l) => new Date(l + "T12:00:00").toLocaleDateString("pt-BR")} />
                        <Legend />
                        <Area type="monotone" dataKey="faturamento"  name="Faturamento"   stroke="#10B981" fill="url(#colorFat)" />
                        <Area type="monotone" dataKey="custoRateado" name="Custo Rateado" stroke="#EF4444" fillOpacity={0.1} fill="#EF4444" />
                      </AreaChart>
                    </GraficoCard>
                  ) : <EmptyChart mensagem="Sem dados diários para o período." />}

                  {performanceMaquinas.length > 0 ? (
                    <GraficoCard titulo="Performance por Máquina" icon="🤖" height="h-80">
                      <BarChart data={performanceMaquinas} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="nome" type="category" width={100} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v, name) => [name === "faturamento" ? formatMoney(v) : `${v}%`, name === "faturamento" ? "Faturamento" : "Ocupação"]} />
                        <Legend />
                        <Bar dataKey="faturamento" name="Faturamento" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </GraficoCard>
                  ) : <EmptyChart mensagem="Sem dados de performance por máquina." />}
                </div>

                {graficoFinanceiro.length > 0 && (
                  <GraficoCard titulo="Receita x Custo x Resultado" icon="📉">
                    <LineChart data={graficoFinanceiro}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="data" tickFormatter={formatDia} />
                      <YAxis />
                      <Tooltip formatter={(v) => formatMoney(v)} labelFormatter={(l) => new Date(l + "T12:00:00").toLocaleDateString("pt-BR")} />
                      <Legend />
                      <Line type="monotone" dataKey="faturamento"  name="Receita"          stroke="#10B981" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="custoRateado" name="Custo Rateado"     stroke="#EF4444" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="lucroRateado" name="Resultado Rateado" stroke="#3B82F6" strokeWidth={3} dot={false} />
                    </LineChart>
                  </GraficoCard>
                )}

                {performanceMaquinas.length > 0 && (
                  <GraficoCard titulo="Nível de Estoque (%)" icon="📦" height="h-80">
                    <BarChart data={performanceMaquinas} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Bar dataKey="ocupacao" name="Ocupação" radius={[4, 4, 0, 0]}>
                        {performanceMaquinas.map((entry, i) => (
                          <Cell key={i} fill={entry.ocupacao < 30 ? "#EF4444" : entry.ocupacao < 60 ? "#F59E0B" : "#10B981"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </GraficoCard>
                )}
              </>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {kpiCustos.length > 0 ? (
                <GraficoCard titulo="Composição de Custos" icon="🧩">
                  <PieChart>
                    <Pie data={kpiCustos} dataKey="valor" nameKey="nome" outerRadius={95}
                      label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`}>
                      {kpiCustos.map((_, i) => (
                        <Cell key={i} fill={["#F97316", "#3B82F6", "#10B981"][i % 3]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(v)} />
                  </PieChart>
                </GraficoCard>
              ) : <EmptyChart mensagem="Sem dados de composição de custos." />}

              {kpiRecebimentos.some((r) => r.valor > 0) ? (
                <GraficoCard titulo="Mix de Recebimentos" icon="💳">
                  <BarChart data={kpiRecebimentos}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="metodo" />
                    <YAxis />
                    <Tooltip formatter={(v) => formatMoney(v)} />
                    <Bar dataKey="valor" name="Valor" radius={[6, 6, 0, 0]}>
                      {kpiRecebimentos.map((entry, i) => (
                        <Cell key={i} fill={entry.metodo === "Dinheiro" ? "#F59E0B" : "#06B6D4"} />
                      ))}
                    </Bar>
                  </BarChart>
                </GraficoCard>
              ) : <EmptyChart mensagem="Sem dados de recebimentos." />}
            </div>

            {rankingProdutosAtivo.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <span className="bg-gray-100 p-1 rounded mr-2">🏆</span>Top Produtos Vendidos
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qtd</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Popularidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rankingProdutosAtivo.map((prod, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{idx + 1}. {prod.nome}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right">{toN(prod.quantidade).toLocaleString("pt-BR")}</td>
                          <td className="px-4 py-3">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div className="bg-indigo-600 h-2 rounded-full"
                                style={{ width: `${Math.min((toN(prod.quantidade) / toN(rankingProdutosAtivo[0]?.quantidade || 1)) * 100, 100)}%` }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!isTodas && fluxoProdutos.length > 0 && (
              <GraficoCard titulo="Fluxo de Produtos (Entradas x Saídas)" icon="🔁" height="h-96">
                <BarChart data={fluxoProdutos} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="entrou" name="Entrou" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saiu"   name="Saiu"   fill="#F97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </GraficoCard>
            )}

          </div>
        )}

        {!loading && !dadosDisponiveis && !lojaSelecionada && !erro && (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600 border border-gray-100">
            Selecione os filtros para visualizar os gráficos financeiros.
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function GraficoCard({ titulo, icon, height = "h-72", nota, children }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
        <span className="bg-gray-100 p-1 rounded mr-2">{icon}</span>{titulo}
      </h3>
      {nota && <p className="text-xs text-gray-500 mb-3">{nota}</p>}
      <div className={`${height} w-full`}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function RankingCard({ titulo, icon, dados, campoNome, campoValor, formatValor }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
        <span className="bg-gray-100 p-1 rounded mr-2">{icon}</span>{titulo}
      </h3>
      {dados.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Loja</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dados.map((loja, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900 font-medium">{idx + 1}. {loja[campoNome]}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatValor(loja[campoValor])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center py-6">Sem dados disponíveis.</p>
      )}
    </div>
  );
}

const COR_MAP = {
  green:  "border-green-500  bg-green-100  text-green-600",
  yellow: "border-yellow-500 bg-yellow-100 text-yellow-600",
  cyan:   "border-cyan-500   bg-cyan-100   text-cyan-600",
  blue:   "border-blue-500   bg-blue-100   text-blue-600",
  orange: "border-orange-500 bg-orange-100 text-orange-600",
  purple: "border-purple-500 bg-purple-100 text-purple-600",
  rose:   "border-rose-500   bg-rose-100   text-rose-600",
};

function KpiCard({ titulo, valor, icon, cor, extra }) {
  const [border, bg, text] = (COR_MAP[cor] || COR_MAP.blue).split(" ");
  return (
    <div className={`bg-white p-6 rounded-lg shadow-md border-l-4 ${border}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{titulo}</p>
          <h3 className="text-2xl font-bold text-gray-900 mt-1">{valor}</h3>
        </div>
        <span className={`p-2 ${bg} ${text} rounded-lg text-xl`}>{icon}</span>
      </div>
      {extra && <div className="mt-3 text-xs text-gray-500">{extra}</div>}
    </div>
  );
}

function EmptyChart({ mensagem }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow flex items-center justify-center h-72 text-gray-400 text-sm border border-dashed border-gray-200">
      {mensagem}
    </div>
  );
}