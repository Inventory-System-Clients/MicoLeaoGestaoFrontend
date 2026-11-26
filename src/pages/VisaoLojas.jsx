import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { AlertBox } from "../components/UIComponents";
import { useAuth } from "../contexts/AuthContext";
import { filtrarLojasOperacionais, ehDepositoPrincipal } from "../utils/lojas";
import { confirmar } from "../utils/alerts";
import { pode } from "../utils/perfis";

const DIAS_SEM_MOVIMENTACAO = 15;

const numero = (valor) => Number(valor || 0);
const reais = (valor) =>
  Number(valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const normalizar = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// Mesma tolerância usada no alerta "Pelúcias fora do esperado" (Alertas):
// só considera fora do esperado quando a diferença passa de 3 jogadas pra
// mais ou pra menos, pra pequenas oscilações não virarem pendência.
const TOLERANCIA_JOGADAS = 3;

// Espelha o cálculo de backend/src/controllers/relatorioController.js
// (alertasBomDesempenho) pra loja e alerta mostrarem o mesmo número.
const calcularAlertasJogadas = (maquinasDaLoja, movimentacoes) => {
  const alertas = [];

  for (const maquina of maquinasDaLoja) {
    const jogadasEsperadas = numero(maquina.jogadasBoasPorPelucia);
    // Máquina (categoria MAQUINA) não tem ficha própria: usa o valor da
    // jogada (R$) direto com o contador IN, em vez de valorFicha*fichas.
    const semFichaPropria = maquina.categoriaGeradora === "MAQUINA";
    const valorFicha = numero(maquina.valorFicha);
    const fichasParaJogar = numero(maquina.fichasNecessarias) || 1;
    const valorJogada = numero(maquina.valorJogada);
    const valorPorJogada = semFichaPropria
      ? valorJogada
      : Number((valorFicha * fichasParaJogar).toFixed(2));

    if (jogadasEsperadas <= 0 || valorPorJogada <= 0) {
      continue;
    }

    const movsDaMaquina = movimentacoes
      .filter((mov) => String(mov.maquinaId) === String(maquina.id))
      .sort(
        (a, b) =>
          new Date(b.dataColeta || b.createdAt) -
          new Date(a.dataColeta || a.createdAt),
      );

    if (movsDaMaquina.length < 2) continue;

    const atual = movsDaMaquina[0];
    const anterior = movsDaMaquina[1];
    const quantidadeSaiu = numero(atual.sairam);

    if (
      atual.contadorIn === null ||
      atual.contadorIn === undefined ||
      anterior.contadorIn === null ||
      anterior.contadorIn === undefined ||
      quantidadeSaiu <= 0
    ) {
      continue;
    }

    const diffIn = numero(atual.contadorIn) - numero(anterior.contadorIn);
    if (diffIn <= 0) continue;

    const jogadasPeriodo = Number((diffIn / valorPorJogada).toFixed(2));
    const jogadasPorPelucia = Number(
      (jogadasPeriodo / quantidadeSaiu).toFixed(2),
    );
    const diferenca = Number(
      (jogadasPorPelucia - jogadasEsperadas).toFixed(2),
    );

    if (Math.abs(diferenca) > TOLERANCIA_JOGADAS) {
      alertas.push({
        maquinaId: maquina.id,
        maquinaNome: maquina.nome || maquina.codigo || "Máquina",
        jogadasPorPelucia,
        jogadasEsperadas,
        diferenca,
        abaixoDaMeta: diferenca < 0,
      });
    }
  }

  return alertas;
};

const formatarData = (valor) => {
  if (!valor) return "Sem registro";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Sem registro";
  return data.toLocaleDateString("pt-BR");
};

const diferencaDias = (valor) => {
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return Math.floor((Date.now() - data.getTime()) / (1000 * 60 * 60 * 24));
};

const obterExtintores = (loja) =>
  Array.isArray(loja?.extintores) ? loja.extintores : [];

// Pega o extintor que vence primeiro (o "pior caso" da loja). Se a loja
// ainda não tiver nenhum extintor na lista nova, cai pro campo antigo
// (compatibilidade com dados que ainda não passaram pela migração).
const obterProximoExtintor = (loja) => {
  const lista = obterExtintores(loja);
  if (lista.length > 0) {
    return [...lista].sort(
      (a, b) => new Date(a.dataVencimento) - new Date(b.dataVencimento),
    )[0];
  }

  const dataAntiga =
    loja?.dataVencimentoExtintor || loja?.data_vencimento_extintor || null;
  return dataAntiga ? { dataVencimento: dataAntiga } : null;
};

const DIAS_AVISO_CONTRATO_DEFAULT = 60;

const obterDataContrato = (loja) =>
  loja?.dataFimContrato || loja?.data_fim_contrato || null;

const obterDiasAvisoContratoEfetivo = (loja) => {
  const adiado = loja?.contratoAvisoAdiadoDias ?? loja?.contrato_aviso_adiado_dias;
  if (adiado !== null && adiado !== undefined) return numero(adiado);

  const padrao = loja?.diasAvisoContrato ?? loja?.dias_aviso_contrato;
  return padrao !== null && padrao !== undefined
    ? numero(padrao)
    : DIAS_AVISO_CONTRATO_DEFAULT;
};

const montarStatusLoja = ({ loja, pendencias, manutencoesAbertas, diasSemMov }) => {
  const statusOperacao = loja?.statusOperacao || loja?.status_operacao;

  if (statusOperacao === "EM_IMPLANTACAO") {
    return {
      label: "Em implantação",
      className: "bg-blue-100 text-blue-800 border-blue-200",
    };
  }

  if (statusOperacao === "INATIVA" || loja?.ativo === false) {
    return {
      label: "Pausada",
      className: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }

  if (manutencoesAbertas > 0 || pendencias > 0) {
    return {
      label: "Com pendência",
      className: "bg-amber-100 text-amber-800 border-amber-200",
    };
  }

  if (diasSemMov !== null && diasSemMov >= DIAS_SEM_MOVIMENTACAO) {
    return {
      label: "Sem movimentação",
      className: "bg-red-100 text-red-700 border-red-200",
    };
  }

  return {
    label: "Em operação",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
};

const montarPontosAtencao = (item) => {
  const pontos = [];

  if (item.manutencoesAbertas.length > 0) {
    pontos.push(`${item.manutencoesAbertas.length} manutenção(ões) em aberto`);
  }

  if (item.itensAbaixoMinimo.length > 0) {
    pontos.push(`${item.itensAbaixoMinimo.length} produto(s) abaixo do estoque mínimo`);
  }

  if (item.diasSemMov !== null && item.diasSemMov >= DIAS_SEM_MOVIMENTACAO) {
    pontos.push(`sem movimentação há ${item.diasSemMov} dias`);
  }

  if (item.diasExtintor !== null && item.diasExtintor <= 30) {
    pontos.push(
      item.diasExtintor < 0
        ? "extintor vencido"
        : `extintor vence em ${item.diasExtintor} dias`,
    );
  }

  if (item.contratoAlerta) {
    pontos.push(
      item.diasContrato < 0
        ? "contrato vencido"
        : `contrato vence em ${item.diasContrato} dias`,
    );
  }

  for (const alerta of item.alertasJogadas) {
    pontos.push(
      `${alerta.maquinaNome}: ${alerta.jogadasPorPelucia} jogada(s) por pelúcia (esperado ${alerta.jogadasEsperadas} ± ${TOLERANCIA_JOGADAS})`,
    );
  }

  return pontos;
};

// Visão das Lojas: desde 2026-11-26 é a página "Lojas" do menu (a antiga
// lista /lojas redireciona pra cá) e tem o que só existia lá: nova loja,
// editar, desativar/excluir, busca por código de máquina, endereço, telefone
// e valor da ficha. Mostra também o tipo (🎮 máquina avulsa), o shopping e a
// loja de onde vem o estoque.
export function VisaoLojas() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  // Acessos (permissoes): sem ajuste vale a regra de perfil de antes
  const regraCadastro = ["ADMIN", "FUNCIONARIO_CADASTRO"].includes(usuario?.role);
  const podeCriarLoja = pode(usuario, "lojas.criar", regraCadastro);
  const podeEditarLoja = pode(usuario, "lojas.editar", regraCadastro);
  const podeExcluirLoja = pode(usuario, "lojas.excluir", regraCadastro);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lojasResumo, setLojasResumo] = useState([]);
  const [deposito, setDeposito] = useState(null);
  const [nomesLojas, setNomesLojas] = useState({});
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  // /visao-lojas?shopping=<id> (vem da Visão dos Shoppings)
  const [parametros] = useSearchParams();
  const [filtroShopping, setFiltroShopping] = useState(parametros.get("shopping") || "todos");
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    const carregarVisao = async () => {
      try {
        if (recarga === 0) setLoading(true);
        setError("");

        const [lojasRes, maquinasRes, manutencoesRes] = await Promise.all([
          api.get("/lojas"),
          api.get("/maquinas"),
          api.get("/manutencoes").catch(() => ({ data: [] })),
        ]);

        const todasLojas = lojasRes.data || [];
        const lojas = filtrarLojasOperacionais(todasLojas);
        setDeposito(todasLojas.find(ehDepositoPrincipal) || null);
        setNomesLojas(Object.fromEntries(todasLojas.map((l) => [l.id, l.nome])));
        const maquinas = maquinasRes.data || [];
        const manutencoes = manutencoesRes.data || [];

        const resumos = await Promise.all(
          lojas.map(async (loja) => {
            const maquinasDaLoja = maquinas.filter(
              (maquina) => String(maquina.lojaId) === String(loja.id),
            );

            const [estoqueRes, movimentacoesRes] = await Promise.all([
              api.get(`/estoque-lojas/${loja.id}`).catch(() => ({ data: [] })),
              api
                .get(`/movimentacoes?lojaId=${loja.id}&limite=50`)
                .catch(() => ({ data: [] })),
            ]);

            const estoque = estoqueRes.data || [];
            const movimentacoes = movimentacoesRes.data || [];
            const ultimaMovimentacao = movimentacoes[0] || null;
            const diasSemMov = diferencaDias(
              ultimaMovimentacao?.dataMovimentacao ||
                ultimaMovimentacao?.dataColeta ||
                ultimaMovimentacao?.createdAt,
            );

            const estoqueAtual = estoque.reduce(
              (total, item) => total + numero(item.quantidade),
              0,
            );
            const estoqueMinimo = estoque.reduce(
              (total, item) =>
                total +
                numero(item.estoqueMinimo || item.produto?.estoqueMinimo),
              0,
            );
            const itensAbaixoMinimo = estoque.filter(
              (item) =>
                numero(item.quantidade) <=
                numero(item.estoqueMinimo || item.produto?.estoqueMinimo),
            );

            const manutencoesDaLoja = manutencoes.filter(
              (manutencao) => String(manutencao.lojaId) === String(loja.id),
            );
            const manutencoesAbertas = manutencoesDaLoja.filter(
              (manutencao) => !["CONCLUIDA", "FINALIZADA"].includes(manutencao.status),
            );

            const totalSairam = movimentacoes.reduce(
              (total, mov) => total + numero(mov.sairam),
              0,
            );
            const totalFichas = movimentacoes.reduce(
              (total, mov) => total + numero(mov.fichas),
              0,
            );
            const totalVisitas = movimentacoes.length;
            const mediaPelucias =
              totalVisitas > 0 ? totalSairam / totalVisitas : 0;
            const mediaFichasPorPelucia =
              totalSairam > 0 ? totalFichas / totalSairam : 0;
            const ultimaSaida = numero(ultimaMovimentacao?.sairam);
            const alertasJogadas = calcularAlertasJogadas(
              maquinasDaLoja,
              movimentacoes,
            );
            const temMetaConfigurada = maquinasDaLoja.some(
              (maquina) => numero(maquina.jogadasBoasPorPelucia) > 0,
            );

            const proximoExtintor = obterProximoExtintor(loja);
            const dataExtintor = proximoExtintor?.dataVencimento || null;
            const diasExtintor = dataExtintor
              ? Math.ceil(
                  (new Date(dataExtintor).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24),
                )
              : null;
            const totalExtintores = obterExtintores(loja).length;

            const dataContrato = obterDataContrato(loja);
            const diasContrato = dataContrato
              ? Math.ceil(
                  (new Date(dataContrato).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24),
                )
              : null;
            const diasAvisoContratoEfetivo = obterDiasAvisoContratoEfetivo(loja);
            const contratoAlerta =
              diasContrato !== null && diasContrato <= diasAvisoContratoEfetivo;

            const pendencias =
              itensAbaixoMinimo.length +
              manutencoesAbertas.length +
              alertasJogadas.length +
              (diasSemMov !== null && diasSemMov >= DIAS_SEM_MOVIMENTACAO
                ? 1
                : 0) +
              (diasExtintor !== null && diasExtintor <= 30 ? 1 : 0) +
              (contratoAlerta ? 1 : 0);

            const status = montarStatusLoja({
              loja,
              pendencias,
              manutencoesAbertas: manutencoesAbertas.length,
              diasSemMov,
            });

            return {
              loja,
              status,
              maquinas: maquinasDaLoja,
              estoqueAtual,
              estoqueMinimo,
              itensAbaixoMinimo,
              manutencoesAbertas,
              ultimaMovimentacao,
              diasSemMov,
              dataExtintor,
              diasExtintor,
              totalExtintores,
              dataContrato,
              diasContrato,
              contratoAlerta,
              mediaPelucias,
              totalSairam,
              totalFichas,
              totalVisitas,
              mediaFichasPorPelucia,
              ultimaSaida,
              alertasJogadas,
              temMetaConfigurada,
              pendencias,
            };
          }),
        );

        setLojasResumo(resumos);
      } catch (err) {
        console.error("Erro ao carregar visão das lojas:", err);
        setError("Não foi possível carregar a visão das lojas.");
      } finally {
        setLoading(false);
      }
    };

    carregarVisao();
  }, [recarga]);

  // 1º clique desativa; loja já desativada é excluída de vez (com as máquinas)
  const excluirLoja = async (loja) => {
    const inativa = loja.ativo === false;
    const nomeTipo = loja.tipo === "AVULSA" ? "máquina avulsa" : "loja";
    const confirmado = await confirmar({
      title: inativa ? `Excluir ${nomeTipo} de vez?` : `Desativar ${nomeTipo}?`,
      text: inativa
        ? `"${loja.nome}" será excluída permanentemente, junto com as máquinas cadastradas nela.`
        : `"${loja.nome}" fica desativada (Pausada). Para excluir de vez, use o botão de novo depois.`,
      confirmButtonText: inativa ? "Excluir de vez" : "Desativar",
    });
    if (!confirmado) return;
    try {
      const response = await api.delete(`/lojas/${loja.id}`);
      setSuccess(response.data?.message || "Pronto.");
      setRecarga((n) => n + 1);
    } catch (err) {
      setError(err.response?.data?.error || "Não foi possível excluir.");
    }
  };

  const totais = useMemo(
    () =>
      lojasResumo.reduce(
        (acc, item) => ({
          lojas: acc.lojas + 1,
          ativas: acc.ativas + (item.loja.ativo !== false ? 1 : 0),
          avulsas: acc.avulsas + (item.loja.tipo === "AVULSA" ? 1 : 0),
          operacao: acc.operacao + (item.status.label === "Em operação" ? 1 : 0),
          pendencias: acc.pendencias + item.pendencias,
          maquinas: acc.maquinas + item.maquinas.length,
          manutencoes: acc.manutencoes + item.manutencoesAbertas.length,
        }),
        { lojas: 0, ativas: 0, avulsas: 0, operacao: 0, pendencias: 0, maquinas: 0, manutencoes: 0 },
      ),
    [lojasResumo],
  );

  const shoppings = useMemo(() => {
    const mapa = new Map();
    for (const item of lojasResumo) {
      if (item.loja.shopping) mapa.set(item.loja.shopping.id, item.loja.shopping.nome);
    }
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [lojasResumo]);

  // Busca pelo nome da loja, do shopping ou pelo código/nome de uma máquina
  const lojasFiltradas = useMemo(() => {
    const texto = normalizar(busca.trim());
    return lojasResumo.filter((item) => {
      const bateBusca =
        !texto ||
        normalizar(item.loja.nome).includes(texto) ||
        normalizar(item.loja.shopping?.nome).includes(texto) ||
        item.maquinas.some(
          (m) => normalizar(m.codigo).includes(texto) || normalizar(m.nome).includes(texto),
        );
      const bateStatus =
        filtroStatus === "todos" || item.status.label === filtroStatus;
      const bateTipo =
        filtroTipo === "todos" ||
        (filtroTipo === "AVULSA" ? item.loja.tipo === "AVULSA" : item.loja.tipo !== "AVULSA");
      const bateShopping =
        filtroShopping === "todos" ||
        (filtroShopping === "sem" ? !item.loja.shoppingId : item.loja.shoppingId === filtroShopping);
      return bateBusca && bateStatus && bateTipo && bateShopping;
    });
  }, [busca, filtroStatus, filtroTipo, filtroShopping, lojasResumo]);

  if (loading) return <PageLoader message="Carregando visão das lojas..." />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mb-3 text-sm font-semibold text-orange-700 hover:text-orange-800"
            >
              ← Voltar ao dashboard
            </button>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Visão das Lojas
            </h1>
            <p className="mt-2 text-gray-600">
              Operação, estoque, movimentações e pendências por loja e máquina avulsa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-xl lg:justify-end">
            <button type="button" onClick={() => navigate("/shoppings")} className="btn-secondary">
              🏬 Shoppings
            </button>
            {deposito && podeEditarLoja && (
              <button
                type="button"
                onClick={() => navigate(`/lojas/${deposito.id}/editar`)}
                className="btn-secondary"
                title="Gastos fixos e dados do Depósito Principal"
              >
                🏭 Depósito Principal
              </button>
            )}
            {podeCriarLoja && (
              <button type="button" onClick={() => navigate("/lojas/nova?tipo=AVULSA")} className="btn-secondary">
                🎮 Nova máquina avulsa
              </button>
            )}
            {podeCriarLoja && (
              <button type="button" onClick={() => navigate("/lojas/nova")} className="btn-primary">
                Nova loja
              </button>
            )}
          </div>
        </div>

        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}
        {success && <AlertBox type="success" message={success} onClose={() => setSuccess("")} />}

        <section className="mb-6 grid grid-cols-2 lg:grid-cols-6 gap-4">
          {[
            ["Lojas", totais.lojas],
            ["Ativas", totais.ativas],
            ["Em operação", totais.operacao],
            ["Máquinas", totais.maquinas],
            ["Pendências", totais.pendencias],
            ["Manutenções", totais.manutencoes],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-orange-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </section>

        <section className="mb-6 flex flex-col flex-wrap gap-3 md:flex-row">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="input-field md:max-w-md"
            placeholder="Buscar loja, shopping ou código de máquina..."
          />
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="select-field md:max-w-[12rem]"
          >
            <option value="todos">Lojas e avulsas</option>
            <option value="LOJA">🏪 Só lojas</option>
            <option value="AVULSA">🎮 Só máquinas avulsas{totais.avulsas ? ` (${totais.avulsas})` : ""}</option>
          </select>
          {shoppings.length > 0 && (
            <select
              value={filtroShopping}
              onChange={(e) => setFiltroShopping(e.target.value)}
              className="select-field md:max-w-xs"
            >
              <option value="todos">🏬 Todos os shoppings</option>
              {shoppings.map(([id, nome]) => (
                <option key={id} value={id}>
                  🏬 {nome}
                </option>
              ))}
              <option value="sem">Fora de shopping</option>
            </select>
          )}
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="select-field md:max-w-xs"
          >
            <option value="todos">Todos os status</option>
            <option value="Em operação">Em operação</option>
            <option value="Em implantação">Em implantação</option>
            <option value="Com pendência">Com pendência</option>
            <option value="Sem movimentação">Sem movimentação</option>
            <option value="Pausada">Pausada</option>
          </select>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {lojasFiltradas.map((item) => {
            const pontosAtencao = montarPontosAtencao(item);
            const precisaAtencao = pontosAtencao.length > 0;

            return (
            <article
              key={item.loja.id}
              className={`rounded-lg border bg-white p-5 shadow-sm ${
                precisaAtencao ? "border-amber-300" : "border-emerald-200"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-900">
                    {item.loja.tipo === "AVULSA" ? "🎮 " : ""}
                    {item.loja.nome}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs">
                    {item.loja.tipo === "AVULSA" && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-800">Máquina avulsa</span>
                    )}
                    {item.loja.shopping && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">🏬 {item.loja.shopping.nome}</span>
                    )}
                    {item.loja.estoqueLojaId && (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-800">
                        📦 Usa o estoque de {nomesLojas[item.loja.estoqueLojaId] || "outra loja"}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {[item.loja.endereco, item.loja.cidade].filter(Boolean).join(" · ") || "Sem endereço"}
                    {item.loja.telefone ? ` · 📞 ${item.loja.telefone}` : ""}
                    {` · ficha ${reais(item.loja.valorFichaPadrao ?? 2.5)}`}
                  </p>
                  <p className="text-sm text-gray-500">
                    Última movimentação:{" "}
                    {formatarData(
                      item.ultimaMovimentacao?.dataMovimentacao ||
                        item.ultimaMovimentacao?.dataColeta ||
                        item.ultimaMovimentacao?.createdAt,
                    )}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full border px-4 py-2 text-sm font-bold ${item.status.className}`}
                >
                  {item.status.label}
                </span>
              </div>

              <div
                className={`mt-4 rounded-lg border p-4 ${
                  precisaAtencao
                    ? "border-amber-300 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <p
                  className={`text-sm font-black uppercase ${
                    precisaAtencao ? "text-amber-900" : "text-emerald-800"
                  }`}
                >
                  {precisaAtencao ? "Atenção agora" : item.loja.tipo === "AVULSA" ? "Máquina avulsa em ordem" : "Loja em ordem"}
                </p>
                {precisaAtencao ? (
                  <ul className="mt-2 space-y-1 text-sm font-semibold text-amber-900">
                    {pontosAtencao.map((ponto) => (
                      <li key={ponto}>• {ponto}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm font-semibold text-emerald-800">
                    Sem pendências críticas com os dados atuais.
                  </p>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">
                    {item.loja.tipo === "AVULSA" ? "Máquina" : "Máquinas nesta loja"}
                  </p>
                  <p className="text-2xl font-bold">
                    {item.loja.tipo === "AVULSA"
                      ? item.maquinas[0]?.codigo || "—"
                      : item.maquinas.length}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">
                    {item.loja.estoqueLojaId ? "Estoque (emprestado)" : "Estoque atual"}
                  </p>
                  <p className="text-2xl font-bold">{item.estoqueAtual}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">
                    Estoque mínimo
                  </p>
                  <p className="text-2xl font-bold">{item.estoqueMinimo}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">
                    Média de saída
                  </p>
                  <p className="text-2xl font-bold">
                    {item.mediaPelucias.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-500">
                    pelúcias por visita ({item.totalSairam} pelúcia
                    {item.totalSairam === 1 ? "" : "s"} em{" "}
                    {item.totalVisitas} visita
                    {item.totalVisitas === 1 ? "" : "s"})
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="font-bold text-gray-800">Total de pendências</p>
                  <p className="mt-1 text-gray-600">
                    {item.pendencias > 0
                      ? `${item.pendencias} ponto(s) precisam de atenção`
                      : "Sem pendências"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="font-bold text-gray-800">Manutenções abertas</p>
                  <p className="mt-1 text-gray-600">
                    {item.manutencoesAbertas.length}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="font-bold text-gray-800">
                    Extintor{item.totalExtintores > 1 ? "es" : ""}
                  </p>
                  <p className="mt-1 text-gray-600">
                    {item.dataExtintor
                      ? `${formatarData(item.dataExtintor)}${
                          item.totalExtintores > 1
                            ? ` (+${item.totalExtintores - 1})`
                            : ""
                        }${item.diasExtintor <= 30 ? " · atenção" : ""}`
                      : "Sem cadastro"}
                  </p>
                </div>
                <div
                  className={`rounded-lg border p-3 ${
                    item.contratoAlerta
                      ? "border-red-300 animate-blink-alert"
                      : "border-slate-200"
                  }`}
                >
                  <p
                    className={`font-bold ${
                      item.contratoAlerta ? "text-white" : "text-gray-800"
                    }`}
                  >
                    Contrato
                  </p>
                  <p
                    className={`mt-1 ${
                      item.contratoAlerta ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {item.dataContrato
                      ? `${formatarData(item.dataContrato)}${
                          item.contratoAlerta ? " · atenção" : ""
                        }`
                      : "Sem cadastro"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="font-bold text-gray-800">Pelúcias</p>
                  {item.alertasJogadas.length > 0 ? (
                    <div className="mt-1 space-y-1">
                      {item.alertasJogadas.map((alerta) => (
                        <p
                          key={alerta.maquinaId}
                          className="text-red-600 font-medium"
                        >
                          ⚠️ {alerta.maquinaNome}:{" "}
                          {alerta.abaixoDaMeta
                            ? "saindo rápido demais"
                            : "saindo devagar demais"}{" "}
                          ({alerta.jogadasPorPelucia} jogada
                          {alerta.jogadasPorPelucia === 1 ? "" : "s"}/pelúcia,
                          esperado {alerta.jogadasEsperadas})
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-gray-600">
                      {item.temMetaConfigurada
                        ? "Dentro da meta configurada"
                        : "Sem meta de jogadas configurada"}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Última saída: {item.ultimaSaida} pelúcia
                    {item.ultimaSaida === 1 ? "" : "s"} · Média:{" "}
                    {item.mediaPelucias.toFixed(1)} por visita
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    🎮 {item.totalFichas} ficha
                    {item.totalFichas === 1 ? "" : "s"} jogada
                    {item.totalFichas === 1 ? "" : "s"} nas últimas{" "}
                    {item.totalVisitas} visita
                    {item.totalVisitas === 1 ? "" : "s"}
                    {item.mediaFichasPorPelucia > 0 &&
                      ` · ${item.mediaFichasPorPelucia.toFixed(1)} fichas por pelúcia`}
                  </p>
                  <p className="mt-2 text-[11px] italic text-gray-400">
                    Meta: comparação entre jogadas por pelúcia real (contador
                    IN da máquina) e a meta cadastrada, com tolerância de ±
                    {TOLERANCIA_JOGADAS} jogadas. Abaixo: "Média de saída" é a
                    média histórica de pelúcias por visita (últimas 50
                    coletas), só informativa.
                  </p>
                </div>
              </div>

              {item.itensAbaixoMinimo.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-bold text-amber-900">
                    Estoque abaixo do mínimo
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.itensAbaixoMinimo.slice(0, 4).map((estoque) => (
                      <span
                        key={`${item.loja.id}-${estoque.produtoId}`}
                        className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800"
                      >
                        {estoque.produto?.emoji || "•"} {estoque.produto?.nome || "Produto"}:{" "}
                        {estoque.quantidade}/{estoque.estoqueMinimo || estoque.produto?.estoqueMinimo || 0}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/lojas/${item.loja.id}`)}
                  className="btn-secondary text-sm"
                >
                  {item.loja.tipo === "AVULSA" ? "Abrir" : "Abrir loja"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/movimentacoes?lojaId=${item.loja.id}`)}
                  className="btn-secondary text-sm"
                >
                  Movimentações
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/manutencao")}
                  className="btn-secondary text-sm"
                >
                  Manutenções
                </button>
                {podeEditarLoja && (
                  <button
                    type="button"
                    onClick={() => navigate(`/lojas/${item.loja.id}/editar`)}
                    className="btn-secondary text-sm"
                  >
                    ✏️ Editar
                  </button>
                )}
                {podeExcluirLoja && (
                  <button
                    type="button"
                    onClick={() => excluirLoja(item.loja)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    {item.loja.ativo === false ? "Excluir de vez" : "Desativar"}
                  </button>
                )}
              </div>
            </article>
            );
          })}
        </section>

        {lojasFiltradas.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-gray-600">
            Nenhuma loja encontrada.
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
