import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox, Badge } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

const hojeISO = () => new Date().toISOString().slice(0, 10);

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const sameId = (a, b) => String(a ?? "") === String(b ?? "");

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const getDateValue = (item) =>
  item?.dataMovimentacao ||
  item?.dataColeta ||
  item?.data ||
  item?.createdAt ||
  item?.created_at ||
  item?.updatedAt ||
  item?.updated_at ||
  item?.timestamp ||
  null;

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toISODate = (value) => {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
};

const formatDateTime = (value) => {
  const date = toDate(value);
  if (!date) return { date: "-", time: "-" };

  return {
    date: date.toLocaleDateString("pt-BR"),
    time: date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
};

const getProdutoId = (item) =>
  item?.produtoId ??
  item?.produto_id ??
  item?.idProduto ??
  item?.produto?.id ??
  item?.id;

const getNested = (item, keys) => {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) return item[key];
  }
  return undefined;
};

const getQuantidadeAnterior = (item) =>
  getNested(item, [
    "quantidadeAnterior",
    "quantidade_antiga",
    "quantidadeAntes",
    "antes",
    "valorAnterior",
    "oldValue",
    "old",
  ]);

const getQuantidadeNova = (item) =>
  getNested(item, [
    "quantidadeNova",
    "quantidade_nova",
    "quantidadeDepois",
    "depois",
    "valorNovo",
    "newValue",
    "new",
  ]);

const normalizeArrayPayload = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.logs)) return data.logs;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.registros)) return data.registros;
  return [];
};

const normalizeAnaliseEvento = (evento) => {
  const quantidadeAnterior = getQuantidadeAnterior(evento);
  const quantidadeNova = getQuantidadeNova(evento);
  const maquina = evento.maquina || {};
  const usuario = evento.usuario || evento.user || {};
  const impactoLoja = toNumber(evento.impactoLoja ?? evento.impacto_loja);
  const quantidade = toNumber(evento.quantidade);

  return {
    ...evento,
    id: evento.id || `${evento.origem || "evento"}-${evento.produtoId}-${evento.data}`,
    origem: evento.origem || "backend",
    origemLabel: evento.origemLabel || evento.origem_label || evento.origem || "-",
    tipo: evento.tipo || (impactoLoja >= 0 ? "entrada" : "saida"),
    impactoLoja,
    produtoId: getProdutoId(evento),
    produtoNome:
      evento.produtoNome ||
      evento.produto_nome ||
      evento.produto?.nome ||
      `Produto ${getProdutoId(evento) || "-"}`,
    produtoEmoji: evento.produtoEmoji || evento.produto_emoji || evento.produto?.emoji || "",
    quantidade,
    quantidadeAnterior,
    quantidadeNova,
    data: getDateValue(evento),
    usuarioNome:
      evento.usuarioNome ||
      evento.usuario_nome ||
      usuario.nome ||
      usuario.email ||
      evento.responsavel ||
      "-",
    maquinaNome: evento.maquinaNome || evento.maquina_nome || maquina.nome || "-",
    maquinaCodigo: evento.maquinaCodigo || evento.maquina_codigo || maquina.codigo || "-",
    observacao: evento.observacao || evento.observacoes || "",
    detalhes:
      evento.detalhes ||
      (quantidadeAnterior !== undefined && quantidadeNova !== undefined
        ? `Alteracao manual: ${quantidadeAnterior} -> ${quantidadeNova} (${impactoLoja > 0 ? "+" : ""}${impactoLoja}).`
        : evento.origemLabel || evento.origem || "-"),
  };
};

const getEventoDedupKey = (evento) =>
  [
    evento.origem,
    evento.origemLabel,
    evento.tipo,
    evento.produtoId,
    evento.quantidade,
    evento.impactoLoja,
    getDateValue(evento) || evento.data,
  ].join("|");

const mergeEventosSemDuplicar = (...listas) => {
  const eventosPorChave = new Map();

  listas.flat().forEach((evento) => {
    if (!evento) return;
    const chave = getEventoDedupKey(evento);
    if (!eventosPorChave.has(chave)) {
      eventosPorChave.set(chave, evento);
    }
  });

  return Array.from(eventosPorChave.values());
};

export function AnaliseEstoque() {
  const [lojas, setLojas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [movimentacoesEstoqueLoja, setMovimentacoesEstoqueLoja] = useState([]);
  const [estoqueLoja, setEstoqueLoja] = useState([]);
  const [movimentacoesMaquinas, setMovimentacoesMaquinas] = useState([]);
  const [logsAtividade, setLogsAtividade] = useState([]);
  const [logsDisponiveis, setLogsDisponiveis] = useState(false);
  const [analiseBackend, setAnaliseBackend] = useState(null);

  const [lojaSelecionada, setLojaSelecionada] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [buscaUsuario, setBuscaUsuario] = useState("");

  const [loadingInicial, setLoadingInicial] = useState(true);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    carregarDadosIniciais();
  }, []);

  useEffect(() => {
    if (!lojaSelecionada) {
      setEstoqueLoja([]);
      setMovimentacoesMaquinas([]);
      setLogsAtividade([]);
      setLogsDisponiveis(false);
      setAnaliseBackend(null);
      return;
    }

    carregarDadosDaLoja(lojaSelecionada);
  }, [lojaSelecionada]);

  useEffect(() => {
    if (!lojaSelecionada || !dataInicio) {
      setAnaliseBackend(null);
      return;
    }

    carregarAnaliseBackend(lojaSelecionada);
  }, [lojaSelecionada, dataInicio, dataFim]);

  const carregarDadosIniciais = async () => {
    try {
      setLoadingInicial(true);
      const [lojasRes, produtosRes, maquinasRes, estoqueMovRes] =
        await Promise.all([
          api.get("/lojas"),
          api.get("/produtos"),
          api.get("/maquinas"),
          api.get("/movimentacao-estoque-loja"),
        ]);

      setLojas(lojasRes.data || []);
      setProdutos(produtosRes.data || []);
      setMaquinas(maquinasRes.data || []);
      setMovimentacoesEstoqueLoja(estoqueMovRes.data || []);
      setError("");
    } catch (err) {
      console.error("Erro ao carregar dados da analise de estoque:", err);
      setError("Erro ao carregar dados para analise de estoque.");
    } finally {
      setLoadingInicial(false);
    }
  };

  const carregarLogsAtividade = async (lojaId) => {
    const endpoints = [
      `/logs-atividade?lojaId=${lojaId}`,
      `/logs-atividade?loja_id=${lojaId}`,
      `/auditoria?lojaId=${lojaId}`,
      `/atividade?lojaId=${lojaId}`,
      `/logs?lojaId=${lojaId}`,
      `/estoque-lojas/${lojaId}/logs`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await api.get(endpoint);
        const logs = normalizeArrayPayload(response.data);
        if (logs.length > 0) {
          return { logs, disponivel: true };
        }
      } catch {
        // Endpoint opcional: alguns backends ainda nao possuem auditoria.
      }
    }

    return { logs: [], disponivel: false };
  };

  const carregarDadosDaLoja = async (lojaId) => {
    try {
      setLoadingDetalhes(true);
      const [estoqueRes, movRes, logsRes] = await Promise.all([
        api.get(`/estoque-lojas/${lojaId}`),
        api.get(`/movimentacoes?lojaId=${lojaId}`).catch(async () => {
          const todasMovimentacoes = await api.get("/movimentacoes");
          return { data: todasMovimentacoes.data || [] };
        }),
        carregarLogsAtividade(lojaId),
      ]);

      setEstoqueLoja(estoqueRes.data || []);
      setMovimentacoesMaquinas(movRes.data || []);
      setLogsAtividade(logsRes.logs);
      setLogsDisponiveis(logsRes.disponivel);
      setError("");
    } catch (err) {
      console.error("Erro ao carregar detalhes da loja:", err);
      setError("Nao foi possivel carregar os detalhes do estoque da loja.");
      setEstoqueLoja([]);
      setMovimentacoesMaquinas([]);
      setLogsAtividade([]);
      setLogsDisponiveis(false);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const carregarAnaliseBackend = async (lojaId) => {
    try {
      setLoadingDetalhes(true);
      const response = await api.get(`/estoque-lojas/${lojaId}/analise`, {
        params: {
          dataInicio,
          dataFim: dataFim || hojeISO(),
        },
      });

      setAnaliseBackend(response.data || null);
      setLogsAtividade(response.data?.logsDetalhados || []);
      setLogsDisponiveis(true);
      setError("");
    } catch (err) {
      console.warn("Endpoint consolidado de analise indisponivel, usando fallback:", err);
      setAnaliseBackend(null);
    } finally {
      setLoadingDetalhes(false);
    }
  };

  const produtosPorId = useMemo(
    () =>
      produtos.reduce((acc, produto) => {
        acc[String(produto.id)] = produto;
        return acc;
      }, {}),
    [produtos],
  );

  const maquinasPorId = useMemo(
    () =>
      maquinas.reduce((acc, maquina) => {
        acc[String(maquina.id)] = maquina;
        return acc;
      }, {}),
    [maquinas],
  );

  const maquinasDaLoja = useMemo(
    () =>
      maquinas.filter(
        (maquina) =>
          !lojaSelecionada ||
          sameId(
            maquina.lojaId ?? maquina.loja_id ?? maquina.loja?.id,
            lojaSelecionada,
          ),
      ),
    [lojaSelecionada, maquinas],
  );

  const movimentosEstoqueLojaSelecionada = useMemo(
    () =>
      movimentacoesEstoqueLoja.filter((mov) => {
        const movLojaId = mov.loja?.id ?? mov.lojaId ?? mov.loja_id;
        return lojaSelecionada && sameId(movLojaId, lojaSelecionada);
      }),
    [lojaSelecionada, movimentacoesEstoqueLoja],
  );

  const movimentosMaquinasDaLoja = useMemo(() => {
    if (!lojaSelecionada) return [];
    const maquinaIdsDaLoja = new Set(
      maquinasDaLoja.map((maquina) => String(maquina.id)),
    );

    return movimentacoesMaquinas.filter((mov) => {
      const maquina =
        mov.maquina || maquinasPorId[String(mov.maquinaId ?? mov.maquina_id)];
      const lojaMov =
        mov.lojaId ??
        mov.loja_id ??
        mov.loja?.id ??
        maquina?.lojaId ??
        maquina?.loja_id;

      return (
        sameId(lojaMov, lojaSelecionada) ||
        maquinaIdsDaLoja.has(String(mov.maquinaId ?? mov.maquina_id))
      );
    });
  }, [lojaSelecionada, maquinasDaLoja, maquinasPorId, movimentacoesMaquinas]);

  const eventosOperacionais = useMemo(() => {
    const eventosLoja = movimentosEstoqueLojaSelecionada.flatMap((mov) => {
      const produtosMovimentados = Array.isArray(mov.produtosEnviados)
        ? mov.produtosEnviados
        : Array.isArray(mov.produtos)
          ? mov.produtos
          : [];

      return produtosMovimentados.map((item, index) => {
        const produtoId = getProdutoId(item);
        const tipoMovimentacao =
          item.tipoMovimentacao || item.tipo || mov.tipoMovimentacao || "saida";
        const produto = item.produto || produtosPorId[String(produtoId)];
        const isEntrada = tipoMovimentacao === "entrada";

        return {
          id: `loja-${mov.id || getDateValue(mov) || index}-${produtoId}-${index}`,
          origem: "estoque-loja",
          origemLabel: "Movimento do estoque da loja",
          tipo: isEntrada ? "entrada" : "saida",
          impactoLoja: isEntrada ? toNumber(item.quantidade) : -toNumber(item.quantidade),
          produtoId,
          produtoNome:
            produto?.nome || item.produtoNome || item.nome || `Produto ${produtoId || "-"}`,
          produtoEmoji: produto?.emoji || item.produto?.emoji || "",
          quantidade: toNumber(item.quantidade),
          data: getDateValue(mov),
          usuarioNome: mov.usuario?.nome || mov.usuarioNome || mov.responsavel || "-",
          maquinaNome: "-",
          maquinaCodigo: "-",
          observacao: mov.observacao || mov.observacoes || "",
          detalhes: "Registrado em movimentacao de estoque da loja.",
        };
      });
    });

    const eventosMaquina = movimentosMaquinasDaLoja.flatMap((mov, movIndex) => {
      const maquina =
        mov.maquina || maquinasPorId[String(mov.maquinaId ?? mov.maquina_id)] || {};
      const detalhes =
        Array.isArray(mov.detalhesProdutos) && mov.detalhesProdutos.length
          ? mov.detalhesProdutos
          : [
              {
                produtoId: mov.produtoId ?? mov.produto_id,
                quantidadeSaiu: mov.sairam,
                quantidadeAbastecida: mov.abastecidas,
                retiradaProduto: mov.retiradaProduto,
              },
            ];

      return detalhes.flatMap((detalhe, index) => {
        const produtoId = getProdutoId(detalhe);
        const produto = detalhe.produto || produtosPorId[String(produtoId)];
        const base = {
          produtoId,
          produtoNome:
            produto?.nome ||
            detalhe.produtoNome ||
            detalhe.nome ||
            `Produto ${produtoId || "-"}`,
          produtoEmoji: produto?.emoji || detalhe.produto?.emoji || "",
          data: getDateValue(mov),
          usuarioNome: mov.usuario?.nome || mov.usuarioNome || mov.responsavel || "-",
          maquinaNome: maquina.nome || mov.maquinaNome || "-",
          maquinaCodigo: maquina.codigo || mov.maquinaCodigo || "-",
          observacao: mov.observacoes || mov.observacao || "",
        };

        const saidaConsumidor = toNumber(
          detalhe.quantidadeSaiu ?? detalhe.sairam ?? mov.sairam,
        );
        const abastecimento = toNumber(
          detalhe.quantidadeAbastecida ??
            detalhe.abastecidas ??
            detalhe.quantidadeAdicionada ??
            mov.abastecidas,
        );
        const retirada = toNumber(detalhe.retiradaProduto);
        const lista = [];

        if (abastecimento > 0) {
          lista.push({
            ...base,
            id: `maq-abastece-${mov.id || movIndex}-${produtoId}-${index}`,
            origem: "maquina",
            origemLabel: "Abastecimento de maquina",
            tipo: "saida",
            impactoLoja: -abastecimento,
            quantidade: abastecimento,
            detalhes: "Saiu do estoque da loja para abastecer a maquina.",
          });
        }

        if (saidaConsumidor > 0) {
          lista.push({
            ...base,
            id: `maq-venda-${mov.id || movIndex}-${produtoId}-${index}`,
            origem: "maquina",
            origemLabel: "Saida da maquina",
            tipo: "saida-maquina",
            impactoLoja: 0,
            quantidade: saidaConsumidor,
            detalhes: "Produto saiu da maquina. Nao altera diretamente o estoque da loja.",
          });
        }

        if (retirada > 0) {
          lista.push({
            ...base,
            id: `maq-retirada-${mov.id || movIndex}-${produtoId}-${index}`,
            origem: "maquina",
            origemLabel: "Retirada de maquina",
            tipo: "entrada",
            impactoLoja: retirada,
            quantidade: retirada,
            observacao: base.observacao || "Retirada de produto da maquina",
            detalhes: "Retorno/retirada considerada como entrada na loja quando registrada.",
          });
        }

        return lista;
      });
    });

    return [...eventosLoja, ...eventosMaquina].filter(
      (evento) => evento.produtoId || evento.produtoNome,
    );
  }, [
    maquinasPorId,
    movimentosEstoqueLojaSelecionada,
    movimentosMaquinasDaLoja,
    produtosPorId,
  ]);

  const eventosManuais = useMemo(() => {
    if (!lojaSelecionada || !logsAtividade.length) return [];

    const montarEvento = (log, item, index) => {
      const produtoId = getProdutoId(item) ?? getProdutoId(log);
      const produto = item?.produto || log?.produto || produtosPorId[String(produtoId)];
      const anterior = toNumber(getQuantidadeAnterior(item) ?? getQuantidadeAnterior(log));
      const novo = toNumber(getQuantidadeNova(item) ?? getQuantidadeNova(log));
      const delta = novo - anterior;

      if (!produtoId || delta === 0) return null;

      return {
        id: `manual-${log.id || getDateValue(log) || index}-${produtoId}-${index}`,
        origem: "manual",
        origemLabel: "Edicao manual / log de atividade",
        tipo: delta > 0 ? "entrada" : "saida",
        impactoLoja: delta,
        produtoId,
        produtoNome:
          produto?.nome || item?.produtoNome || log?.produtoNome || `Produto ${produtoId}`,
        produtoEmoji: produto?.emoji || "",
        quantidade: Math.abs(delta),
        quantidadeAnterior: anterior,
        quantidadeNova: novo,
        data: getDateValue(log),
        usuarioNome:
          log.usuario?.nome ||
          log.usuarioNome ||
          log.user?.nome ||
          log.responsavel ||
          "-",
        maquinaNome: "-",
        maquinaCodigo: "-",
        observacao: log.observacao || log.descricao || log.acao || log.action || "",
        detalhes: `Alteracao manual: ${anterior} -> ${novo} (${delta > 0 ? "+" : ""}${delta}).`,
      };
    };

    return logsAtividade.flatMap((log, logIndex) => {
      const logLojaId =
        log.loja?.id ??
        log.lojaId ??
        log.loja_id ??
        log.dadosNovos?.lojaId ??
        log.dados_novos?.lojaId;

      if (logLojaId && !sameId(logLojaId, lojaSelecionada)) return [];

      const itens =
        log.produtos ||
        log.itens ||
        log.alteracoes ||
        log.dadosNovos?.produtos ||
        log.dados_novos?.produtos;

      if (Array.isArray(itens)) {
        return itens
          .map((item, index) => montarEvento(log, item, `${logIndex}-${index}`))
          .filter(Boolean);
      }

      const evento = montarEvento(log, log, logIndex);
      return evento ? [evento] : [];
    });
  }, [lojaSelecionada, logsAtividade, produtosPorId]);

  const eventosBackend = useMemo(
    () => normalizeArrayPayload(analiseBackend?.eventos).map(normalizeAnaliseEvento),
    [analiseBackend],
  );

  const eventos = useMemo(() => {
    const eventosEstoqueLojaFallback = eventosOperacionais.filter(
      (evento) => evento.origem === "estoque-loja",
    );
    const eventosBase = analiseBackend
      ? mergeEventosSemDuplicar(eventosBackend, eventosEstoqueLojaFallback)
      : [...eventosOperacionais, ...eventosManuais];

    return eventosBase.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
  }, [analiseBackend, eventosBackend, eventosManuais, eventosOperacionais]);

  const dataFimEfetiva = dataFim || hojeISO();

  const eventosFiltrados = useMemo(
    () =>
      eventos.filter((evento) => {
        const dataEventoISO = toISODate(evento.data);
        const usuarioOk =
          !buscaUsuario ||
          normalizeText(evento.usuarioNome).includes(normalizeText(buscaUsuario));

        return (
          (!produtoSelecionado || sameId(evento.produtoId, produtoSelecionado)) &&
          (!tipoFiltro || evento.tipo === tipoFiltro) &&
          (!dataInicio || dataEventoISO >= dataInicio) &&
          (!dataFimEfetiva || dataEventoISO <= dataFimEfetiva) &&
          usuarioOk
        );
      }),
    [
      buscaUsuario,
      dataFimEfetiva,
      dataInicio,
      eventos,
      produtoSelecionado,
      tipoFiltro,
    ],
  );

  const resumoProdutos = useMemo(() => {
    const resumo = new Map();

    const garantirProduto = (produtoId, fallback = {}) => {
      const key = String(produtoId || fallback.produtoNome || fallback.nome);
      if (!key || key === "undefined") return null;

      if (!resumo.has(key)) {
        const produto = produtosPorId[String(produtoId)] || fallback.produto || {};
        resumo.set(key, {
          produtoId,
          produtoNome:
            produto.nome ||
            fallback.produtoNome ||
            fallback.nome ||
            `Produto ${produtoId || "-"}`,
          produtoEmoji: produto.emoji || fallback.produtoEmoji || "",
          estoqueAtual: 0,
          estoqueMinimo: 0,
          estoqueInicio: 0,
          estoqueFim: 0,
          entradasLoja: 0,
          saidasLoja: 0,
          abastecidoMaquinas: 0,
          saidasMaquinas: 0,
          ajustesManuais: 0,
          saldoPeriodo: 0,
        });
      }

      return resumo.get(key);
    };

    if (analiseBackend) {
      normalizeArrayPayload(analiseBackend.produtos).forEach((item) => {
        const produtoId = getProdutoId(item);
        const resumoItem = garantirProduto(produtoId, {
          produto: item.produto,
          produtoNome: item.produtoNome || item.produto_nome,
          produtoEmoji: item.produtoEmoji || item.produto_emoji,
        });

        if (resumoItem) {
          resumoItem.estoqueAtual = toNumber(item.estoqueAtual);
          resumoItem.estoqueMinimo = toNumber(item.estoqueMinimo);
          resumoItem.estoqueInicio = toNumber(item.estoqueInicial ?? item.estoqueInicio);
          resumoItem.estoqueFim = toNumber(item.estoqueFinal ?? item.estoqueFim);
        }
      });

      eventos.forEach((evento) => garantirProduto(evento.produtoId, evento));

      resumo.forEach((item) => {
        eventosFiltrados
          .filter((evento) => sameId(evento.produtoId, item.produtoId))
          .forEach((evento) => {
            if (evento.origem === "manual") {
              item.ajustesManuais += evento.impactoLoja;
            } else if (
              evento.origem === "maquina" &&
              evento.origemLabel === "Abastecimento de maquina"
            ) {
              item.abastecidoMaquinas += evento.quantidade;
            } else if (evento.origem === "maquina" && evento.tipo === "saida-maquina") {
              item.saidasMaquinas += evento.quantidade;
            } else if (evento.tipo === "entrada") {
              item.entradasLoja += evento.quantidade;
            } else if (evento.tipo === "saida") {
              item.saidasLoja += evento.quantidade;
            }

            item.saldoPeriodo += evento.impactoLoja;
          });
      });

      return Array.from(resumo.values()).sort((a, b) =>
        a.produtoNome.localeCompare(b.produtoNome),
      );
    }

    estoqueLoja.forEach((item) => {
      const produtoId = getProdutoId(item);
      const produto = item.produto || produtosPorId[String(produtoId)];
      const resumoItem = garantirProduto(produtoId, {
        produto,
        produtoNome: item.produtoNome || item.nome,
        produtoEmoji: produto?.emoji,
      });

      if (resumoItem) {
        resumoItem.estoqueAtual = toNumber(item.quantidade);
        resumoItem.estoqueMinimo = toNumber(item.estoqueMinimo);
      }
    });

    eventos.forEach((evento) => {
      garantirProduto(evento.produtoId, evento);
    });

    const fimDate = new Date(`${dataFimEfetiva}T23:59:59`);
    const inicioDate = dataInicio ? new Date(`${dataInicio}T00:00:00`) : null;

    resumo.forEach((item) => {
      const eventosDoProduto = eventos.filter((evento) =>
        sameId(evento.produtoId, item.produtoId),
      );
      const impactoDepoisFim = eventosDoProduto
        .filter((evento) => {
          const data = toDate(evento.data);
          return data && data > fimDate;
        })
        .reduce((acc, evento) => acc + evento.impactoLoja, 0);

      const impactoDepoisInicio = inicioDate
        ? eventosDoProduto
            .filter((evento) => {
              const data = toDate(evento.data);
              return data && data >= inicioDate;
            })
            .reduce((acc, evento) => acc + evento.impactoLoja, 0)
        : 0;

      item.estoqueFim = item.estoqueAtual - impactoDepoisFim;
      item.estoqueInicio = dataInicio
        ? item.estoqueAtual - impactoDepoisInicio
        : item.estoqueAtual;

      eventosFiltrados
        .filter((evento) => sameId(evento.produtoId, item.produtoId))
        .forEach((evento) => {
          if (evento.origem === "manual") {
            item.ajustesManuais += evento.impactoLoja;
          } else if (evento.origem === "maquina" && evento.origemLabel === "Abastecimento de maquina") {
            item.abastecidoMaquinas += evento.quantidade;
          } else if (evento.origem === "maquina" && evento.tipo === "saida-maquina") {
            item.saidasMaquinas += evento.quantidade;
          } else if (evento.tipo === "entrada") {
            item.entradasLoja += evento.quantidade;
          } else if (evento.tipo === "saida") {
            item.saidasLoja += evento.quantidade;
          }

          item.saldoPeriodo += evento.impactoLoja;
        });
    });

    return Array.from(resumo.values()).sort((a, b) =>
      a.produtoNome.localeCompare(b.produtoNome),
    );
  }, [
    analiseBackend,
    dataFimEfetiva,
    dataInicio,
    estoqueLoja,
    eventos,
    eventosFiltrados,
    produtosPorId,
  ]);

  const resumoFiltrado = useMemo(
    () =>
      resumoProdutos.filter((item) =>
        produtoSelecionado ? sameId(item.produtoId, produtoSelecionado) : true,
      ),
    [produtoSelecionado, resumoProdutos],
  );

  const totais = useMemo(
    () => ({
      estoqueInicio: resumoFiltrado.reduce((acc, item) => acc + item.estoqueInicio, 0),
      estoqueFim: resumoFiltrado.reduce((acc, item) => acc + item.estoqueFim, 0),
      entradas: resumoFiltrado.reduce((acc, item) => acc + item.entradasLoja, 0),
      saidas:
        resumoFiltrado.reduce((acc, item) => acc + item.saidasLoja, 0) +
        resumoFiltrado.reduce((acc, item) => acc + item.abastecidoMaquinas, 0),
      ajustes: resumoFiltrado.reduce((acc, item) => acc + item.ajustesManuais, 0),
      eventos: eventosFiltrados.length,
    }),
    [eventosFiltrados.length, resumoFiltrado],
  );

  const lojaAtual = lojas.find((loja) => sameId(loja.id, lojaSelecionada));
  const mostrarAnalise = Boolean(lojaSelecionada && dataInicio);

  if (loadingInicial) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Analise de Estoque"
          subtitle="Compare o estoque de uma loja por periodo e veja todos os detalhes por produto"
          icon="📦"
          action={<Badge variant="info">Somente leitura</Badge>}
        />

        {error && (
          <div className="mb-6">
            <AlertBox type="error" message={error} onClose={() => setError("")} />
          </div>
        )}

        <section className="card-gradient mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Loja
              </label>
              <select
                className="select-field"
                value={lojaSelecionada}
                onChange={(event) => setLojaSelecionada(event.target.value)}
              >
                <option value="">Selecione uma loja</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data inicial
              </label>
              <input
                type="date"
                className="input-field"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
                max={dataFim || hojeISO()}
                disabled={!lojaSelecionada}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data final
              </label>
              <input
                type="date"
                className="input-field"
                value={dataFim}
                onChange={(event) => setDataFim(event.target.value)}
                min={dataInicio || undefined}
                max={hojeISO()}
                disabled={!lojaSelecionada || !dataInicio}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Produto
              </label>
              <select
                className="select-field"
                value={produtoSelecionado}
                onChange={(event) => setProdutoSelecionado(event.target.value)}
                disabled={!mostrarAnalise}
              >
                <option value="">Todos os produtos</option>
                {resumoProdutos.map((produto) => (
                  <option
                    key={produto.produtoId || produto.produtoNome}
                    value={produto.produtoId}
                  >
                    {produto.produtoNome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Movimento
              </label>
              <select
                className="select-field"
                value={tipoFiltro}
                onChange={(event) => setTipoFiltro(event.target.value)}
                disabled={!mostrarAnalise}
              >
                <option value="">Todos</option>
                <option value="entrada">Entrada na loja</option>
                <option value="saida">Saida da loja</option>
                <option value="saida-maquina">Saida da maquina</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Usuario
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Buscar por nome"
                value={buscaUsuario}
                onChange={(event) => setBuscaUsuario(event.target.value)}
                disabled={!mostrarAnalise}
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => {
                  setProdutoSelecionado("");
                  setTipoFiltro("");
                  setDataInicio("");
                  setDataFim("");
                  setBuscaUsuario("");
                }}
                disabled={!lojaSelecionada}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </section>

        {!lojaSelecionada ? (
          <section className="card text-center py-14">
            <h2 className="text-xl font-bold text-gray-900">Escolha uma loja</h2>
            <p className="text-gray-600 mt-2">
              Primeiro selecione a loja que voce quer analisar.
            </p>
          </section>
        ) : !dataInicio ? (
          <section className="card text-center py-14">
            <h2 className="text-xl font-bold text-gray-900">Selecione a data inicial</h2>
            <p className="text-gray-600 mt-2">
              A analise aparece somente depois da data inicial. A data final e opcional;
              sem ela, o sistema compara ate hoje.
            </p>
          </section>
        ) : loadingDetalhes ? (
          <div className="card text-center py-12">
            <div className="spinner h-12 w-12 mx-auto" />
            <p className="text-gray-600 mt-4">Carregando detalhes da loja...</p>
          </div>
        ) : (
          <>
            {!logsDisponiveis && (
              <div className="mb-6">
                <AlertBox
                  type="warning"
                  title="Logs manuais nao encontrados"
                  message="Mostrei todas as movimentacoes disponiveis. Alteracoes feitas diretamente pelo editar manual so aparecem se o backend tiver endpoint de auditoria/logs retornando quantidade anterior e nova."
                />
              </div>
            )}

            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">
              <div className="stat-card bg-gradient-to-br from-slate-700 to-slate-900">
                <p className="text-sm opacity-90">Loja</p>
                <p className="text-2xl font-bold truncate">{lojaAtual?.nome || "-"}</p>
                <p className="text-xs opacity-75 mt-1">
                  {dataInicio} ate {dataFimEfetiva}
                </p>
              </div>
              <div className="stat-card bg-gradient-to-br from-blue-500 to-blue-700">
                <p className="text-sm opacity-90">Estoque no inicio</p>
                <p className="text-3xl font-bold">{totais.estoqueInicio}</p>
              </div>
              <div className="stat-card bg-gradient-to-br from-indigo-500 to-indigo-700">
                <p className="text-sm opacity-90">Estoque no fim</p>
                <p className="text-3xl font-bold">{totais.estoqueFim}</p>
              </div>
              <div className="stat-card bg-gradient-to-br from-emerald-500 to-emerald-700">
                <p className="text-sm opacity-90">Entradas</p>
                <p className="text-3xl font-bold">+{totais.entradas}</p>
                <p className="text-xs opacity-75 mt-1">sem ajustes manuais</p>
              </div>
              <div className="stat-card bg-gradient-to-br from-red-500 to-red-700">
                <p className="text-sm opacity-90">Saidas</p>
                <p className="text-3xl font-bold">-{totais.saidas}</p>
                <p className="text-xs opacity-75 mt-1">{totais.eventos} registro(s)</p>
              </div>
            </section>

            <section className="card mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Comparativo por produto
                  </h2>
                  <p className="text-sm text-gray-600">
                    Estoque estimado no inicio e no fim do periodo, com entradas,
                    saidas e edicoes manuais.
                  </p>
                </div>
                <Badge variant="info">{resumoFiltrado.length} produto(s)</Badge>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Inicio</th>
                      <th>Fim</th>
                      <th>Variacao</th>
                      <th>Entradas loja</th>
                      <th>Saidas loja</th>
                      <th>Abastecido maquinas</th>
                      <th>Saidas maquinas</th>
                      <th>Ajustes manuais</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoFiltrado.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center text-gray-500">
                          Nenhum produto encontrado para esta loja.
                        </td>
                      </tr>
                    ) : (
                      resumoFiltrado.map((item) => {
                        const variacao = item.estoqueFim - item.estoqueInicio;

                        return (
                          <tr key={item.produtoId || item.produtoNome}>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{item.produtoEmoji || "📦"}</span>
                                <span className="font-semibold">{item.produtoNome}</span>
                              </div>
                            </td>
                            <td className="font-bold text-gray-900">{item.estoqueInicio}</td>
                            <td className="font-bold text-gray-900">{item.estoqueFim}</td>
                            <td
                              className={
                                variacao >= 0
                                  ? "font-bold text-emerald-600"
                                  : "font-bold text-red-600"
                              }
                            >
                              {variacao > 0 ? "+" : ""}
                              {variacao}
                            </td>
                            <td className="font-semibold text-emerald-600">
                              +{item.entradasLoja}
                            </td>
                            <td className="font-semibold text-red-600">
                              -{item.saidasLoja}
                            </td>
                            <td className="font-semibold text-orange-700">
                              -{item.abastecidoMaquinas}
                            </td>
                            <td className="font-semibold text-slate-700">
                              {item.saidasMaquinas}
                            </td>
                            <td
                              className={
                                item.ajustesManuais >= 0
                                  ? "font-semibold text-blue-700"
                                  : "font-semibold text-red-700"
                              }
                            >
                              {item.ajustesManuais > 0 ? "+" : ""}
                              {item.ajustesManuais}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Detalhes das entradas, saidas e edicoes
                  </h2>
                  <p className="text-sm text-gray-600">
                    Cada linha mostra produto, quantidade, usuario, maquina, horario e
                    diferenca quando veio de edicao manual.
                  </p>
                </div>
                <Badge variant="info">{eventosFiltrados.length} registro(s)</Badge>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>Data/Hora</th>
                      <th>Produto</th>
                      <th>Tipo</th>
                      <th>Qtd.</th>
                      <th>Impacto loja</th>
                      <th>Origem</th>
                      <th>Usuario</th>
                      <th>Maquina</th>
                      <th>Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center text-gray-500">
                          Nenhuma movimentacao encontrada no periodo.
                        </td>
                      </tr>
                    ) : (
                      eventosFiltrados.map((evento) => {
                        const data = formatDateTime(evento.data);
                        const isEntrada = evento.impactoLoja > 0;
                        const semImpacto = evento.impactoLoja === 0;

                        return (
                          <tr key={evento.id}>
                            <td>
                              <div className="font-semibold text-gray-900">{data.date}</div>
                              <div className="text-xs text-gray-500">{data.time}</div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{evento.produtoEmoji || "📦"}</span>
                                <span className="font-semibold">{evento.produtoNome}</span>
                              </div>
                            </td>
                            <td>
                              <Badge
                                variant={
                                  evento.tipo === "entrada"
                                    ? "success"
                                    : evento.tipo === "saida"
                                      ? "danger"
                                      : "info"
                                }
                              >
                                {evento.tipo === "saida-maquina"
                                  ? "Saida maquina"
                                  : evento.tipo === "entrada"
                                    ? "Entrada"
                                    : "Saida"}
                              </Badge>
                            </td>
                            <td className="font-bold">{evento.quantidade}</td>
                            <td
                              className={
                                semImpacto
                                  ? "font-bold text-slate-500"
                                  : isEntrada
                                    ? "font-bold text-emerald-600"
                                    : "font-bold text-red-600"
                              }
                            >
                              {semImpacto ? "0" : `${isEntrada ? "+" : ""}${evento.impactoLoja}`}
                            </td>
                            <td>{evento.origemLabel}</td>
                            <td>{evento.usuarioNome || "-"}</td>
                            <td>
                              {evento.maquinaCodigo !== "-" || evento.maquinaNome !== "-" ? (
                                <div>
                                  <div className="font-semibold">{evento.maquinaCodigo}</div>
                                  <div className="text-xs text-gray-500">{evento.maquinaNome}</div>
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="max-w-md whitespace-normal text-gray-600">
                              <div>{evento.detalhes || "-"}</div>
                              {evento.observacao && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {evento.observacao}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
