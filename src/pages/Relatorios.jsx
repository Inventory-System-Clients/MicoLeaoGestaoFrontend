import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { RelatorioTodasLojas } from "../components/RelatorioTodasLojas";
import Swal from "sweetalert2";

const TODAS_LOJAS_VALUE = "__TODAS_AS_LOJAS__";

export function Relatorios() {
  const location = useLocation();
  const [dashboard, setDashboard] = useState(null);
  const [lojas, setLojas] = useState([]);
  const [usuariosMap, setUsuariosMap] = useState({});
  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [mesReferencia, setMesReferencia] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLojas, setLoadingLojas] = useState(true);
  const [relatorio, setRelatorio] = useState(null);
  const [error, setError] = useState("");
  const [gastosFixosLoja, setGastosFixosLoja] = useState([]);
  const [comparativoMensal, setComparativoMensal] = useState(null);
  const [salvandoFechamento, setSalvandoFechamento] = useState(false);
  const [relatorioAssistentePendente, setRelatorioAssistentePendente] =
    useState(null);

  // Buscar dados do dashboard para fichas corretas
  const carregarDashboard = async (lojaId, dataInicio, dataFim) => {
    try {
      const response = await api.get("/relatorios/dashboard", {
        params: {
          lojaId,
          dataInicio,
          dataFim,
        },
      });
      setDashboard(response.data);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      setDashboard(null);
    }
  };

  useEffect(() => {
    carregarLojas();
    carregarUsuarios();
    definirDatasDefault();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const state = location.state || {};
    const filtrosAssistente = {
      lojaId:
        state.lojaId ||
        state.assistenteRelatorio?.lojaId ||
        state.assistenteRelatorio?.loja_id ||
        state.assistenteRelatorio?.loja ||
        params.get("lojaId") ||
        params.get("loja_id") ||
        params.get("loja"),
      dataInicio:
        state.dataInicio ||
        state.assistenteRelatorio?.dataInicio ||
        state.assistenteRelatorio?.data_inicio ||
        params.get("dataInicio") ||
        params.get("data_inicio"),
      dataFim:
        state.dataFim ||
        state.assistenteRelatorio?.dataFim ||
        state.assistenteRelatorio?.data_fim ||
        params.get("dataFim") ||
        params.get("data_fim"),
    };

    if (
      !state.autoGerar &&
      !state.gerarAutomaticamente &&
      !params.has("lojaId") &&
      !params.has("loja_id")
    ) {
      return;
    }

    if (
      !filtrosAssistente.lojaId ||
      !filtrosAssistente.dataInicio ||
      !filtrosAssistente.dataFim
    ) {
      return;
    }

    queueMicrotask(() => {
      setLojaSelecionada(String(filtrosAssistente.lojaId));
      setDataInicio(filtrosAssistente.dataInicio);
      setDataFim(filtrosAssistente.dataFim);
      setMesReferencia(
        obterMesCompletoDoPeriodo(
          filtrosAssistente.dataInicio,
          filtrosAssistente.dataFim,
        ),
      );
      setRelatorioAssistentePendente({
        lojaId: String(filtrosAssistente.lojaId),
        dataInicio: filtrosAssistente.dataInicio,
        dataFim: filtrosAssistente.dataFim,
      });
    });
  }, [location.search, location.state]);

  const definirDatasDefault = () => {
    const mesAtual = formatarMesInput(new Date());
    const periodoPadrao = obterPeriodoDoMes(mesAtual);

    setMesReferencia(mesAtual);
    setDataInicio(periodoPadrao?.dataInicio || "");
    setDataFim(periodoPadrao?.dataFim || "");
  };

  const carregarLojas = async () => {
    try {
      setLoadingLojas(true);
      const response = await api.get("/lojas");
      setLojas(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar lojas:", error);
      setError("Erro ao carregar lojas");
    } finally {
      setLoadingLojas(false);
    }
  };

  const carregarUsuarios = async () => {
    try {
      const response = await api.get("/usuarios");
      const lista = Array.isArray(response.data) ? response.data : [];
      const mapa = lista.reduce((acc, usuario) => {
        if (usuario?.id !== undefined && usuario?.id !== null) {
          acc[String(usuario.id)] = usuario.nome || usuario.name || "-";
        }
        return acc;
      }, {});
      setUsuariosMap(mapa);
    } catch (error) {
      console.warn(
        "Não foi possível carregar usuários para detalhar sangrias no relatório:",
        error,
      );
      setUsuariosMap({});
    }
  };

  const formatarDataISO = (data) => {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  };

  const formatarMesInput = (data) => {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    return `${ano}-${mes}`;
  };

  const obterPeriodoDoMes = (mesTexto) => {
    if (!mesTexto) return null;

    const [anoTexto, mesNumeroTexto] = String(mesTexto).split("-");
    const ano = Number(anoTexto);
    const mes = Number(mesNumeroTexto);

    if (
      !Number.isInteger(ano) ||
      !Number.isInteger(mes) ||
      mes < 1 ||
      mes > 12
    ) {
      return null;
    }

    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0);

    return {
      dataInicio: formatarDataISO(inicio),
      dataFim: formatarDataISO(fim),
    };
  };

  const obterMesCompletoDoPeriodo = (inicioTexto, fimTexto) => {
    if (!inicioTexto || !fimTexto) return "";

    const inicio = new Date(`${inicioTexto}T00:00:00`);
    const fim = new Date(`${fimTexto}T00:00:00`);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      return "";
    }

    if (
      inicio.getFullYear() !== fim.getFullYear() ||
      inicio.getMonth() !== fim.getMonth()
    ) {
      return "";
    }

    const ultimoDiaDoMes = new Date(
      inicio.getFullYear(),
      inicio.getMonth() + 1,
      0,
    ).getDate();

    if (inicio.getDate() !== 1 || fim.getDate() !== ultimoDiaDoMes) {
      return "";
    }

    return formatarMesInput(inicio);
  };

  const handleMesReferenciaChange = (valorMes) => {
    setMesReferencia(valorMes);

    const periodo = obterPeriodoDoMes(valorMes);
    setDataInicio(periodo?.dataInicio || "");
    setDataFim(periodo?.dataFim || "");
  };

  const handleDataInicioChange = (valor) => {
    setDataInicio(valor);
    setMesReferencia(obterMesCompletoDoPeriodo(valor, dataFim));
  };

  const handleDataFimChange = (valor) => {
    setDataFim(valor);
    setMesReferencia(obterMesCompletoDoPeriodo(dataInicio, valor));
  };

  const obterMesmoDiaNoMesAnterior = (dataTexto) => {
    const dataBase = new Date(`${dataTexto}T00:00:00`);
    if (Number.isNaN(dataBase.getTime())) return dataTexto;

    const ano = dataBase.getFullYear();
    const mes = dataBase.getMonth();
    const dia = dataBase.getDate();
    const ultimoDiaMesAnterior = new Date(ano, mes, 0).getDate();
    const diaAjustado = Math.min(dia, ultimoDiaMesAnterior);

    return formatarDataISO(new Date(ano, mes - 1, diaAjustado));
  };

  const toNumber = (valor) => Number(valor || 0);

  const obterValorFichaPadraoDaLojaSelecionada = () => {
    const lojaAtual = lojas.find(
      (loja) => String(loja.id) === String(lojaSelecionada),
    );

    const valorFicha = Number(lojaAtual?.valorFichaPadrao);
    return Number.isFinite(valorFicha) && valorFicha > 0 ? valorFicha : 2.5;
  };

  const calcularValorFichasConsolidadoTodasLojas = (dadosRelatorio) => {
    const valorDireto = Number(
      dadosRelatorio?.totais?.valorFichasTotal ??
        dadosRelatorio?.totais?.valorFichas,
    );

    if (Number.isFinite(valorDireto) && valorDireto > 0) {
      return valorDireto;
    }

    if (Array.isArray(dadosRelatorio?.lojas) && dadosRelatorio.lojas.length) {
      return dadosRelatorio.lojas.reduce((acc, loja) => {
        const fichas = toNumber(loja?.totais?.fichas ?? loja?.fichasTotal);
        const valorFicha = Number(
          loja?.valorFichaPadrao ?? loja?.loja?.valorFichaPadrao,
        );
        const valorValido =
          Number.isFinite(valorFicha) && valorFicha > 0 ? valorFicha : 2.5;
        return acc + fichas * valorValido;
      }, 0);
    }

    return toNumber(dadosRelatorio?.totais?.fichasTotal) * 2.5;
  };

  const calcularValorFichasRelatorio = (dadosRelatorio) => {
    const totalFichas = toNumber(dadosRelatorio?.totais?.fichas);
    const valorFicha = toNumber(
      dadosRelatorio?.loja?.valorFichaPadrao ??
        obterValorFichaPadraoDaLojaSelecionada(),
    );
    return totalFichas * valorFicha;
  };

  const calcularValorConsolidadoRelatorio = (dadosRelatorio) => {
    if (
      dadosRelatorio?.totais?.valorBrutoConsolidadoLojaMaquinas !== undefined &&
      dadosRelatorio?.totais?.valorBrutoConsolidadoLojaMaquinas !== null
    ) {
      return toNumber(dadosRelatorio.totais.valorBrutoConsolidadoLojaMaquinas);
    }

    const valorTrocadora =
      toNumber(dadosRelatorio?.totais?.valorDinheiroLoja) +
      toNumber(dadosRelatorio?.totais?.valorCartaoPixLoja);

    const valorBrutoMaquinas = Array.isArray(dadosRelatorio?.maquinas)
      ? dadosRelatorio.maquinas.reduce(
          (acc, maquina) =>
            acc +
            toNumber(maquina?.totais?.dinheiro) +
            toNumber(maquina?.totais?.cartaoPix),
          0,
        )
      : 0;

    return valorTrocadora + valorBrutoMaquinas;
  };

  const calcularLucroLiquidoRelatorio = (dadosRelatorio) => {
    if (
      dadosRelatorio?.totais?.valorLiquidoConsolidadoLojaMaquinas !==
        undefined &&
      dadosRelatorio?.totais?.valorLiquidoConsolidadoLojaMaquinas !== null
    ) {
      return toNumber(
        dadosRelatorio.totais.valorLiquidoConsolidadoLojaMaquinas,
      );
    }

    const valorTrocadoraLiquido =
      toNumber(dadosRelatorio?.totais?.valorDinheiroLoja) +
      toNumber(dadosRelatorio?.totais?.valorCartaoPixLiquidoLoja);

    const valorLiquidoMaquinas = Array.isArray(dadosRelatorio?.maquinas)
      ? dadosRelatorio.maquinas.reduce(
          (acc, maquina) =>
            acc +
            toNumber(maquina?.totais?.dinheiro) +
            toNumber(maquina?.totais?.cartaoPixLiquido),
          0,
        )
      : 0;

    const gastoTotal = toNumber(dadosRelatorio?.totais?.gastoTotalPeriodo);
    return valorTrocadoraLiquido + valorLiquidoMaquinas - gastoTotal;
  };

  const calcularCustoSaidaProdutosRelatorio = (dadosRelatorio) => {
    if (
      Array.isArray(dadosRelatorio?.maquinas) &&
      dadosRelatorio.maquinas.length
    ) {
      return dadosRelatorio.maquinas.reduce(
        (acc, maquina) => acc + toNumber(maquina?.totais?.custoProdutosSairam),
        0,
      );
    }

    return toNumber(dadosRelatorio?.totais?.gastoProdutosTotalPeriodo);
  };

  const normalizarTextoBusca = (valor) =>
    String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const criarIndiceProdutosPorPreco = (produtos = []) => {
    const indice = {};

    produtos.forEach((produto) => {
      [
        produto?.id,
        produto?.produtoId,
        produto?.produto_id,
        produto?.codigo,
        produto?.nome,
      ].forEach((chave) => {
        const chaveNormalizada = normalizarTextoBusca(chave);
        if (chaveNormalizada) indice[chaveNormalizada] = produto;
      });
    });

    return indice;
  };

  const buscarProdutoCadastrado = (produtoRelatorio, indiceProdutos) => {
    const chaves = [
      produtoRelatorio?.id,
      produtoRelatorio?.produtoId,
      produtoRelatorio?.produto_id,
      produtoRelatorio?.idProduto,
      produtoRelatorio?.codigo,
      produtoRelatorio?.nome,
    ];

    for (const chave of chaves) {
      const produto = indiceProdutos[normalizarTextoBusca(chave)];
      if (produto) return produto;
    }

    return null;
  };

  const completarPrecoProdutosRelatorio = (dadosRelatorio, produtos = []) => {
    const indiceProdutos = criarIndiceProdutosPorPreco(produtos);

    if (!Array.isArray(dadosRelatorio?.maquinas)) {
      return dadosRelatorio;
    }

    const maquinas = dadosRelatorio.maquinas.map((maquina) => {
      if (!Array.isArray(maquina?.produtosSairam)) return maquina;

      const produtosSairam = maquina.produtosSairam.map((produto) => {
        const produtoCadastrado = buscarProdutoCadastrado(
          produto,
          indiceProdutos,
        );
        const precoCadastrado = toNumber(produtoCadastrado?.preco);
        const custoUnitarioRelatorio = toNumber(produto.custoUnitario);
        const custoUnitario =
          custoUnitarioRelatorio > 0
            ? custoUnitarioRelatorio
            : precoCadastrado;
        const quantidade = toNumber(produto.quantidade);
        const custoTotalRelatorio = toNumber(produto.custoTotal);
        const custoTotal =
          custoTotalRelatorio > 0
            ? custoTotalRelatorio
            : custoUnitario * quantidade;

        return {
          ...produto,
          custoUnitario,
          custoTotal,
        };
      });

      return {
        ...maquina,
        produtosSairam,
        totais: {
          ...(maquina?.totais || {}),
          custoProdutosSairam: produtosSairam.reduce(
            (acc, produto) => acc + toNumber(produto.custoTotal),
            0,
          ),
        },
      };
    });

    const custoProdutosTotal = maquinas.reduce(
      (acc, maquina) => acc + toNumber(maquina?.totais?.custoProdutosSairam),
      0,
    );

    return {
      ...dadosRelatorio,
      maquinas,
      totais: {
        ...(dadosRelatorio?.totais || {}),
        custoProdutosTotal,
        gastoProdutosTotalPeriodo: custoProdutosTotal,
      },
    };
  };

  const montarIndicadorComparacao = (
    valorAtual,
    valorAnterior,
    melhorQuando = "maior",
  ) => {
    const atual = toNumber(valorAtual);
    const anterior = toNumber(valorAnterior);
    const diferenca = atual - anterior;

    let percentual = 0;
    if (Math.abs(anterior) > 0.0001) {
      percentual = (diferenca / Math.abs(anterior)) * 100;
    } else if (Math.abs(atual) > 0.0001) {
      percentual = 100;
    }

    const direcao =
      diferenca > 0.0001 ? "acima" : diferenca < -0.0001 ? "abaixo" : "igual";

    let status = "igual";
    if (direcao !== "igual") {
      if (melhorQuando === "menor") {
        status = diferenca < 0 ? "melhor" : "pior";
      } else {
        status = diferenca > 0 ? "melhor" : "pior";
      }
    }

    return {
      atual,
      anterior,
      diferenca,
      percentual,
      direcao,
      status,
    };
  };

  const formatarMoeda = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatarPercentualComparacao = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatarDataExibicao = (dataTexto) => {
    const [ano, mes, dia] = String(dataTexto || "").split("-");
    if (!ano || !mes || !dia) return dataTexto || "-";
    return `${dia}/${mes}/${ano}`;
  };

  const formatarDataHoraExibicao = (dataTexto) => {
    if (!dataTexto) return "-";
    const data = new Date(dataTexto);
    if (Number.isNaN(data.getTime())) return String(dataTexto);
    return data.toLocaleString("pt-BR");
  };

  const validarPeriodoFechamentoMensal = () => {
    if (!dataInicio || !dataFim) {
      return { valido: false, motivo: "Selecione data inicial e final." };
    }

    const inicio = new Date(`${dataInicio}T00:00:00`);
    const fim = new Date(`${dataFim}T00:00:00`);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      return { valido: false, motivo: "Período inválido." };
    }

    if (
      inicio.getFullYear() !== fim.getFullYear() ||
      inicio.getMonth() !== fim.getMonth()
    ) {
      return {
        valido: false,
        motivo: "O fechamento precisa estar dentro do mesmo mês.",
      };
    }

    const ultimoDiaDoMes = new Date(
      inicio.getFullYear(),
      inicio.getMonth() + 1,
      0,
    ).getDate();

    if (inicio.getDate() !== 1 || fim.getDate() !== ultimoDiaDoMes) {
      return {
        valido: false,
        motivo:
          "O fechamento só pode ser feito com período completo: dia 1 até o último dia do mês.",
      };
    }

    const fimDoPeriodo = new Date(
      fim.getFullYear(),
      fim.getMonth(),
      fim.getDate(),
      23,
      59,
      59,
      999,
    );

    if (new Date().getTime() <= fimDoPeriodo.getTime()) {
      return {
        valido: false,
        motivo:
          "O fechamento só pode ser feito após o término completo do período.",
      };
    }

    return { valido: true, motivo: "" };
  };

  const salvarFechamentoMensal = async () => {
    if (!relatorio || lojaSelecionada === TODAS_LOJAS_VALUE) {
      Swal.fire({
        icon: "warning",
        title: "Fechamento indisponível",
        text: "Selecione uma única loja para fechar o mês.",
      });
      return;
    }

    const validacao = validarPeriodoFechamentoMensal();
    if (!validacao.valido) {
      Swal.fire({
        icon: "warning",
        title: "Período inválido para fechamento",
        text: validacao.motivo,
      });
      return;
    }

    const confirmacao = await Swal.fire({
      icon: "question",
      title: "Confirmar fechamento mensal?",
      html: `Loja: <b>${relatorio?.loja?.nome || "-"}</b><br/>Período: <b>${formatarDataExibicao(dataInicio)} até ${formatarDataExibicao(dataFim)}</b>`,
      showCancelButton: true,
      confirmButtonText: "Sim, fechar mês",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
    });

    if (!confirmacao.isConfirmed) return;

    try {
      setSalvandoFechamento(true);

      await api.post("/fechamentos-mensais-relatorio", {
        lojaId: lojaSelecionada,
        dataInicio,
        dataFim,
        relatorio,
        gastosFixosDetalhados: gastosFixosComValor,
      });

      Swal.fire({
        icon: "success",
        title: "Fechamento salvo",
        text: "Os dados do fechamento mensal foram salvos com sucesso.",
        confirmButtonColor: "#16a34a",
      });
    } catch (erroFechamento) {
      Swal.fire({
        icon: "error",
        title: "Erro ao salvar fechamento",
        text:
          erroFechamento?.response?.data?.error ||
          "Não foi possível salvar o fechamento mensal.",
      });
    } finally {
      setSalvandoFechamento(false);
    }
  };

  const obterClassesStatusComparacao = (status) => {
    if (status === "melhor") {
      return {
        card: "bg-emerald-50 border-emerald-300",
        texto: "text-emerald-700",
        icone: "▲",
      };
    }

    if (status === "pior") {
      return {
        card: "bg-red-50 border-red-300",
        texto: "text-red-700",
        icone: "▼",
      };
    }

    return {
      card: "bg-slate-50 border-slate-300",
      texto: "text-slate-700",
      icone: "●",
    };
  };

  const gerarRelatorio = async () => {
    if (!lojaSelecionada || !dataInicio || !dataFim) {
      setError("Por favor, preencha loja, data inicial e data final");
      return;
    }

    // Validar período calculado a partir do mês selecionado
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    if (fim < inicio) {
      setError("A data final não pode ser anterior à data inicial");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setRelatorio(null); // Limpar relatório anterior
      setDashboard(null);
      setGastosFixosLoja([]);
      setComparativoMensal(null);

      if (lojaSelecionada === TODAS_LOJAS_VALUE) {
        const response = await api.get("/relatorios/todas-lojas", {
          params: {
            dataInicio,
            dataFim,
          },
        });

        let comparativoTodasLojas = null;
        try {
          const dataInicioMesAnterior = obterMesmoDiaNoMesAnterior(dataInicio);
          const dataFimMesAnterior = obterMesmoDiaNoMesAnterior(dataFim);

          const responseMesAnterior = await api.get("/relatorios/todas-lojas", {
            params: {
              dataInicio: dataInicioMesAnterior,
              dataFim: dataFimMesAnterior,
            },
          });

          const totaisAtual = response.data?.totais || {};
          const totaisAnterior = responseMesAnterior.data?.totais || {};

          const valorConsolidadoAtual =
            toNumber(totaisAtual.lucroBrutoTotal) ||
            toNumber(totaisAtual.dinheiroTotal) +
              toNumber(totaisAtual.cartaoPixTotal);
          const valorConsolidadoAnterior =
            toNumber(totaisAnterior.lucroBrutoTotal) ||
            toNumber(totaisAnterior.dinheiroTotal) +
              toNumber(totaisAnterior.cartaoPixTotal);

          comparativoTodasLojas = {
            periodoAtual: {
              inicio: dataInicio,
              fim: dataFim,
            },
            periodoAnterior: {
              inicio: dataInicioMesAnterior,
              fim: dataFimMesAnterior,
            },
            metricas: [
              {
                chave: "lucroLiquidoTotal",
                titulo: "Lucro Líquido Total",
                icone: "📉",
                indicador: montarIndicadorComparacao(
                  toNumber(totaisAtual.lucroLiquidoTotal),
                  toNumber(totaisAnterior.lucroLiquidoTotal),
                  "maior",
                ),
              },
              {
                chave: "valorFichasTotal",
                titulo: "Valor das Fichas (Estimado)",
                icone: "🎟️",
                observacao:
                  "Estimado com o valor da ficha de cada loja quando disponível.",
                indicador: montarIndicadorComparacao(
                  calcularValorFichasConsolidadoTodasLojas(response.data),
                  calcularValorFichasConsolidadoTodasLojas(
                    responseMesAnterior.data,
                  ),
                  "maior",
                ),
              },
              {
                chave: "valorConsolidado",
                titulo: "Valor Consolidado",
                icone: "💰",
                indicador: montarIndicadorComparacao(
                  valorConsolidadoAtual,
                  valorConsolidadoAnterior,
                  "maior",
                ),
              },
              {
                chave: "custoSaidaProdutos",
                titulo: "Custo de Saída dos Produtos",
                icone: "💸",
                indicador: montarIndicadorComparacao(
                  toNumber(totaisAtual.custoProdutosTotal),
                  toNumber(totaisAnterior.custoProdutosTotal),
                  "menor",
                ),
              },
            ],
          };
        } catch (erroComparativoTodasLojas) {
          console.warn(
            "Não foi possível gerar comparativo de todas as lojas com o mês passado:",
            erroComparativoTodasLojas,
          );
        }

        setRelatorio({
          ...response.data,
          comparativoMensal: comparativoTodasLojas,
        });
        setGastosFixosLoja([]);
        setComparativoMensal(null);

        return;
      }

      const intervaloSelecionadoInicio = new Date(`${dataInicio}T00:00:00`);
      const intervaloSelecionadoFim = new Date(`${dataFim}T23:59:59`);

      const parseDataSegura = (valor) => {
        if (!valor) return null;
        const data = new Date(valor);
        return Number.isNaN(data.getTime()) ? null : data;
      };

      const temIntersecaoPeriodo = (inicioA, fimA, inicioB, fimB) => {
        if (!inicioA || !fimA || !inicioB || !fimB) return false;
        return inicioA <= fimB && fimA >= inicioB;
      };

      // Buscar dashboard para fichas corretas
      await carregarDashboard(lojaSelecionada, dataInicio, dataFim);

      // Usar a rota correta para relatório detalhado (produtos que saíram/entraram)
      const response = await api.get("/relatorios/impressao", {
        params: {
          lojaId: lojaSelecionada,
          dataInicio,
          dataFim,
        },
      });

      let produtosCadastrados = [];
      try {
        const produtosResponse = await api.get("/produtos?incluirInativos=true");
        produtosCadastrados = Array.isArray(produtosResponse.data)
          ? produtosResponse.data
          : [];
      } catch (erroProdutos) {
        console.warn(
          "NÃ£o foi possÃ­vel buscar produtos cadastrados para completar preÃ§os no relatÃ³rio:",
          erroProdutos,
        );
      }

      let gastoTotalDoRegistrar = null;
      let observacaoDoRegistrar = "";
      try {
        const registrosResponse = await api.get("/registro-dinheiro");
        const registros = Array.isArray(registrosResponse.data)
          ? registrosResponse.data
          : [];

        const registrosFiltrados = registros.filter((registro) => {
          const lojaRegistro = String(
            registro.lojaId ?? registro.lojaid ?? registro.loja ?? "",
          );
          if (lojaRegistro !== String(lojaSelecionada)) return false;

          const inicioRegistro = parseDataSegura(
            registro.inicio ?? registro.dataInicio,
          );
          const fimRegistro = parseDataSegura(registro.fim ?? registro.dataFim);

          return temIntersecaoPeriodo(
            inicioRegistro,
            fimRegistro,
            intervaloSelecionadoInicio,
            intervaloSelecionadoFim,
          );
        });

        const registrosPreferidos = registrosFiltrados.filter(
          (registro) =>
            registro.registrarTotalLoja === true ||
            registro.registrar_total_loja === true,
        );

        const listaBase =
          registrosPreferidos.length > 0
            ? registrosPreferidos
            : registrosFiltrados;

        if (listaBase.length > 0) {
          const registroMaisRecente = [...listaBase].sort((a, b) => {
            const dataA =
              parseDataSegura(
                a.createdAt ?? a.created_at ?? a.updatedAt,
              )?.getTime() || 0;
            const dataB =
              parseDataSegura(
                b.createdAt ?? b.created_at ?? b.updatedAt,
              )?.getTime() || 0;
            return dataB - dataA;
          })[0];

          const valorRegistro = Number(
            registroMaisRecente.gastoTotalPeriodo ??
              registroMaisRecente.gasto_total_periodo ??
              0,
          );

          observacaoDoRegistrar = String(
            registroMaisRecente.observacao ??
              registroMaisRecente.observacoes ??
              registroMaisRecente.obs ??
              "",
          ).trim();

          if (!Number.isNaN(valorRegistro)) {
            gastoTotalDoRegistrar = valorRegistro;
          }
        }
      } catch (erroRegistro) {
        console.warn(
          "Não foi possível buscar gasto total do Registrar Dinheiro:",
          erroRegistro,
        );
      }

      const gastoTotalFinal =
        gastoTotalDoRegistrar ??
        Number(response.data?.totais?.gastoTotalPeriodo || 0);

      const relatorioAtualNormalizado = completarPrecoProdutosRelatorio(
        {
          ...response.data,
          observacaoRegistrar: observacaoDoRegistrar,
          totais: {
            ...(response.data?.totais || {}),
            gastoTotalPeriodo: gastoTotalFinal,
          },
        },
        produtosCadastrados,
      );

      let comparativoCalculado = null;
      try {
        const dataInicioMesAnterior = obterMesmoDiaNoMesAnterior(dataInicio);
        const dataFimMesAnterior = obterMesmoDiaNoMesAnterior(dataFim);

        const responseMesAnterior = await api.get("/relatorios/impressao", {
          params: {
            lojaId: lojaSelecionada,
            dataInicio: dataInicioMesAnterior,
            dataFim: dataFimMesAnterior,
          },
        });

        const relatorioMesAnterior = completarPrecoProdutosRelatorio(
          responseMesAnterior.data,
          produtosCadastrados,
        );

        if (relatorioMesAnterior) {
          const lucroLiquidoAtual = calcularLucroLiquidoRelatorio(
            relatorioAtualNormalizado,
          );
          const lucroLiquidoAnterior =
            calcularLucroLiquidoRelatorio(relatorioMesAnterior);

          const valorFichasAtual = calcularValorFichasRelatorio(
            relatorioAtualNormalizado,
          );
          const valorFichasAnterior =
            calcularValorFichasRelatorio(relatorioMesAnterior);

          const valorConsolidadoAtual = calcularValorConsolidadoRelatorio(
            relatorioAtualNormalizado,
          );
          const valorConsolidadoAnterior =
            calcularValorConsolidadoRelatorio(relatorioMesAnterior);

          const custoSaidaAtual = calcularCustoSaidaProdutosRelatorio(
            relatorioAtualNormalizado,
          );
          const custoSaidaAnterior =
            calcularCustoSaidaProdutosRelatorio(relatorioMesAnterior);

          comparativoCalculado = {
            periodoAtual: {
              inicio: dataInicio,
              fim: dataFim,
            },
            periodoAnterior: {
              inicio: dataInicioMesAnterior,
              fim: dataFimMesAnterior,
            },
            metricas: [
              {
                chave: "lucroLiquido",
                titulo: "Lucro Líquido",
                icone: "📉",
                indicador: montarIndicadorComparacao(
                  lucroLiquidoAtual,
                  lucroLiquidoAnterior,
                  "maior",
                ),
              },
              {
                chave: "valorFichas",
                titulo: "Valor das Fichas",
                icone: "🎟️",
                indicador: montarIndicadorComparacao(
                  valorFichasAtual,
                  valorFichasAnterior,
                  "maior",
                ),
              },
              {
                chave: "valorConsolidado",
                titulo: "Valor Consolidado",
                icone: "💰",
                indicador: montarIndicadorComparacao(
                  valorConsolidadoAtual,
                  valorConsolidadoAnterior,
                  "maior",
                ),
              },
              {
                chave: "custoSaidaProdutos",
                titulo: "Custo de Saída dos Produtos",
                icone: "💸",
                indicador: montarIndicadorComparacao(
                  custoSaidaAtual,
                  custoSaidaAnterior,
                  "menor",
                ),
              },
            ],
          };
        }
      } catch (erroComparativo) {
        console.warn(
          "Não foi possível gerar comparativo com o mês passado:",
          erroComparativo,
        );
      }

      let listaGastosFixos = [];
      try {
        const gastosFixosResponse = await api.get(
          `/gastos-fixos-loja/${lojaSelecionada}`,
        );
        listaGastosFixos = Array.isArray(gastosFixosResponse.data)
          ? gastosFixosResponse.data
          : [];
      } catch (erroGastosFixos) {
        console.warn(
          "Não foi possível buscar gastos fixos da loja para detalhamento:",
          erroGastosFixos,
        );
      }

      setGastosFixosLoja(listaGastosFixos);
      setComparativoMensal(comparativoCalculado);

      setRelatorio(relatorioAtualNormalizado);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      console.error("Detalhes do erro:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });

      let errorMessage = "Erro ao gerar relatório. Tente novamente.";

      if (error.response?.status === 404) {
        errorMessage =
          "⚠️ Endpoint não encontrado. O servidor pode estar atualizando. Aguarde alguns minutos e tente novamente.";
      } else if (error.response?.status === 500) {
        errorMessage = `⚠️ Erro no servidor: ${
          error.response?.data?.error || "Erro interno no servidor"
        }. Verifique se a loja existe e se há dados para o período selecionado.`;
      } else if (error.response?.status === 400) {
        errorMessage = `⚠️ Requisição inválida: ${
          error.response?.data?.error || "Verifique os campos preenchidos"
        }`;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message === "Network Error") {
        errorMessage = "⚠️ Erro de conexão. Verifique sua internet.";
      }

      setError(errorMessage);
      setRelatorio(null);
      setDashboard(null);
      setGastosFixosLoja([]);
      setComparativoMensal(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!relatorioAssistentePendente || loadingLojas || loading) {
      return;
    }

    const filtrosAplicados =
      String(lojaSelecionada) === String(relatorioAssistentePendente.lojaId) &&
      dataInicio === relatorioAssistentePendente.dataInicio &&
      dataFim === relatorioAssistentePendente.dataFim;

    if (!filtrosAplicados) {
      return;
    }

    queueMicrotask(() => {
      setRelatorioAssistentePendente(null);
      gerarRelatorio();
    });
  }, [
    relatorioAssistentePendente,
    loadingLojas,
    loading,
    lojaSelecionada,
    dataInicio,
    dataFim,
  ]);

  const handleImprimir = () => {
    window.print();
  };

  const gastosFixosComValor = gastosFixosLoja
    .map((item) => ({
      id: item.id,
      nome: String(item.nome || "").trim(),
      valor: Number(item.valor || 0),
    }))
    .filter((item) => item.nome.length > 0 && item.valor > 0);

  const totalGastosFixosDaLoja = gastosFixosComValor.reduce(
    (acc, item) => acc + item.valor,
    0,
  );

  const sangriaRelatorio = relatorio?.sangria || {};
  const valorSangriaTotalPeriodo = Number(
    relatorio?.totais?.valorSangriaTotalPeriodo ??
      sangriaRelatorio.totalPeriodo ??
      0,
  );
  const quantidadeRegistrosSangria = Number(
    relatorio?.totais?.quantidadeRegistrosSangria ??
      sangriaRelatorio.quantidadeRegistros ??
      0,
  );
  const registrosSangria = Array.isArray(sangriaRelatorio.registros)
    ? sangriaRelatorio.registros
    : [];

  const obterNomeUsuarioSangria = (registro) => {
    const nomeDireto =
      registro?.usuarioNome ||
      registro?.nomeUsuario ||
      registro?.usuario?.nome ||
      registro?.responsavel?.nome ||
      registro?.createdByNome;

    if (nomeDireto) return nomeDireto;

    const usuarioId =
      registro?.usuarioId ??
      registro?.usuario_id ??
      registro?.userId ??
      registro?.createdBy;

    if (usuarioId === undefined || usuarioId === null) return "-";

    return usuariosMap[String(usuarioId)] || `ID ${usuarioId}`;
  };

  const fechamentoValido = validarPeriodoFechamentoMensal();

  if (loadingLojas) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="📄 Relatório de Impressão"
          subtitle="Gere relatórios detalhados de movimentações por loja"
          icon="📊"
        />

        {/* Formulário de Filtros */}
        <div className="card mb-6 no-print">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🏪 Loja *
              </label>
              <select
                value={lojaSelecionada}
                onChange={(e) => setLojaSelecionada(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Selecione uma loja</option>
                <option value={TODAS_LOJAS_VALUE}>Todas as lojas</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Mês
              </label>
              <input
                type="month"
                value={mesReferencia}
                onChange={(e) => handleMesReferenciaChange(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Inicial *
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => handleDataInicioChange(e.target.value)}
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Data Final *
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => handleDataFimChange(e.target.value)}
                className="input-field w-full"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">⚠️ {error}</p>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={gerarRelatorio}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "⏳ Gerando..." : "📊 Gerar Relatório"}
            </button>
            <button
              onClick={handleImprimir}
              disabled={!relatorio}
              className="btn-secondary"
            >
              🖨️ Imprimir
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-gray-600 mt-4">Gerando relatório...</p>
          </div>
        )}

        {/* Relatório */}
        {relatorio && !loading && relatorio.tipo === "todas-lojas" && (
          <RelatorioTodasLojas relatorio={relatorio} />
        )}

        {relatorio && !loading && relatorio.tipo !== "todas-lojas" && (
          <div className="space-y-6">
            {relatorio.observacaoRegistrar && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Observação do Registrar Dinheiro:</strong>{" "}
                  {relatorio.observacaoRegistrar}
                </p>
              </div>
            )}
            {/* Aviso de diferença de fichas */}
            {relatorio.avisoFichas && (
              <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 rounded mb-4">
                <strong>Aviso:</strong> {relatorio.avisoFichas}
              </div>
            )}
            {/* Cards de Totais Gerais */}
            <div className="card bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-purple-300">
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">📊</span>
                Resumo Geral da Loja
              </h3>
              <div className="flex flex-wrap gap-4 sm:gap-4">
                {/* Quantidade de Fichas (DASHBOARD) */}
                {/* Valor das Fichas (Dashboard) */}
                <div className="card bg-gradient-to-br from-blue-400 to-blue-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🎟️</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {dashboard && dashboard.totais
                      ? Number(dashboard.totais.fichas || 0).toLocaleString(
                          "pt-BR",
                        )
                      : "-"}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Quantidade de Fichas
                  </div>
                  <div className="text-2xl sm:text-3xl mb-2">💸</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    ${" "}
                    {(() => {
                      const totalFichas = relatorio.totais?.fichas || 0;
                      const valorFicha = toNumber(
                        relatorio.loja?.valorFichaPadrao ??
                          obterValorFichaPadraoDaLojaSelecionada(),
                      );
                      return (totalFichas * valorFicha).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      );
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Valor das Fichas (Dashboard)
                  </div>
                </div>

                {/* Valor Vindo da Trocadora */}
                {/* Dinheiro loja */}
                {/* Cartão/Pix loja */}
                <div className="flex flex-col card bg-gradient-to-br from-yellow-500 to-orange-600 text-white items-center justify-center">
                  <div className="text-2xl sm:text-3xl mb-2">🏪</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(
                      Number(relatorio.totais?.valorDinheiroLoja || 0) +
                      Number(relatorio.totais?.valorCartaoPixLoja || 0)
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Valor Vindo da Trocadora
                  </div>
                  <div className="flex gap-3 items-end">
                    <div className="flex flex-col items-center">
                      <div className="text-lg sm:text-xl mb-1">💵</div>
                      <div className="text-base sm:text-lg font-bold">
                        R${" "}
                        {Number(
                          relatorio.totais?.valorDinheiroLoja || 0,
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] sm:text-xs opacity-80">
                        Dinheiro
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <div className="text-lg sm:text-xl mb-1">🟢</div>
                      <div className="text-base sm:text-lg font-bold">
                        R${" "}
                        {Number(
                          relatorio.totais?.valorCartaoPixLoja || 0,
                        ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] sm:text-xs opacity-80">
                        Cartão / Pix (Bruto)
                      </div>
                    </div>
                  </div>
                </div>
                {/* Valor Bruto das máquinas */}
                <div className="card bg-gradient-to-br from-yellow-300 to-yellow-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">📉</div>
                  {(() => {
                    const dinheiroDireto =
                      relatorio.totais?.valorDinheiroMaquinas;
                    const cartaoDireto =
                      relatorio.totais?.valorCartaoPixMaquinasBruto;

                    const dinheiroMaquinas =
                      dinheiroDireto !== undefined && dinheiroDireto !== null
                        ? Number(dinheiroDireto || 0)
                        : Array.isArray(relatorio.maquinas)
                          ? relatorio.maquinas.reduce(
                              (acc, m) => acc + Number(m.totais?.dinheiro || 0),
                              0,
                            )
                          : 0;

                    const cartaoPixMaquinas =
                      cartaoDireto !== undefined && cartaoDireto !== null
                        ? Number(cartaoDireto || 0)
                        : Array.isArray(relatorio.maquinas)
                          ? relatorio.maquinas.reduce(
                              (acc, m) =>
                                acc + Number(m.totais?.cartaoPix || 0),
                              0,
                            )
                          : 0;

                    const valorBrutoMaquinas =
                      relatorio.totais?.valorBrutoMaquinas !== undefined &&
                      relatorio.totais?.valorBrutoMaquinas !== null
                        ? Number(relatorio.totais?.valorBrutoMaquinas || 0)
                        : dinheiroMaquinas + cartaoPixMaquinas;

                    return (
                      <>
                        <div className="text-xl sm:text-2xl font-bold">
                          R${" "}
                          {valorBrutoMaquinas.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div className="text-xs sm:text-sm opacity-90">
                          Valor bruto das máquinas
                        </div>
                        <div className="flex gap-3 items-end mt-2">
                          <div className="flex flex-col items-center">
                            <div className="text-lg sm:text-xl mb-1">💵</div>
                            <div className="text-base sm:text-lg font-bold">
                              R${" "}
                              {dinheiroMaquinas.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-[10px] sm:text-xs opacity-80">
                              Dinheiro
                            </div>
                          </div>
                          <div className="flex flex-col items-center">
                            <div className="text-lg sm:text-xl mb-1">🟢</div>
                            <div className="text-base sm:text-lg font-bold">
                              R${" "}
                              {cartaoPixMaquinas.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                            <div className="text-[10px] sm:text-xs opacity-80">
                              Cartão / Pix (Bruto)
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                {/*Total vendas da Loja */}
                <div className="card bg-gradient-to-br from-yellow-500 to-orange-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">💰</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(() => {
                      if (
                        relatorio.totais?.valorBrutoConsolidadoLojaMaquinas !==
                          undefined &&
                        relatorio.totais?.valorBrutoConsolidadoLojaMaquinas !==
                          null
                      ) {
                        return Number(
                          relatorio.totais?.valorBrutoConsolidadoLojaMaquinas ||
                            0,
                        ).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        });
                      }

                      const valorTrocadora =
                        Number(relatorio.totais?.valorDinheiroLoja || 0) +
                        Number(relatorio.totais?.valorCartaoPixLoja || 0);
                      let dinheiroMaquinas = 0;
                      let cartaoPixMaquinasBruto = 0;
                      if (relatorio.maquinas && relatorio.maquinas.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          dinheiroMaquinas += Number(m.totais?.dinheiro || 0);
                          cartaoPixMaquinasBruto += Number(
                            m.totais?.cartaoPix || 0,
                          );
                        });
                      }
                      const brutoMaquinas =
                        dinheiroMaquinas + cartaoPixMaquinasBruto;
                      return (valorTrocadora + brutoMaquinas).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 },
                      );
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Bruto Consolidado (Loja + Máquinas)
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-pink-500 to-fuchsia-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">💳</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {Number(
                      relatorio.totais?.percentualTaxaCartaoMedia || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    %
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Taxa Média de Cartão
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                    R${" "}
                    {Number(relatorio.totais?.taxaDeCartao || 0).toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2 },
                    )}{" "}
                    em taxas de cartão no período
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-cyan-500 to-blue-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">✅</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(
                      relatorio.totais?.valorCartaoPixLiquidoLoja || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Cartão / Pix Líquido (Loja)
                  </div>
                  <div className="text-xl sm:text-2xl font-bold mt-4">
                    R${" "}
                    {(() => {
                      if (
                        relatorio.totais?.valorLiquidoMaquinas !== undefined &&
                        relatorio.totais?.valorLiquidoMaquinas !== null
                      ) {
                        return Number(
                          relatorio.totais?.valorLiquidoMaquinas || 0,
                        ).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        });
                      }

                      let valorLiquidoMaquinas = 0;
                      if (relatorio.maquinas && relatorio.maquinas.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          valorLiquidoMaquinas +=
                            Number(m.totais?.dinheiro || 0) +
                            Number(m.totais?.cartaoPixLiquido || 0);
                        });
                      }
                      return valorLiquidoMaquinas.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      });
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Cartão / Pix Líquido (Máquinas)
                  </div>
                </div>
                {/* Produtos que entraram */}
                <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">📥</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {(relatorio.totais?.produtosEntraram || 0).toLocaleString(
                      "pt-BR",
                    )}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Produtos Entraram
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-indigo-500 to-indigo-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🎯</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(
                      relatorio.totais?.ticketPorPremioTotal || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Ticket por Prêmio (Total)
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                    Fórmula: Faturamento Bruto ÷ Produtos Saíram
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                    {`R$ ${Number(
                      relatorio.totais?.valorTotalLojaBruto || 0,
                    ).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })} / ${(relatorio.totais?.produtosSairam || 0).toLocaleString("pt-BR")} saídas`}
                  </div>
                </div>

                {/* Custo total de produtos */}
                <div className="card bg-gradient-to-br from-yellow-100 to-yellow-400 text-yellow-900 border-yellow-400 border-2">
                  <div className="text-2xl sm:text-3xl mb-2">💸</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(() => {
                      let custoTotalProdutos = 0;
                      if (relatorio.maquinas && relatorio.maquinas.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          custoTotalProdutos += Number(
                            m.totais?.custoProdutosSairam || 0,
                          );
                        });
                      }
                      return custoTotalProdutos.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      });
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Custo total de produtos
                  </div>
                  <div className="text-2xl sm:text-3xl mb-2">📤</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    {(relatorio.totais?.produtosSairam || 0).toLocaleString(
                      "pt-BR",
                    )}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Produtos Saíram
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-fuchsia-500 to-purple-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🧾</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(
                      relatorio.totais?.gastoVariavelTotalPeriodo || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Gastos Variáveis
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-violet-500 to-purple-800 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🏷️</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(totalGastosFixosDaLoja || 0).toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2 },
                    )}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Gastos Fixos da Loja
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-2 space-y-1 max-h-24 overflow-y-auto pr-1">
                    {gastosFixosComValor.length > 0 ? (
                      gastosFixosComValor.map((gasto) => (
                        <div
                          key={`${gasto.id || gasto.nome}`}
                          className="truncate"
                        >
                          {gasto.nome}: R${" "}
                          {Number(gasto.valor || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      ))
                    ) : (
                      <div>Sem gastos fixos com valor maior que zero</div>
                    )}
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-rose-500 to-red-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">🧮</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {Number(
                      relatorio.totais?.gastoTotalPeriodo || 0,
                    ).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Gasto Total
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-emerald-600 to-green-800 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">📉</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {(() => {
                      if (
                        relatorio.totais
                          ?.valorLiquidoConsolidadoLojaMaquinas !== undefined &&
                        relatorio.totais
                          ?.valorLiquidoConsolidadoLojaMaquinas !== null
                      ) {
                        return Number(
                          relatorio.totais
                            ?.valorLiquidoConsolidadoLojaMaquinas || 0,
                        ).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        });
                      }

                      const valorTrocadoraLiquido =
                        Number(relatorio.totais?.valorDinheiroLoja || 0) +
                        Number(
                          relatorio.totais?.valorCartaoPixLiquidoLoja || 0,
                        );
                      let dinheiroMaquinas = 0;
                      let cartaoPixMaquinasLiquido = 0;
                      if (relatorio.maquinas && relatorio.maquinas.length > 0) {
                        relatorio.maquinas.forEach((m) => {
                          dinheiroMaquinas += Number(m.totais?.dinheiro || 0);
                          cartaoPixMaquinasLiquido += Number(
                            m.totais?.cartaoPixLiquido || 0,
                          );
                        });
                      }
                      const lucroMaquinas =
                        dinheiroMaquinas + cartaoPixMaquinasLiquido;
                      const receitaLiquida =
                        valorTrocadoraLiquido + lucroMaquinas;
                      const gastoTotal = Number(
                        relatorio.totais?.gastoTotalPeriodo || 0,
                      );
                      return (receitaLiquida - gastoTotal).toLocaleString(
                        "pt-BR",
                        {
                          minimumFractionDigits: 2,
                        },
                      );
                    })()}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Lucro Líquido
                  </div>
                </div>
                <div className="card bg-gradient-to-br from-red-500 to-rose-700 text-white">
                  <div className="text-2xl sm:text-3xl mb-2">💸</div>
                  <div className="text-xl sm:text-2xl font-bold">
                    R${" "}
                    {valorSangriaTotalPeriodo.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs sm:text-sm opacity-90">
                    Sangria (separada)
                  </div>
                  <div className="text-[10px] sm:text-xs opacity-80 mt-1">
                    Registros:{" "}
                    {quantidadeRegistrosSangria.toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-purple-200 pt-4 no-print">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      Fechamento Mensal do Relatório
                    </p>
                    <p className="text-xs text-gray-600">
                      Salva um snapshot detalhado para integração no outro
                      backend.
                    </p>
                    {!fechamentoValido.valido && (
                      <p className="text-xs text-amber-700 mt-1">
                        ⚠️ {fechamentoValido.motivo}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={salvarFechamentoMensal}
                    disabled={
                      salvandoFechamento ||
                      !fechamentoValido.valido ||
                      lojaSelecionada === TODAS_LOJAS_VALUE
                    }
                    className="px-4 py-2 rounded-lg font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {salvandoFechamento
                      ? "Salvando fechamento..."
                      : "💾 Fechar mês e salvar snapshot"}
                  </button>
                </div>
              </div>
            </div>

            <div className="card bg-linear-to-r from-red-50 to-rose-100 border-2 border-rose-200">
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">💸</span>
                Sangria no Período (Separada)
              </h3>
              <p className="text-xs sm:text-sm text-gray-700 mb-4">
                Exibição informativa da sangria sem somar, subtrair ou alterar
                qualquer cálculo existente do relatório.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-white border border-rose-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500">Total Sangria</div>
                  <div className="text-lg font-bold text-rose-700">
                    R${" "}
                    {valorSangriaTotalPeriodo.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
                <div className="bg-white border border-rose-200 rounded-lg p-3">
                  <div className="text-xs text-gray-500">
                    Quantidade de registros
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    {quantidadeRegistrosSangria.toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>

              {registrosSangria.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-rose-200">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th>Data/Hora</th>
                        <th>Usuário</th>
                        <th>Valor</th>
                        <th>Notas</th>
                        <th>Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrosSangria.map((registro) => (
                        <tr
                          key={
                            registro.id ||
                            `${registro.lojaId}-${registro.dataHoraContagem || registro.createdAt}`
                          }
                        >
                          <td>
                            {formatarDataHoraExibicao(
                              registro.dataHoraContagem ||
                                registro.dataHora ||
                                registro.createdAt,
                            )}
                          </td>
                          <td>{obterNomeUsuarioSangria(registro)}</td>
                          <td>
                            R${" "}
                            {Number(
                              registro.quantidade ||
                                registro.totalRetirado ||
                                0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td>
                            R${" "}
                            {Number(
                              registro.totalCalculadoPelasNotas ||
                                registro.valorCalculadoNotas ||
                                registro.totalNotas ||
                                0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td>
                            {registro.observacao || registro.observacoes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  Sem registros detalhados de sangria no período selecionado.
                </p>
              )}
            </div>

            {comparativoMensal && (
              <div className="card bg-gradient-to-r from-slate-50 to-indigo-50 border-2 border-indigo-200">
                <h3 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl">📈</span>
                  Comparativo com o Mês Passado (mesmos dias)
                </h3>
                <p className="text-xs sm:text-sm text-gray-700 mb-4">
                  Atual:{" "}
                  {formatarDataExibicao(comparativoMensal.periodoAtual?.inicio)}{" "}
                  até{" "}
                  {formatarDataExibicao(comparativoMensal.periodoAtual?.fim)} |
                  Mês passado:{" "}
                  {formatarDataExibicao(
                    comparativoMensal.periodoAnterior?.inicio,
                  )}{" "}
                  até{" "}
                  {formatarDataExibicao(comparativoMensal.periodoAnterior?.fim)}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {(comparativoMensal.metricas || []).map((metrica) => {
                    const indicador = metrica.indicador || {};
                    const classes = obterClassesStatusComparacao(
                      indicador.status,
                    );

                    const sinalPercentual =
                      indicador.percentual > 0.0001
                        ? "+"
                        : indicador.percentual < -0.0001
                          ? "-"
                          : "";

                    const sinalDiferenca =
                      indicador.diferenca > 0.0001
                        ? "+"
                        : indicador.diferenca < -0.0001
                          ? "-"
                          : "";

                    const textoStatus =
                      indicador.status === "melhor"
                        ? "Melhor"
                        : indicador.status === "pior"
                          ? "Pior"
                          : "Igual";

                    return (
                      <div
                        key={metrica.chave}
                        className={`rounded-xl border-2 p-4 ${classes.card}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-gray-900 text-sm sm:text-base">
                            {metrica.icone} {metrica.titulo}
                          </h4>
                          <span
                            className={`text-xs font-bold ${classes.texto}`}
                          >
                            {classes.icone} {textoStatus}
                          </span>
                        </div>

                        <p
                          className={`text-sm font-bold mt-2 ${classes.texto}`}
                        >
                          {sinalPercentual}
                          {formatarPercentualComparacao(
                            Math.abs(indicador.percentual || 0),
                          )}
                          %{" "}
                          {indicador.direcao === "igual"
                            ? "igual ao"
                            : `${indicador.direcao} do`}{" "}
                          mês passado
                        </p>

                        <p className="text-xs text-gray-700 mt-2">
                          Atual: R$ {formatarMoeda(indicador.atual)}
                        </p>
                        <p className="text-xs text-gray-700">
                          Mês passado: R$ {formatarMoeda(indicador.anterior)}
                        </p>
                        <p
                          className={`text-xs font-semibold mt-1 ${classes.texto}`}
                        >
                          Diferença: {sinalDiferenca}R${" "}
                          {formatarMoeda(Math.abs(indicador.diferenca || 0))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Detalhamento por máquina */}
            {relatorio.maquinas && relatorio.maquinas.length > 0 && (
              <div className="space-y-6">
                <div className="card bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2 sm:gap-3">
                    <span className="text-3xl sm:text-4xl">🎰</span>
                    <span className="break-words">
                      RELATÓRIO DETALHADO POR MÁQUINA
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm opacity-90 mt-2">
                    Visualize abaixo as informações detalhadas de cada máquina
                    desta loja no período selecionado
                  </p>
                </div>

                {relatorio.maquinas.map((maquina, index) => (
                  <div
                    key={maquina.maquina.id}
                    className="card border-4 border-indigo-300 shadow-2xl page-break-before"
                  >
                    {/* Header da Máquina com destaque */}
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 sm:p-6 rounded-xl mb-4 sm:mb-6 shadow-lg">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex-1">
                          <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">
                            🎰 {maquina.maquina.nome || `Máquina ${index + 1}`}
                          </h3>
                          <p className="text-sm sm:text-lg opacity-90">
                            📋 Código:{" "}
                            <span className="font-mono font-bold">
                              {maquina.maquina.codigo}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="bg-white/20 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-lg">
                            <div className="text-xs sm:text-sm opacity-90">
                              Máquina
                            </div>
                            <div className="text-2xl sm:text-3xl font-bold">
                              {index + 1}/{relatorio.maquinas.length}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Totais da Máquina em destaque */}
                    <div className="mb-4 sm:mb-6">
                      <h4 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                        <span className="text-xl sm:text-2xl">📊</span>
                        <span className="text-sm sm:text-base">
                          Resumo de Movimentações desta Máquina
                        </span>
                      </h4>
                      <div className="flex flex-wrap gap-4 sm:gap-6">
                        {/* Fichas */}
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🎫
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.fichas.toLocaleString("pt-BR")}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Total de Fichas
                          </div>
                        </div>
                        {/* Dinheiro máquina */}
                        <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            💵
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.dinheiro || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Dinheiro
                          </div>
                        </div>
                        {/* Cartão/Pix máquina */}
                        <div className="bg-gradient-to-br from-cyan-400 to-cyan-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🟢
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.cartaoPix || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Cartão / Pix (Bruto)
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 opacity-90 font-semibold">
                            R${" "}
                            {Number(
                              maquina.totais.cartaoPixLiquido || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-[10px] sm:text-xs text-center opacity-80">
                            Líquido
                          </div>
                        </div>
                        {/* Produtos que saíram */}
                        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            📤
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.produtosSairam.toLocaleString(
                              "pt-BR",
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Produtos Saíram
                          </div>
                        </div>
                        {/* Produtos que entraram */}
                        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            📥
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.produtosEntraram.toLocaleString(
                              "pt-BR",
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Produtos Entraram
                          </div>
                        </div>
                        {/* Movimentações
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🔄
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.movimentacoes}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Total de Movimentações
                          </div>
                        </div> */}
                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            ➖💸
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            {maquina.totais.custoProdutosSairam !==
                              undefined && (
                              <div className="text-xl sm:text-3xl font-bold text-center">
                                R${" "}
                                {Number(
                                  maquina.totais.custoProdutosSairam,
                                ).toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })}
                              </div>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Custo dos produtos que saíram
                          </div>
                        </div>
                        {/* Custo total das pelúcias */}

                        {/* Lucro da máquina */}
                        <div className="bg-gradient-to-br from-yellow-500 to-orange-600 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            💰
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {(() => {
                              const fichas = maquina.totais.fichas || 0;
                              const valorFicha = toNumber(
                                maquina.maquina.valorFicha ??
                                  relatorio.loja?.valorFichaPadrao ??
                                  obterValorFichaPadraoDaLojaSelecionada(),
                              );
                              return (fichas * valorFicha).toFixed(2);
                            })()}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Lucro da Máquina
                          </div>
                        </div>
                        {/* Lucro Líquido da máquina */}
                        <div className="bg-gradient-to-br from-green-700 to-green-400 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🟩
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.lucroLiquido || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Lucro Líquido da Máquina
                          </div>
                        </div>
                        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-3 sm:p-5 rounded-xl shadow-lg">
                          <div className="text-2xl sm:text-4xl mb-1 sm:mb-2 text-center">
                            🎯
                          </div>
                          <div className="text-xl sm:text-3xl font-bold text-center">
                            R${" "}
                            {Number(
                              maquina.totais.ticketPorPremio || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-center mt-1 sm:mt-2 opacity-90">
                            Ticket por Prêmio
                          </div>
                          <div className="text-[10px] sm:text-xs text-center mt-1 opacity-80">
                            Faturamento Bruto ÷ Produtos Saíram
                          </div>
                          <div className="text-[10px] sm:text-xs text-center mt-1 opacity-80">
                            {`R$ ${Number(
                              maquina.totais.faturamentoBruto || 0,
                            ).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })} / ${Number(
                              maquina.totais.produtosSairam || 0,
                            ).toLocaleString("pt-BR")} saídas`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Produtos da Máquina */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      {/* Produtos que Saíram */}
                      <div className="bg-red-50 p-3 sm:p-5 rounded-xl border-2 border-red-200">
                        <h4 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2 bg-red-500 text-white p-2 sm:p-3 rounded-lg">
                          <span className="text-xl sm:text-2xl">📤</span>
                          <span className="text-sm sm:text-base">
                            Produtos que SAÍRAM
                          </span>
                          <span className="ml-auto bg-white text-red-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                            {maquina.totais.produtosSairam}
                          </span>
                        </h4>
                        {maquina.produtosSairam &&
                        maquina.produtosSairam.length > 0 ? (
                          <div className="space-y-2 sm:space-y-3">
                            {maquina.produtosSairam
                              .sort((a, b) => b.quantidade - a.quantidade)
                              .map((produto) => (
                                <div
                                  key={produto.id}
                                  className="bg-white p-3 sm:p-4 rounded-lg border-2 border-red-300 shadow-md"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                      <span className="text-2xl sm:text-4xl shrink-0">
                                        {produto.emoji || "📦"}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm sm:text-lg text-gray-900 truncate">
                                          {produto.nome}
                                        </div>
                                        <div className="text-xs sm:text-sm text-gray-600 truncate">
                                          📋 Cód:{" "}
                                          <span className="font-mono">
                                            {produto.codigo || "S/C"}
                                          </span>
                                        </div>
                                        {/* Custo unitário e total do produto */}
                                        {produto.custoUnitario !==
                                          undefined && (
                                          <div className="text-xs text-gray-700 mt-1">
                                            💲 Custo unitário: R${" "}
                                            {Number(
                                              produto.custoUnitario,
                                            ).toLocaleString("pt-BR", {
                                              minimumFractionDigits: 2,
                                            })}
                                            {produto.custoTotal !==
                                              undefined && (
                                              <>
                                                {" "}
                                                | Custo total:{" "}
                                                <span className="font-bold">
                                                  R${" "}
                                                  {Number(
                                                    produto.custoTotal,
                                                  ).toLocaleString("pt-BR", {
                                                    minimumFractionDigits: 2,
                                                  })}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="bg-red-500 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-base sm:text-xl shrink-0">
                                      {produto.quantidade.toLocaleString(
                                        "pt-BR",
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-white rounded-lg">
                            <p className="text-6xl mb-2">📭</p>
                            <p className="text-gray-500 font-medium">
                              Nenhum produto saiu
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Produtos que Entraram */}
                      <div className="bg-green-50 p-3 sm:p-5 rounded-xl border-2 border-green-200">
                        <h4 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2 bg-green-500 text-white p-2 sm:p-3 rounded-lg">
                          <span className="text-xl sm:text-2xl">📥</span>
                          <span className="text-sm sm:text-base">
                            Produtos que ENTRARAM
                          </span>
                          <span className="ml-auto bg-white text-green-500 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                            {maquina.totais.produtosEntraram}
                          </span>
                        </h4>
                        {maquina.produtosEntraram &&
                        maquina.produtosEntraram.length > 0 ? (
                          <div className="space-y-2 sm:space-y-3">
                            {maquina.produtosEntraram
                              .sort((a, b) => b.quantidade - a.quantidade)
                              .map((produto) => (
                                <div
                                  key={produto.id}
                                  className="bg-white p-3 sm:p-4 rounded-lg border-2 border-green-300 shadow-md"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                      <span className="text-2xl sm:text-4xl shrink-0">
                                        {produto.emoji || "📦"}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm sm:text-lg text-gray-900 truncate">
                                          {produto.nome}
                                        </div>
                                        <div className="text-xs sm:text-sm text-gray-600 truncate">
                                          📋 Cód:{" "}
                                          <span className="font-mono">
                                            {produto.codigo || "S/C"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="bg-green-500 text-white px-3 sm:px-5 py-2 sm:py-3 rounded-xl font-bold text-base sm:text-xl shrink-0">
                                      {produto.quantidade.toLocaleString(
                                        "pt-BR",
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 sm:py-8 bg-white rounded-lg">
                            <p className="text-4xl sm:text-6xl mb-2">📭</p>
                            <p className="text-sm sm:text-base text-gray-500 font-medium">
                              Nenhum produto entrou
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Separador entre máquinas */}
                    {index < relatorio.maquinas.length - 1 && (
                      <div className="mt-8 pt-6 border-t-4 border-dashed border-gray-300">
                        <p className="text-center text-gray-500 text-sm font-medium">
                          ⬇️ Próxima Máquina ⬇️
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Gráfico de saída por máquina */}
            {relatorio.graficoSaidaPorMaquina &&
              relatorio.graficoSaidaPorMaquina.length > 0 &&
              (() => {
                const max = Math.max(
                  ...relatorio.graficoSaidaPorMaquina.map(
                    (item) => item.produtosSairam,
                  ),
                );
                const maxHeight = 48; // px
                return (
                  <div className="card bg-linear-to-r from-blue-50 to-blue-100 border-2 border-blue-300 mt-8 overflow-x-auto">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-2xl">📊</span>
                      Gráfico: Saída de Produtos por Máquina
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {relatorio.graficoSaidaPorMaquina.map((item) => {
                        const height =
                          max > 0 ? (item.produtosSairam / max) * maxHeight : 0;
                        return (
                          <div
                            key={item.maquina}
                            className="flex flex-col items-center overflow-x-auto"
                          >
                            <div className="font-bold text-lg text-blue-700 overflow-x-auto">
                              {item.maquina}
                            </div>
                            <div className="w-12 h-12 flex items-end">
                              <div
                                style={{
                                  height: `${height}px`,
                                  background: "#1976d2",
                                  width: "100%",
                                  borderRadius: 4,
                                  transition: "height 0.3s",
                                }}
                              ></div>
                            </div>
                            <div className="text-sm text-gray-700 mt-2">
                              {item.produtosSairam} saíram
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            {/* Gráfico de saída por produto */}
            {relatorio.graficoSaidaPorProduto &&
              relatorio.graficoSaidaPorProduto.length > 0 &&
              (() => {
                const max = Math.max(
                  ...relatorio.graficoSaidaPorProduto.map(
                    (item) => item.quantidade,
                  ),
                );
                const maxHeight = 48; // px
                return (
                  <div className="card bg-linear-to-r from-green-50 to-green-100 border-2 border-green-300 mt-8 overflow-x-auto">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-2xl">📦</span>
                      Gráfico: Saída de Produtos por Tipo
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {relatorio.graficoSaidaPorProduto.map((item) => {
                        const height =
                          max > 0 ? (item.quantidade / max) * maxHeight : 0;
                        return (
                          <div
                            key={item.produto}
                            className="flex flex-col items-center"
                          >
                            <div className="font-bold text-lg text-green-700">
                              {item.produto}
                            </div>
                            <div className="w-12 h-12 flex items-end">
                              <div
                                style={{
                                  height: `${height}px`,
                                  background: "#43a047",
                                  width: "100%",
                                  borderRadius: 4,
                                  transition: "height 0.3s",
                                }}
                              ></div>
                            </div>
                            <div className="text-sm text-gray-700 mt-2">
                              {item.quantidade} saíram
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            {/* Consolidado Geral de Produtos */}
            <div className="card bg-gradient-to-r from-amber-50 to-orange-100 border-2 border-orange-300">
              <h3 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-3xl">📊</span>
                Consolidado Geral de Produtos
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Resumo de todos os produtos (todas as máquinas somadas)
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Produtos que Saíram - Consolidado */}
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📤</span>
                    Produtos que Saíram (Total Geral)
                  </h4>
                  {relatorio.produtosSairam &&
                  relatorio.produtosSairam.length > 0 ? (
                    <div className="space-y-2">
                      {relatorio.produtosSairam
                        .sort((a, b) => b.quantidade - a.quantidade)
                        .map((produto) => (
                          <div
                            key={produto.id}
                            className="p-3 bg-white border-2 border-red-200 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">
                                  {produto.emoji || "📦"}
                                </span>
                                <div>
                                  <div className="font-bold text-gray-900">
                                    {produto.nome}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Cód: {produto.codigo || "S/C"}
                                  </div>
                                </div>
                              </div>
                              <span className="bg-red-500 text-white px-3 py-1 rounded-full font-bold">
                                {produto.quantidade.toLocaleString("pt-BR")}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">📭</p>
                      <p className="text-gray-600">Nenhum produto saiu</p>
                    </div>
                  )}
                </div>

                {/* Produtos que Entraram - Consolidado */}
                <div>
                  <h4 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <span className="text-2xl">📥</span>
                    Produtos que Entraram (Total Geral)
                  </h4>
                  {relatorio.produtosEntraram &&
                  relatorio.produtosEntraram.length > 0 ? (
                    <div className="space-y-2">
                      {relatorio.produtosEntraram
                        .sort((a, b) => b.quantidade - a.quantidade)
                        .map((produto) => (
                          <div
                            key={produto.id}
                            className="p-3 bg-white border-2 border-green-200 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">
                                  {produto.emoji || "📦"}
                                </span>
                                <div>
                                  <div className="font-bold text-gray-900">
                                    {produto.nome}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    Cód: {produto.codigo || "S/C"}
                                  </div>
                                </div>
                              </div>
                              <span className="bg-green-500 text-white px-3 py-1 rounded-full font-bold">
                                {produto.quantidade.toLocaleString("pt-BR")}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-4xl mb-2">📭</p>
                      <p className="text-gray-600">Nenhum produto entrou</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Estado Vazio */}
        {!relatorio && !loading && !error && (
          <div className="text-center py-12 card">
            <p className="text-6xl mb-4">📄</p>
            <p className="text-gray-600 text-lg">
              Selecione uma loja (ou todas as lojas) e o período para gerar o
              relatório
            </p>
          </div>
        )}
      </div>

      <Footer />

      {/* Estilos de Impressão */}
      <style>{`
        @media print {
          .no-print, nav, footer {
            display: none !important;
          }
          
          body {
            background: white !important;
          }
          
          .card {
            page-break-inside: avoid;
            box-shadow: none !important;
            border: 1px solid #e5e7eb;
          }
          
          .page-break-before {
            page-break-before: always;
          }
          
          .print-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color: white !important;
          }
          
          .bg-gradient-to-br, .bg-gradient-to-r {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .from-blue-500, .to-blue-600,
          .from-red-500, .to-red-600,
          .from-green-500, .to-green-600,
          .from-purple-500, .to-purple-600,
          .from-indigo-500, .to-indigo-500 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .bg-blue-50, .bg-red-50, .bg-green-50, .bg-purple-50, .bg-gray-50 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .border-blue-200, .border-red-200, .border-green-200, .border-purple-200 {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          @page {
            margin: 1.5cm;
            size: A4;
          }
          
          h1, h2, h3, h4 {
            page-break-after: avoid;
          }
          
          .grid {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
