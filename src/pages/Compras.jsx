import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { AlertBox, Badge, Modal, PageHeader } from "../components/UIComponents";
import { enviarImagemParaCloudinary } from "../utils/cloudinary";
import { confirmar } from "../utils/alerts";
import { filtrarLojasOperacionais } from "../utils/lojas";

const STATUS_OPCOES = [
  { value: "PESQUISANDO", label: "Em pesquisa", variant: "info" },
  { value: "COMPRADO", label: "Comprado", variant: "warning" },
  { value: "RECEBIDO", label: "Recebido", variant: "success" },
];

const normalizarStatusCompra = (status) =>
  status === "APROVADO" ? "COMPRADO" : status || "PESQUISANDO";

const obterStatusInfo = (status) =>
  STATUS_OPCOES.find((opcao) => opcao.value === normalizarStatusCompra(status)) || {
    label: status || "-",
    variant: "info",
  };

const formatarDataHora = (dataIso) => {
  if (!dataIso) return "-";
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR");
};

const formatarMoeda = (valor) =>
  valor !== null && valor !== undefined ? `R$ ${Number(valor).toFixed(2)}` : "-";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const moedaUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const formatarPorMoeda = (valor, moedaCodigo) =>
  moedaCodigo === "USD" ? moedaUsd.format(Number(valor || 0)) : moeda.format(Number(valor || 0));

const numeroFormatado = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const TIPOS_PAGAMENTO = [
  ["A_VISTA", "À vista"],
  ["ANTECIPADO", "Antecipado"],
  ["PARCELADO", "Parcelado"],
];

const FORMAS_PAGAMENTO = [
  ["PIX", "Pix"],
  ["DINHEIRO", "Dinheiro"],
  ["BOLETO", "Boleto"],
];

const MOEDAS_CUSTO = [
  ["BRL", "Real (R$)"],
  ["USD", "Dólar (US$)"],
];

const TIPOS_VALOR_CUSTO = [
  ["FIXO", "Valor fixo"],
  ["PERCENTUAL", "Porcentagem"],
];

const BASES_CALCULO_CUSTO = [
  ["SEM_DESCONTO", "Sobre o valor sem desconto"],
  ["COM_DESCONTO", "Sobre o valor com desconto"],
];

const TIPOS_DESCONTO = [
  ["PERCENTUAL", "Porcentagem"],
  ["FIXO", "Valor fixo"],
];

const formInicial = {
  fornecedorId: "",
  numeroPedido: "",
  moeda: "BRL",
  tipoPagamento: "A_VISTA",
  quantidadeParcelas: "",
  formaPagamento: "PIX",
  observacao: "",
  fotoUrl: "",
  descontoTipo: "",
  descontoValor: "",
};

const itemPedidoVazio = {
  tipoItem: "produto",
  itemNovo: false,
  nomeItem: "",
  produtoId: "",
  insumoId: "",
  pecaId: "",
  sku: "",
  quantidade: "",
  unidade: "",
  valorUnitario: "",
  lojaId: "",
  descricaoUso: "",
};

const custoAdicionalVazio = {
  descricao: "",
  tipoValor: "FIXO",
  valor: "",
  baseCalculo: "SEM_DESCONTO",
  moeda: "BRL",
  formaPagamento: "PIX",
};

const rotuloTipoItem = (tipo) =>
  tipo === "insumo" ? "insumo" : tipo === "peca" ? "peça" : "produto";

const produtoFornecedorVazio = {
  tipo: "produto",
  itemNovo: false,
  produtoNome: "",
  quantidade: "",
  unidade: "un",
  preco: "",
  observacoes: "",
};

const anexoFornecedorVazio = {
  titulo: "",
  url: "",
  tipo: "ORCAMENTO",
};

const fornecedorFormVazio = {
  nome: "",
  contato: "",
  telefoneWhatsapp: "",
  cidade: "",
  observacoes: "",
  ativo: true,
  produtos: [],
  anexos: [],
};

const fornecedorInlineVazio = {
  nome: "",
  contato: "",
  telefoneWhatsapp: "",
  cidade: "",
};

const hojeISO = () => {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

const calcularUnitarioFornecedor = (produto) => {
  const quantidade = Number(produto.quantidade);
  const preco = Number(produto.preco);
  if (!quantidade || quantidade <= 0) return 0;
  return preco / quantidade;
};

const normalizarTexto = (texto) =>
  String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const limparPayloadFornecedor = (form) => ({
  ...form,
  produtos: form.produtos
    .filter((produto) => String(produto.produtoNome || "").trim() !== "")
    .map((produto) => ({
      produtoNome: produto.produtoNome,
      quantidade: Number(produto.quantidade),
      unidade: produto.tipo === "insumo" ? produto.unidade : "un",
      preco: Number(produto.preco),
      observacoes: produto.observacoes,
    })),
  anexos: form.anexos.filter((anexo) => anexo.url.trim()),
});

export default function Compras() {
  const { usuario, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [compras, setCompras] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [pecas, setPecas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [estoquesLojas, setEstoquesLojas] = useState([]);
  const [estoquesMaquinas, setEstoquesMaquinas] = useState({});
  const [fornecedores, setFornecedores] = useState([]);
  const [comparacoes, setComparacoes] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState(formInicial);
  const [itensCompra, setItensCompra] = useState([]);
  const [itemEmEdicao, setItemEmEdicao] = useState(itemPedidoVazio);
  const [itemEditandoTempId, setItemEditandoTempId] = useState(null);
  const [custosAdicionais, setCustosAdicionais] = useState([]);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [mostrarModalParcelas, setMostrarModalParcelas] = useState(false);
  const [compraParaGerarParcelas, setCompraParaGerarParcelas] = useState(null);
  const [parcelasForm, setParcelasForm] = useState([]);
  const [salvandoParcelas, setSalvandoParcelas] = useState(false);
  const [mostrarModalConferencia, setMostrarModalConferencia] = useState(false);
  const [compraParaConferir, setCompraParaConferir] = useState(null);
  const [conferenciaForm, setConferenciaForm] = useState([]);
  const [salvandoConferencia, setSalvandoConferencia] = useState(false);
  const [filtrosSugestao, setFiltrosSugestao] = useState({
    busca: "",
    tipo: "todos",
    lojaId: "",
    maquinaId: "",
  });

  const [buscaHistorico, setBuscaHistorico] = useState("");
  const [historico, setHistorico] = useState(null);
  const [buscandoHistorico, setBuscandoHistorico] = useState(false);

  const [filtroFornecedor, setFiltroFornecedor] = useState({
    busca: "",
    produto: "",
    status: "ativos",
    conteudo: "todos",
    ordenacao: "nome",
  });
  const [mostrarModalFornecedor, setMostrarModalFornecedor] = useState(false);
  const [editandoFornecedor, setEditandoFornecedor] = useState(null);
  const [formFornecedor, setFormFornecedor] = useState(fornecedorFormVazio);
  const [mostrarNovoFornecedorInline, setMostrarNovoFornecedorInline] = useState(false);
  const [novoFornecedorInline, setNovoFornecedorInline] = useState(fornecedorInlineVazio);
  const [salvandoFornecedorInline, setSalvandoFornecedorInline] = useState(false);
  const [secaoAtiva, setSecaoAtiva] = useState("novaCompra");
  const filtrosComprasIniciais = useMemo(
    () => ({
      fornecedorId: "",
      produto: "",
      dataInicio: hojeISO(),
      dataFim: hojeISO(),
      valorMin: "",
      valorMax: "",
    }),
    [],
  );
  const [filtrosCompras, setFiltrosCompras] = useState(filtrosComprasIniciais);
  const [filtrosComprasAplicados, setFiltrosComprasAplicados] = useState(
    filtrosComprasIniciais,
  );

  const carregarDados = useCallback(async () => {
    try {
      setError("");
      const paramsCompras = Object.fromEntries(
        Object.entries(filtrosComprasAplicados).filter(
          ([, valor]) => valor !== undefined && valor !== null && valor !== "",
        ),
      );
      const [
        comprasRes,
        produtosRes,
        insumosRes,
        fornecedoresRes,
        comparacoesRes,
        lojasRes,
        pecasRes,
        maquinasRes,
      ] = await Promise.all([
        api.get("/compras", { params: paramsCompras }),
        api.get("/produtos"),
        api.get("/insumos"),
        api.get("/fornecedores"),
        api.get("/fornecedores/comparacoes"),
        api.get("/lojas"),
        api.get("/pecas"),
        api.get("/maquinas"),
      ]);

      const lojasOperacionais = filtrarLojasOperacionais(
        Array.isArray(lojasRes.data) ? lojasRes.data : [],
      );
      const maquinasAtivas = Array.isArray(maquinasRes.data) ? maquinasRes.data : [];
      const estoquesLojasRes = await Promise.all(
        lojasOperacionais.map((loja) =>
          api
            .get(`/estoque-lojas/${loja.id}`)
            .then((res) => ({ lojaId: loja.id, itens: res.data || [] }))
            .catch(() => ({ lojaId: loja.id, itens: [] })),
        ),
      );
      const estoquesMaquinasRes = await Promise.all(
        maquinasAtivas.map((maquina) =>
          api
            .get(`/maquinas/${maquina.id}/estoque`)
            .then((res) => [maquina.id, res.data])
            .catch(() => [maquina.id, null]),
        ),
      );

      setCompras(Array.isArray(comprasRes.data) ? comprasRes.data : []);
      setProdutos(Array.isArray(produtosRes.data) ? produtosRes.data : []);
      setInsumos(Array.isArray(insumosRes.data) ? insumosRes.data : []);
      setPecas(Array.isArray(pecasRes.data) ? pecasRes.data : []);
      setMaquinas(maquinasAtivas);
      setEstoquesLojas(estoquesLojasRes);
      setEstoquesMaquinas(Object.fromEntries(estoquesMaquinasRes));
      setFornecedores(
        Array.isArray(fornecedoresRes.data) ? fornecedoresRes.data : [],
      );
      setComparacoes(Array.isArray(comparacoesRes.data) ? comparacoesRes.data : []);
      setLojas(lojasOperacionais);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [filtrosComprasAplicados]);

  useEffect(() => {
    if (authLoading) return;
    carregarDados();
  }, [authLoading, carregarDados]);

  const valorTotalPreview =
    itemEmEdicao.quantidade && itemEmEdicao.valorUnitario
      ? Number(itemEmEdicao.quantidade) * Number(itemEmEdicao.valorUnitario)
      : null;
  const itemEmEdicaoTemProduto = Boolean(itemEmEdicao.produtoId);
  const valorTotalItens = itensCompra.reduce(
    (acc, item) => acc + Number(item.quantidade || 0) * Number(item.valorUnitario || 0),
    0,
  );
  const valorDescontoPreview = (() => {
    if (!form.descontoTipo || !form.descontoValor) return 0;
    const valor =
      form.descontoTipo === "PERCENTUAL"
        ? (valorTotalItens * Number(form.descontoValor)) / 100
        : Number(form.descontoValor);
    return Math.min(Math.max(valor, 0), valorTotalItens);
  })();
  const valorItensComDescontoPreview = valorTotalItens - valorDescontoPreview;
  const calcularValorCustoPreview = (custo) => {
    if (custo.tipoValor === "PERCENTUAL") {
      const base =
        custo.baseCalculo === "COM_DESCONTO" ? valorItensComDescontoPreview : valorTotalItens;
      return (base * Number(custo.valor || 0)) / 100;
    }
    return Number(custo.valor || 0);
  };
  const custosPorMoedaPreview = custosAdicionais.reduce((acc, custo) => {
    const moedaCusto = custo.moeda || form.moeda;
    acc[moedaCusto] = (acc[moedaCusto] || 0) + calcularValorCustoPreview(custo);
    return acc;
  }, {});
  const valorTotalCustosNaMoedaDoPedido = custosPorMoedaPreview[form.moeda] || 0;
  const outrasMoedasPreview = Object.entries(custosPorMoedaPreview).filter(
    ([moedaCusto]) => moedaCusto !== form.moeda,
  );
  const valorTotalPedidoPreview = valorItensComDescontoPreview + valorTotalCustosNaMoedaDoPedido;

  const obterNomeItemPorTipo = useCallback(
    (dados) => {
      if (dados?.produtoId) {
        return produtos.find((produto) => produto.id === dados.produtoId)?.nome;
      }
      if (dados?.insumoId) {
        return insumos.find((insumo) => insumo.id === dados.insumoId)?.nome;
      }
      if (dados?.pecaId) {
        return pecas.find((peca) => peca.id === dados.pecaId)?.nome;
      }
      return dados?.nomeItem;
    },
    [insumos, pecas, produtos],
  );

  const obterPrecoFornecedor = useCallback(
    (fornecedorId, dados) => {
      if (!fornecedorId) return null;
      const fornecedor = fornecedores.find(
        (item) => String(item.id) === String(fornecedorId),
      );
      if (!fornecedor?.produtos?.length) return null;

      const nomeItem = normalizarTexto(obterNomeItemPorTipo(dados));
      if (!nomeItem) return null;

      const produtoFornecedor = fornecedor.produtos.find(
        (produto) => normalizarTexto(produto.produtoNome) === nomeItem,
      );
      if (!produtoFornecedor) return null;

      const unitario = calcularUnitarioFornecedor(produtoFornecedor);
      return unitario > 0 ? unitario.toFixed(2) : null;
    },
    [fornecedores, obterNomeItemPorTipo],
  );

  const atualizarItemEmEdicaoComPreco = useCallback(
    (atualizacao) => {
      setItemEmEdicao((prev) => {
        const proximo = { ...prev, ...atualizacao };
        const precoFornecedor = obterPrecoFornecedor(form.fornecedorId, proximo);
        return precoFornecedor
          ? { ...proximo, valorUnitario: precoFornecedor }
          : proximo;
      });
    },
    [form.fornecedorId, obterPrecoFornecedor],
  );

  const precoFornecedorSelecionado = obterPrecoFornecedor(form.fornecedorId, itemEmEdicao);

  const comprasPorStatus = useMemo(
    () =>
      STATUS_OPCOES.map((status) => ({
        ...status,
        compras: compras.filter(
          (compra) => normalizarStatusCompra(compra.status) === status.value,
        ),
      })),
    [compras],
  );

  const comprasComPendencia = useMemo(
    () => compras.filter((compra) => compra.possuiPendencia),
    [compras],
  );

  const sugestoesCompra = useMemo(() => {
    const busca = filtrosSugestao.busca.trim().toLowerCase();
    const sugestoesLoja = estoquesLojas.flatMap(({ lojaId, itens }) => {
      const loja = lojas.find((item) => item.id === lojaId);
      return (itens || [])
        .map((item) => {
          const atual = Number(item.quantidade || 0);
          const minimo = Number(item.estoqueMinimo ?? item.produto?.estoqueMinimo ?? 0);
          const faltaMinimo = Math.max(0, minimo - atual);
          if (faltaMinimo <= 0) return null;
          return {
            id: `loja-${lojaId}-${item.produtoId}`,
            tipo: "loja",
            titulo: item.produto?.nome || "Produto",
            codigo: item.produto?.codigo,
            produtoId: item.produtoId,
            lojaId,
            lojaNome: loja?.nome || "Loja",
            atual,
            minimo,
            faltaMinimo,
            comprar: faltaMinimo,
            unidade: "un",
            detalhe: `Estoque da loja abaixo do minimo`,
          };
        })
        .filter(Boolean);
    });

    const sugestoesProdutoMap = new Map();
    sugestoesLoja.forEach((sugestao) => {
      const atual = sugestoesProdutoMap.get(sugestao.produtoId) || {
        ...sugestao,
        id: `produto-${sugestao.produtoId}`,
        tipo: "produto",
        lojaId: "",
        lojaNome: "Todas as lojas",
        atual: 0,
        minimo: 0,
        faltaMinimo: 0,
        comprar: 0,
        detalhe: "Soma do que falta nas lojas abaixo do minimo",
      };
      atual.atual += sugestao.atual;
      atual.minimo += sugestao.minimo;
      atual.faltaMinimo += sugestao.faltaMinimo;
      atual.comprar += sugestao.comprar;
      sugestoesProdutoMap.set(sugestao.produtoId, atual);
    });

    const sugestoesMaquinasPorLojaMap = new Map();
    maquinas.forEach((maquina) => {
        const estoque = estoquesMaquinas[maquina.id];
        const atual = Number(estoque?.estoqueAtual || 0);
        const capacidade = Number(maquina.capacidadePadrao || estoque?.maquina?.capacidadePadrao || 0);
        const minimo = Number(estoque?.estoqueMinimo || 0);
        const faltaCapacidade = Math.max(0, capacidade - atual);
        const faltaMinimo = Math.max(0, minimo - atual);
        const comprar = faltaCapacidade || faltaMinimo;
        if (comprar <= 0 || !maquina.lojaId) return;

        const loja = lojas.find((item) => item.id === maquina.lojaId);
        const atualLoja = sugestoesMaquinasPorLojaMap.get(maquina.lojaId) || {
          id: `loja-maquinas-${maquina.lojaId}`,
          tipo: "loja",
          titulo: `Reposicao das maquinas`,
          codigo: "",
          produtoId: "",
          lojaId: maquina.lojaId,
          lojaNome: loja?.nome || maquina.loja?.nome || "Loja",
          atual: 0,
          minimo: 0,
          capacidade: 0,
          faltaMinimo: 0,
          faltaCapacidade: 0,
          comprar: 0,
          unidade: "un",
          maquinas: [],
          detalhe: "Soma do que falta nas maquinas desta loja",
        };

        atualLoja.atual += atual;
        atualLoja.minimo += minimo;
        atualLoja.capacidade += capacidade;
        atualLoja.faltaMinimo += faltaMinimo;
        atualLoja.faltaCapacidade += faltaCapacidade;
        atualLoja.comprar += comprar;
        atualLoja.maquinas.push(maquina.nome || maquina.codigo || "Maquina");
        sugestoesMaquinasPorLojaMap.set(maquina.lojaId, atualLoja);
      });

    const sugestoesPecas = pecas
      .map((peca) => {
        const atual = Number(peca.quantidadeEstoque || 0);
        const minimo = Number(peca.estoqueMinimo || 0);
        const faltaMinimo = Math.max(0, minimo - atual);
        if (faltaMinimo <= 0) return null;
        return {
          id: `peca-${peca.id}`,
          tipo: "peca",
          titulo: peca.nome,
          codigo: peca.codigo,
          pecaId: peca.id,
          atual,
          minimo,
          faltaMinimo,
          comprar: faltaMinimo,
          unidade: peca.unidade || "un",
          detalhe: "Peca abaixo do estoque minimo do deposito",
        };
      })
      .filter(Boolean);

    const sugestoesInsumos = insumos
      .map((insumo) => {
        const atual = Number(insumo.quantidadeEstoque || 0);
        const minimo = Number(insumo.estoqueMinimo || 0);
        const faltaMinimo = Math.max(0, minimo - atual);
        if (faltaMinimo <= 0) return null;
        return {
          id: `insumo-${insumo.id}`,
          tipo: "insumo",
          titulo: insumo.nome,
          codigo: "",
          insumoId: insumo.id,
          atual,
          minimo,
          faltaMinimo,
          comprar: faltaMinimo,
          unidade: insumo.unidade || "un",
          detalhe: "Insumo abaixo do estoque minimo do deposito",
        };
      })
      .filter(Boolean);

    return [
      ...sugestoesLoja,
      ...Array.from(sugestoesProdutoMap.values()),
      ...Array.from(sugestoesMaquinasPorLojaMap.values()),
      ...sugestoesPecas,
      ...sugestoesInsumos,
    ]
      .filter((sugestao) => {
        if (filtrosSugestao.tipo !== "todos" && sugestao.tipo !== filtrosSugestao.tipo) {
          return false;
        }
        if (filtrosSugestao.lojaId && sugestao.lojaId !== filtrosSugestao.lojaId) {
          return false;
        }
        if (!busca) return true;
        return [
          sugestao.titulo,
          sugestao.codigo,
          sugestao.lojaNome,
          sugestao.maquinas?.join(" "),
          sugestao.detalhe,
        ]
          .join(" ")
          .toLowerCase()
          .includes(busca);
      })
      .sort((a, b) => Number(b.comprar || 0) - Number(a.comprar || 0));
  }, [estoquesLojas, estoquesMaquinas, filtrosSugestao, insumos, lojas, maquinas, pecas]);

  const montarItemPedido = (dados = itemEmEdicao) => {
    const quantidadeNumerica = Number(dados.quantidade);
    if (!dados.nomeItem?.trim()) {
      throw new Error("Informe o nome do item.");
    }
    if (!Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0) {
      throw new Error("Informe uma quantidade valida (maior que zero).");
    }

    return {
      tipoItem: dados.tipoItem === "insumo" ? "INSUMO" : dados.tipoItem === "peca" ? "PECA" : "PRODUTO",
      itemNovo: Boolean(dados.itemNovo),
      nomeItem: dados.nomeItem.trim(),
      produtoId: dados.produtoId || null,
      insumoId: dados.insumoId || null,
      pecaId: dados.pecaId || null,
      sku: dados.sku?.trim() || null,
      lojaId: dados.lojaId || null,
      descricaoUso: dados.descricaoUso || null,
      quantidade: quantidadeNumerica,
      unidade: dados.tipoItem === "insumo" ? dados.unidade || null : "un",
      valorUnitario: dados.valorUnitario || null,
    };
  };

  const adicionarItemCompra = () => {
    try {
      const item = montarItemPedido();
      if (itemEditandoTempId) {
        setItensCompra((prev) =>
          prev.map((atual) =>
            atual.tempId === itemEditandoTempId ? { ...item, tempId: itemEditandoTempId } : atual,
          ),
        );
        setSuccess("Item atualizado na lista do pedido.");
      } else {
        setItensCompra((prev) => [...prev, { ...item, tempId: crypto.randomUUID() }]);
        setSuccess("Item adicionado na lista do pedido.");
      }
      setItemEmEdicao(itemPedidoVazio);
      setItemEditandoTempId(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const editarItemCompra = (item) => {
    setItemEmEdicao({
      tipoItem: item.tipoItem === "INSUMO" ? "insumo" : item.tipoItem === "PECA" ? "peca" : "produto",
      itemNovo: Boolean(item.itemNovo),
      nomeItem: item.nomeItem || "",
      produtoId: item.produtoId || "",
      insumoId: item.insumoId || "",
      pecaId: item.pecaId || "",
      sku: item.sku || "",
      quantidade: item.quantidade ?? "",
      unidade: item.unidade || "",
      valorUnitario: item.valorUnitario ?? "",
      lojaId: item.lojaId || "",
      descricaoUso: item.descricaoUso || "",
    });
    setItemEditandoTempId(item.tempId);
  };

  const cancelarEdicaoItemCompra = () => {
    setItemEmEdicao(itemPedidoVazio);
    setItemEditandoTempId(null);
  };

  const adicionarSugestaoNaCompra = (sugestao) => {
    setItensCompra((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        tipoItem: sugestao.tipo === "peca" ? "PECA" : sugestao.tipo === "insumo" ? "INSUMO" : "PRODUTO",
        nomeItem:
          sugestao.tipo === "peca"
            ? `Peca: ${sugestao.titulo}`
            : sugestao.tipo === "insumo"
              ? `Insumo: ${sugestao.titulo}`
              : sugestao.titulo,
        produtoId: sugestao.produtoId || null,
        pecaId: sugestao.pecaId || null,
        insumoId: sugestao.insumoId || null,
        sku: null,
        lojaId: sugestao.lojaId || null,
        descricaoUso:
          sugestao.tipo === "maquina"
            ? `${sugestao.lojaNome} - ${sugestao.maquinaNome}`
            : sugestao.detalhe,
        quantidade: Number(sugestao.comprar || 0),
        unidade: sugestao.unidade || "un",
        valorUnitario: null,
      },
    ]);
    setSecaoAtiva("novaCompra");
  };

  const atualizarItemCompra = (tempId, campo, valor) => {
    setItensCompra((prev) =>
      prev.map((item) =>
        item.tempId === tempId ? { ...item, [campo]: valor || null } : item,
      ),
    );
  };

  const removerItemCompra = (tempId) => {
    setItensCompra((prev) => prev.filter((item) => item.tempId !== tempId));
    if (itemEditandoTempId === tempId) {
      setItemEmEdicao(itemPedidoVazio);
      setItemEditandoTempId(null);
    }
  };

  const adicionarCustoAdicional = () => {
    setCustosAdicionais((prev) => [
      ...prev,
      { ...custoAdicionalVazio, tempId: crypto.randomUUID() },
    ]);
  };

  const atualizarCustoAdicional = (tempId, campo, valor) => {
    setCustosAdicionais((prev) =>
      prev.map((custo) => (custo.tempId === tempId ? { ...custo, [campo]: valor } : custo)),
    );
  };

  const removerCustoAdicional = (tempId) => {
    setCustosAdicionais((prev) => prev.filter((custo) => custo.tempId !== tempId));
  };

  const handleSelecionarFoto = async (event) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    try {
      setEnviandoFoto(true);
      const url = await enviarImagemParaCloudinary(arquivo);
      setForm((prev) => ({ ...prev, fotoUrl: url }));
    } catch {
      setError("Não foi possível enviar a foto. Tente novamente.");
    } finally {
      setEnviandoFoto(false);
      event.target.value = "";
    }
  };

  const handleCriarCompra = async (event) => {
    event.preventDefault();

    if (itensCompra.length === 0) {
      setError("Adicione ao menos um item ao pedido.");
      return;
    }

    if (form.tipoPagamento === "PARCELADO") {
      const quantidadeParcelasNumerica = Number(form.quantidadeParcelas);
      if (!Number.isInteger(quantidadeParcelasNumerica) || quantidadeParcelasNumerica < 2) {
        setError("Informe a quantidade de parcelas (mínimo 2) para pagamento parcelado.");
        return;
      }
    }

    if (enviandoFoto) {
      setError("Aguarde o envio da foto terminar.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post("/compras", {
        fornecedorId: form.fornecedorId || null,
        numeroPedido: form.numeroPedido || null,
        moeda: form.moeda,
        tipoPagamento: form.tipoPagamento || null,
        quantidadeParcelas: form.tipoPagamento === "PARCELADO" ? Number(form.quantidadeParcelas) : null,
        formaPagamento: form.formaPagamento || null,
        fotoUrl: form.fotoUrl || null,
        observacao: form.observacao || null,
        descontoTipo: form.descontoTipo || null,
        descontoValor: form.descontoTipo ? Number(form.descontoValor) : null,
        itens: itensCompra.map((item) => {
          const { tempId: _tempId, ...resto } = item;
          return resto;
        }),
        custosAdicionais: custosAdicionais.map((custo) => {
          const { tempId: _tempId, ...resto } = custo;
          return resto;
        }),
      });
      setForm(formInicial);
      setItensCompra([]);
      setItemEmEdicao(itemPedidoVazio);
      setItemEditandoTempId(null);
      setCustosAdicionais([]);
      setSuccess("Pedido de compra lançado.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao criar pedido de compra");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCriarEnvioDoItem = (compra, item) => {
    navigate("/envios", {
      state: {
        lojaDestinoId: item.lojaId,
        produtoId: item.produtoId,
        quantidade: item.quantidade,
      },
    });
  };

  const handleAtualizarStatus = async (id, novoStatus) => {
    const statusInfo = obterStatusInfo(novoStatus);
    const confirmado = await confirmar({
      title: `Dar como ${statusInfo.label.toLowerCase()}?`,
      text: "Depois de avançar o status, esta compra nao podera voltar para a etapa anterior.",
      confirmButtonText: `Dar como ${statusInfo.label.toLowerCase()}`,
    });
    if (!confirmado) return;

    try {
      setError("");
      await api.patch(`/compras/${id}/status`, { status: novoStatus });
      await carregarDados();
      setSuccess(`Compra marcada como ${statusInfo.label.toLowerCase()}.`);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao atualizar status da compra");
    }
  };

  const abrirModalConferencia = (compra) => {
    setCompraParaConferir(compra);
    setConferenciaForm(
      (compra.itens || []).map((item) => ({
        id: item.id,
        nomeItem: item.nomeItem,
        unidade: item.unidade || "un",
        quantidade: Number(item.quantidade),
        quantidadeRecebida:
          item.quantidadeRecebida !== null && item.quantidadeRecebida !== undefined
            ? String(item.quantidadeRecebida)
            : String(item.quantidade),
      })),
    );
    setMostrarModalConferencia(true);
  };

  const atualizarQuantidadeConferencia = (itemId, valor) => {
    setConferenciaForm((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, quantidadeRecebida: valor } : item)),
    );
  };

  const salvarConferencia = async () => {
    if (!compraParaConferir) return;

    for (const item of conferenciaForm) {
      const valor = Number(item.quantidadeRecebida);
      if (!Number.isFinite(valor) || valor < 0) {
        setError(`Informe uma quantidade recebida válida para "${item.nomeItem}".`);
        return;
      }
    }

    try {
      setSalvandoConferencia(true);
      setError("");
      const response = await api.patch(`/compras/${compraParaConferir.id}/conferencia`, {
        itens: conferenciaForm.map((item) => ({
          id: item.id,
          quantidadeRecebida: Number(item.quantidadeRecebida),
        })),
      });
      setMostrarModalConferencia(false);
      setCompraParaConferir(null);
      setConferenciaForm([]);
      setSuccess(
        response.data?.possuiPendencia
          ? "Recebimento conferido — há itens em falta nesta compra. Confira a aba Pendências."
          : "Recebimento conferido, tudo certo!",
      );
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao conferir recebimento");
    } finally {
      setSalvandoConferencia(false);
    }
  };

  const abrirModalParcelas = (compra) => {
    const quantidadeParcelas =
      compra.tipoPagamento === "PARCELADO" ? Number(compra.quantidadeParcelas) || 1 : 1;
    const valorBase = Number((compra.valorGeralPedido / quantidadeParcelas).toFixed(2));
    const parcelas = Array.from({ length: quantidadeParcelas }, (_, index) => {
      const ultima = index === quantidadeParcelas - 1;
      const valorAcumulado = Number((valorBase * (quantidadeParcelas - 1)).toFixed(2));
      return {
        numeroParcela: index + 1,
        vencimento: "",
        valor: ultima
          ? Number((compra.valorGeralPedido - valorAcumulado).toFixed(2))
          : valorBase,
        cotacaoDolar: "",
        formaPagamento: compra.formaPagamento || "PIX",
      };
    });
    setCompraParaGerarParcelas(compra);
    setParcelasForm(parcelas);
    setMostrarModalParcelas(true);
  };

  const atualizarParcelaForm = (index, campo, valor) => {
    setParcelasForm((prev) =>
      prev.map((parcela, parcelaIndex) =>
        parcelaIndex === index ? { ...parcela, [campo]: valor } : parcela,
      ),
    );
  };

  const salvarParcelas = async () => {
    if (!compraParaGerarParcelas) return;

    for (const parcela of parcelasForm) {
      if (!parcela.vencimento) {
        setError(`Informe o vencimento da parcela ${parcela.numeroParcela}.`);
        return;
      }
      if (!Number(parcela.valor) || Number(parcela.valor) <= 0) {
        setError(`Informe um valor válido para a parcela ${parcela.numeroParcela}.`);
        return;
      }
    }

    try {
      setSalvandoParcelas(true);
      setError("");
      await api.post(`/compras/${compraParaGerarParcelas.id}/contas-pagar`, {
        parcelas: parcelasForm.map((parcela) => ({
          numeroParcela: parcela.numeroParcela,
          vencimento: parcela.vencimento,
          valor: Number(parcela.valor),
          cotacaoDolar: parcela.cotacaoDolar ? Number(parcela.cotacaoDolar) : null,
          formaPagamento: parcela.formaPagamento,
        })),
      });
      setMostrarModalParcelas(false);
      setCompraParaGerarParcelas(null);
      setSuccess("Contas a pagar geradas.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao gerar contas a pagar");
    } finally {
      setSalvandoParcelas(false);
    }
  };

  const aplicarFiltrosCompras = (event) => {
    event.preventDefault();
    setFiltrosComprasAplicados({ ...filtrosCompras });
  };

  const limparFiltrosCompras = () => {
    setFiltrosCompras(filtrosComprasIniciais);
    setFiltrosComprasAplicados(filtrosComprasIniciais);
  };

  const handleBuscarHistorico = async (event) => {
    event.preventDefault();
    if (!buscaHistorico.trim()) return;

    try {
      setBuscandoHistorico(true);
      setError("");
      const response = await api.get("/compras/historico-precos", {
        params: { nomeItem: buscaHistorico.trim() },
      });
      const registros = Array.isArray(response.data) ? response.data : [];

      const agrupado = new Map();
      registros.forEach((registro) => {
        const chave = registro.compra?.fornecedor?.nome || "Sem fornecedor";
        if (!agrupado.has(chave)) agrupado.set(chave, []);
        agrupado.get(chave).push(registro);
      });

      setHistorico(Array.from(agrupado.entries()));
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao buscar histórico de preços");
    } finally {
      setBuscandoHistorico(false);
    }
  };

  const criarFornecedorInline = async () => {
    if (!novoFornecedorInline.nome.trim()) {
      setError("Informe o nome do fornecedor.");
      return;
    }

    try {
      setSalvandoFornecedorInline(true);
      setError("");
      const response = await api.post("/fornecedores", {
        nome: novoFornecedorInline.nome.trim(),
        contato: novoFornecedorInline.contato.trim() || null,
        telefoneWhatsapp: novoFornecedorInline.telefoneWhatsapp.trim() || null,
        cidade: novoFornecedorInline.cidade.trim() || null,
        ativo: true,
        produtos: [],
        anexos: [],
      });
      const fornecedorCriado = response.data;
      setFornecedores((prev) =>
        [...prev, fornecedorCriado].sort((a, b) =>
          String(a.nome || "").localeCompare(String(b.nome || "")),
        ),
      );
      setForm((prev) => ({ ...prev, fornecedorId: fornecedorCriado.id }));
      setNovoFornecedorInline(fornecedorInlineVazio);
      setMostrarNovoFornecedorInline(false);
      setSuccess("Fornecedor cadastrado.");
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao cadastrar fornecedor.");
    } finally {
      setSalvandoFornecedorInline(false);
    }
  };

  // --- Fornecedores (cadastro + comparação de preços) ---

  const fornecedoresFiltrados = useMemo(() => {
    const busca = filtroFornecedor.busca.trim().toLowerCase();
    const produtoBusca = filtroFornecedor.produto.trim().toLowerCase();
    const filtrados = fornecedores.filter((fornecedor) => {
      const produtos = fornecedor.produtos || [];
      const anexos = fornecedor.anexos || [];
      const textoFornecedor = [
        fornecedor.nome,
        fornecedor.contato,
        fornecedor.telefoneWhatsapp,
        fornecedor.cidade,
      ]
        .join(" ")
        .toLowerCase();
      const produtosTexto = fornecedor.produtos
        ?.map((produto) => produto.produtoNome)
        .join(" ")
        .toLowerCase();

      if (filtroFornecedor.status === "ativos" && fornecedor.ativo === false) {
        return false;
      }
      if (filtroFornecedor.status === "inativos" && fornecedor.ativo !== false) {
        return false;
      }
      if (filtroFornecedor.conteudo === "comProdutos" && produtos.length === 0) {
        return false;
      }
      if (filtroFornecedor.conteudo === "comAnexos" && anexos.length === 0) {
        return false;
      }
      if (busca && !textoFornecedor.includes(busca)) return false;
      if (produtoBusca && !produtosTexto?.includes(produtoBusca)) return false;
      return true;
    });

    return [...filtrados].sort((a, b) => {
      if (filtroFornecedor.ordenacao === "maisProdutos") {
        return (b.produtos?.length || 0) - (a.produtos?.length || 0);
      }
      if (filtroFornecedor.ordenacao === "cidade") {
        return String(a.cidade || "").localeCompare(String(b.cidade || ""));
      }
      return String(a.nome || "").localeCompare(String(b.nome || ""));
    });
  }, [fornecedores, filtroFornecedor]);

  const resumoFornecedores = useMemo(
    () => ({
      total: fornecedores.length,
      ativos: fornecedores.filter((fornecedor) => fornecedor.ativo !== false).length,
      comProdutos: fornecedores.filter((fornecedor) => fornecedor.produtos?.length > 0)
        .length,
      comAnexos: fornecedores.filter((fornecedor) => fornecedor.anexos?.length > 0)
        .length,
    }),
    [fornecedores],
  );

  const comparacoesFiltradas = useMemo(() => {
    const produtoBusca = filtroFornecedor.produto.trim().toLowerCase();
    if (!produtoBusca) return comparacoes;
    return comparacoes.filter((item) =>
      String(item.produto || "").toLowerCase().includes(produtoBusca),
    );
  }, [comparacoes, filtroFornecedor.produto]);

  const abrirNovoFornecedor = () => {
    setEditandoFornecedor(null);
    setFormFornecedor({
      ...fornecedorFormVazio,
      produtos: [],
      anexos: [],
    });
    setMostrarModalFornecedor(true);
  };

  const abrirEdicaoFornecedor = (fornecedor) => {
    setEditandoFornecedor(fornecedor);
    setFormFornecedor({
      nome: fornecedor.nome || "",
      contato: fornecedor.contato || "",
      telefoneWhatsapp: fornecedor.telefoneWhatsapp || "",
      cidade: fornecedor.cidade || "",
      observacoes: fornecedor.observacoes || "",
      ativo: fornecedor.ativo !== false,
      produtos:
        fornecedor.produtos?.map((produto) => ({
          tipo: "produto",
          itemNovo: true,
          produtoNome: produto.produtoNome || "",
          quantidade: produto.quantidade || "",
          unidade: produto.unidade || "un",
          preco: produto.preco || "",
          observacoes: produto.observacoes || "",
        })) || [],
      anexos:
        fornecedor.anexos?.map((anexo) => ({
          titulo: anexo.titulo || "",
          url: anexo.url || "",
          tipo: anexo.tipo || "ORCAMENTO",
        })) || [],
    });
    setMostrarModalFornecedor(true);
  };

  const salvarFornecedor = async (event) => {
    event.preventDefault();
    try {
      setError("");
      const payload = limparPayloadFornecedor(formFornecedor);
      if (editandoFornecedor) {
        await api.put(`/fornecedores/${editandoFornecedor.id}`, payload);
        setSuccess("Fornecedor atualizado.");
      } else {
        await api.post("/fornecedores", payload);
        setSuccess("Fornecedor cadastrado.");
      }
      setMostrarModalFornecedor(false);
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao salvar fornecedor.");
    }
  };

  const excluirFornecedor = async (fornecedor) => {
    const confirmado = await confirmar({
      title: "Remover fornecedor?",
      text: `Fornecedor: ${fornecedor.nome}`,
      confirmButtonText: "Remover",
    });
    if (!confirmado) return;
    try {
      await api.delete(`/fornecedores/${fornecedor.id}`);
      setSuccess("Fornecedor removido.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao remover fornecedor.");
    }
  };

  const atualizarProdutoFornecedor = (index, campo, valor) => {
    setFormFornecedor((prev) => ({
      ...prev,
      produtos: prev.produtos.map((produto, produtoIndex) =>
        produtoIndex === index ? { ...produto, [campo]: valor } : produto,
      ),
    }));
  };

  const atualizarAnexoFornecedor = (index, campo, valor) => {
    setFormFornecedor((prev) => ({
      ...prev,
      anexos: prev.anexos.map((anexo, anexoIndex) =>
        anexoIndex === index ? { ...anexo, [campo]: valor } : anexo,
      ),
    }));
  };

  if (loading || authLoading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Compras"
          subtitle={`Usuário: ${usuario?.nome || "-"} (${usuario?.role || "-"})`}
          icon="🛒"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox
            type="success"
            message={success}
            onClose={() => setSuccess("")}
          />
        )}

        <div className="card">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              {
                key: "fornecedores",
                title: "Cadastrar fornecedor",
                subtitle: "Salvar contatos, produtos, custos e anexos.",
              },
              {
                key: "pesquisa",
                title: "Pesquisa de mercado",
                subtitle: "Comparar custos e consultar histórico.",
              },
              {
                key: "novaCompra",
                title: "Compras",
                subtitle: "Lancar pedidos de compra.",
              },
              {
                key: "statusCompra",
                title: "Status de compra",
                subtitle: "Avancar para comprado e conferir recebimento.",
              },
              {
                key: "pendencias",
                title: "Pendências",
                subtitle: "Itens que faltaram na conferência.",
                contador: comprasComPendencia.length,
              },
              {
                key: "sugestoes",
                title: "Sugestao de compra",
                subtitle: "Ver faltas por loja, produto e pecas.",
              },
            ].map((opcao) => {
              const ativo = secaoAtiva === opcao.key;
              return (
                <button
                  key={opcao.key}
                  type="button"
                  onClick={() => setSecaoAtiva(opcao.key)}
                  className={`relative rounded-lg border px-4 py-3 text-left transition ${
                    ativo
                      ? "border-primary bg-primary text-white shadow-md"
                      : "border-slate-200 bg-white text-gray-900 hover:border-primary/50 hover:bg-orange-50"
                  }`}
                >
                  {Boolean(opcao.contador) && (
                    <span className="absolute -top-2 -right-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow">
                      {opcao.contador}
                    </span>
                  )}
                  <span className="block text-sm font-bold">{opcao.title}</span>
                  <span
                    className={`mt-1 block text-xs ${
                      ativo ? "text-white/85" : "text-gray-500"
                    }`}
                  >
                    {opcao.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {secaoAtiva === "sugestoes" && (
          <div className="card">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Sugestao de compra
                </h2>
                <p className="text-sm text-gray-500">
                  Veja faltas consolidadas por loja, produto, pecas e insumos, depois mande para a compra.
                </p>
              </div>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                {sugestoesCompra.length} sugestoes
              </span>
            </div>

            <div className="mb-5 rounded-lg border border-orange-100 bg-orange-50/70 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg">
                    🔎
                  </span>
                  <input
                    value={filtrosSugestao.busca}
                    onChange={(e) =>
                      setFiltrosSugestao((prev) => ({
                        ...prev,
                        busca: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-orange-200 bg-white py-3 pl-10 pr-3 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-orange-100"
                  placeholder="Buscar produto, loja, peca ou insumo"
                  />
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-orange-200 bg-white px-4 py-3 text-sm font-bold text-orange-700 hover:bg-orange-100"
                  onClick={() =>
                    setFiltrosSugestao({
                      busca: "",
                      tipo: "todos",
                      lojaId: "",
                      maquinaId: "",
                    })
                  }
                >
                  Limpar
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["todos", "Todos"],
                  ["loja", "Por loja"],
                  ["produto", "Por produto"],
                  ["peca", "Pecas"],
                  ["insumo", "Insumos"],
                ].map(([value, label]) => {
                  const ativo = filtrosSugestao.tipo === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setFiltrosSugestao((prev) => ({ ...prev, tipo: value }))
                      }
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                        ativo
                          ? "border-primary bg-primary text-white shadow-sm"
                          : "border-orange-200 bg-white text-gray-700 hover:bg-orange-100"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() =>
                    setFiltrosSugestao((prev) => ({ ...prev, lojaId: "" }))
                  }
                  className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${
                    !filtrosSugestao.lojaId
                      ? "border-red-400 bg-white text-red-700 shadow-sm"
                      : "border-orange-200 bg-white/70 text-gray-600 hover:bg-white"
                  }`}
                >
                  Todas as lojas
                </button>
                {lojas.map((loja) => {
                  const ativo = filtrosSugestao.lojaId === loja.id;
                  return (
                    <button
                      key={loja.id}
                      type="button"
                      onClick={() =>
                        setFiltrosSugestao((prev) => ({
                          ...prev,
                          lojaId: loja.id,
                        }))
                      }
                      className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${
                        ativo
                          ? "border-red-400 bg-white text-red-700 shadow-sm"
                          : "border-orange-200 bg-white/70 text-gray-600 hover:bg-white"
                      }`}
                    >
                      {loja.nome}
                    </button>
                  );
                })}
              </div>
            </div>

            {sugestoesCompra.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-gray-500">
                Nenhuma sugestao encontrada com os filtros atuais.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {sugestoesCompra.map((sugestao) => (
                  <article
                    key={sugestao.id}
                    className="rounded-lg border border-orange-100 bg-white p-4 shadow-sm transition hover:border-orange-300 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-gray-900">{sugestao.titulo}</h3>
                          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold uppercase text-orange-700">
                            {sugestao.tipo}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-600">
                          {sugestao.lojaNome || "Geral"}
                          {sugestao.maquinaNome ? ` - ${sugestao.maquinaNome}` : ""}
                          {sugestao.codigo ? ` - Cod: ${sugestao.codigo}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-black text-red-700">
                        Comprar {sugestao.comprar} {sugestao.unidade || "un"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <p className="font-bold text-gray-500">Atual</p>
                        <p className="text-base font-black text-gray-900">
                          {sugestao.atual ?? "-"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-orange-100 bg-orange-50 p-3">
                        <p className="font-bold text-orange-700">Minimo</p>
                        <p className="text-base font-black text-orange-800">
                          {sugestao.minimo ?? "-"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                        <p className="font-bold text-red-700">Falta</p>
                        <p className="text-base font-black text-red-800">
                          {sugestao.faltaCapacidade ?? sugestao.faltaMinimo ?? "-"}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-gray-500">{sugestao.detalhe}</p>

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        className="btn-primary px-4 py-2 text-sm"
                        onClick={() => adicionarSugestaoNaCompra(sugestao)}
                      >
                        Adicionar na compra
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {secaoAtiva === "novaCompra" && (
          <>
        <form onSubmit={handleCriarCompra} className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Novo pedido de compra</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Fornecedor
              </label>
              {!mostrarNovoFornecedorInline ? (
                <>
                  <select
                    value={form.fornecedorId}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, fornecedorId: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {fornecedores.map((fornecedor) => (
                      <option key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setMostrarNovoFornecedorInline(true)}
                      className="text-xs font-bold text-primary hover:text-primary/80"
                    >
                      + Cadastrar novo fornecedor
                    </button>
                    <a
                      href="#fornecedores"
                      className="text-xs font-bold text-primary hover:text-primary/80"
                    >
                      Ver fornecedores e comparar preços ↓
                    </a>
                  </div>
                </>
              ) : (
                <div className="space-y-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
                  <input
                    value={novoFornecedorInline.nome}
                    onChange={(e) =>
                      setNovoFornecedorInline((prev) => ({
                        ...prev,
                        nome: e.target.value,
                      }))
                    }
                    placeholder="Nome do fornecedor"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <input
                    value={novoFornecedorInline.contato}
                    onChange={(e) =>
                      setNovoFornecedorInline((prev) => ({
                        ...prev,
                        contato: e.target.value,
                      }))
                    }
                    placeholder="Contato (opcional)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <input
                    value={novoFornecedorInline.telefoneWhatsapp}
                    onChange={(e) =>
                      setNovoFornecedorInline((prev) => ({
                        ...prev,
                        telefoneWhatsapp: e.target.value,
                      }))
                    }
                    placeholder="Telefone/WhatsApp (opcional)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <input
                    value={novoFornecedorInline.cidade}
                    onChange={(e) =>
                      setNovoFornecedorInline((prev) => ({
                        ...prev,
                        cidade: e.target.value,
                      }))
                    }
                    placeholder="Cidade (opcional)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={criarFornecedorInline}
                      disabled={salvandoFornecedorInline}
                      className="btn-primary px-3 py-2 text-xs disabled:opacity-60"
                    >
                      {salvandoFornecedorInline ? "Salvando..." : "Salvar fornecedor"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMostrarNovoFornecedorInline(false);
                        setNovoFornecedorInline(fornecedorInlineVazio);
                      }}
                      className="btn-secondary px-3 py-2 text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Moeda
              </label>
              <div className="flex gap-2">
                {[
                  ["BRL", "R$ (BRL)"],
                  ["USD", "US$ (USD)"],
                ].map(([value, label]) => {
                  const ativo = form.moeda === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, moeda: value }))}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                        ativo
                          ? "border-primary bg-primary text-white shadow-sm"
                          : "border-orange-200 bg-white text-gray-700 hover:bg-orange-100"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Número do pedido
              </label>
              <input
                value={form.numeroPedido}
                onChange={(e) => setForm((prev) => ({ ...prev, numeroPedido: e.target.value }))}
                placeholder="Ex: 1024 ou NF-00123 (opcional)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Previsão de pagamento
              </label>
              <div className="flex flex-wrap gap-2">
                {TIPOS_PAGAMENTO.map(([value, label]) => {
                  const ativo = form.tipoPagamento === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          tipoPagamento: value,
                          quantidadeParcelas: value === "PARCELADO" ? prev.quantidadeParcelas : "",
                        }))
                      }
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                        ativo
                          ? "border-primary bg-primary text-white shadow-sm"
                          : "border-orange-200 bg-white text-gray-700 hover:bg-orange-100"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {form.tipoPagamento === "PARCELADO" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Quantidade de parcelas
                </label>
                <input
                  type="number"
                  min="2"
                  step="1"
                  value={form.quantidadeParcelas}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, quantidadeParcelas: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div className={form.tipoPagamento === "PARCELADO" ? "md:col-span-2" : "md:col-span-3"}>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Forma de pagamento
              </label>
              <div className="flex flex-wrap gap-2">
                {FORMAS_PAGAMENTO.map(([value, label]) => {
                  const ativo = form.formaPagamento === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, formaPagamento: value }))}
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                        ativo
                          ? "border-primary bg-primary text-white shadow-sm"
                          : "border-orange-200 bg-white text-gray-700 hover:bg-orange-100"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Foto (nota/orçamento/produto)
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleSelecionarFoto}
                disabled={enviandoFoto}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
              {enviandoFoto && (
                <p className="mt-1 text-xs text-gray-500">Enviando foto...</p>
              )}
              {!enviandoFoto && form.fotoUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={form.fotoUrl}
                    alt="Comprovante"
                    className="h-14 w-14 rounded-lg border border-gray-300 object-cover"
                  />
                  <span className="text-xs font-semibold text-green-700">
                    ✅ Foto anexada
                  </span>
                </div>
              )}
            </div>

            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Observação
              </label>
              <textarea
                value={form.observacao}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, observacao: e.target.value }))
                }
                className="min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50 p-3">
            <h3 className="text-sm font-bold text-gray-900">Itens do pedido</h3>
            <p className="mb-3 text-xs text-gray-600">
              Adicione produtos, insumos ou peças. Cada item pode vir do catálogo ou ser novo.
            </p>

            {itemEditandoTempId && (
              <p className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
                Editando item da lista. Altere os campos abaixo e clique em "Salvar alterações do item".
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 rounded-lg border border-orange-200 bg-white p-3 md:grid-cols-3">
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Tipo de item
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["produto", "Produto"],
                    ["insumo", "Insumo"],
                    ["peca", "Peça"],
                  ].map(([value, label]) => {
                    const ativo = itemEmEdicao.tipoItem === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setItemEmEdicao((prev) => ({
                            ...itemPedidoVazio,
                            tipoItem: value,
                            itemNovo: prev.itemNovo,
                          }))
                        }
                        className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                          ativo
                            ? "border-primary bg-primary text-white shadow-sm"
                            : "border-orange-200 bg-white text-gray-700 hover:bg-orange-100"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={itemEmEdicao.itemNovo}
                    onChange={(e) =>
                      setItemEmEdicao((prev) => ({
                        ...prev,
                        itemNovo: e.target.checked,
                        produtoId: "",
                        insumoId: "",
                        pecaId: "",
                        nomeItem: "",
                      }))
                    }
                  />
                  Este {rotuloTipoItem(itemEmEdicao.tipoItem)} ainda não existe no catálogo (cadastrar novo)
                </label>
              </div>

              {itemEmEdicao.itemNovo ? (
                <div className="md:col-span-3">
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Nome do {rotuloTipoItem(itemEmEdicao.tipoItem)} novo
                  </label>
                  <input
                    value={itemEmEdicao.nomeItem}
                    onChange={(e) =>
                      setItemEmEdicao((prev) => ({ ...prev, nomeItem: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                    placeholder="Ex: Pelúcia urso 30cm"
                  />
                </div>
              ) : (
                <div className="md:col-span-3">
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    {itemEmEdicao.tipoItem === "produto"
                      ? "Produto"
                      : itemEmEdicao.tipoItem === "insumo"
                        ? "Insumo"
                        : "Peça"}{" "}
                    do catálogo
                  </label>
                  <select
                    value={
                      itemEmEdicao.tipoItem === "produto"
                        ? itemEmEdicao.produtoId
                        : itemEmEdicao.tipoItem === "insumo"
                          ? itemEmEdicao.insumoId
                          : itemEmEdicao.pecaId
                    }
                    onChange={(e) => {
                      const id = e.target.value;
                      const lista =
                        itemEmEdicao.tipoItem === "produto"
                          ? produtos
                          : itemEmEdicao.tipoItem === "insumo"
                            ? insumos
                            : pecas;
                      const selecionado = lista.find((item) => item.id === id);
                      atualizarItemEmEdicaoComPreco({
                        produtoId: itemEmEdicao.tipoItem === "produto" ? id : "",
                        insumoId: itemEmEdicao.tipoItem === "insumo" ? id : "",
                        pecaId: itemEmEdicao.tipoItem === "peca" ? id : "",
                        nomeItem: selecionado?.nome || "",
                      });
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {(itemEmEdicao.tipoItem === "produto"
                      ? produtos
                      : itemEmEdicao.tipoItem === "insumo"
                        ? insumos
                        : pecas
                    ).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  SKU (opcional)
                </label>
                <input
                  value={itemEmEdicao.sku}
                  onChange={(e) =>
                    setItemEmEdicao((prev) => ({ ...prev, sku: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Quantidade
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={itemEmEdicao.quantidade}
                  onChange={(e) =>
                    setItemEmEdicao((prev) => ({ ...prev, quantidade: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Unidade
                </label>
                {itemEmEdicao.tipoItem === "insumo" ? (
                  <input
                    value={itemEmEdicao.unidade}
                    onChange={(e) =>
                      setItemEmEdicao((prev) => ({ ...prev, unidade: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                    placeholder="Ex: kg, m, litro"
                  />
                ) : (
                  <input
                    value="un"
                    disabled
                    className="w-full cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500 outline-none"
                  />
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Valor unitário
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemEmEdicao.valorUnitario}
                  onChange={(e) =>
                    setItemEmEdicao((prev) => ({ ...prev, valorUnitario: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                />
                {valorTotalPreview !== null && (
                  <p className="mt-1 text-xs text-gray-500">
                    Valor do item: {formatarPorMoeda(valorTotalPreview, form.moeda)}
                  </p>
                )}
                {precoFornecedorSelecionado && (
                  <p className="mt-1 text-xs font-semibold text-green-700">
                    Preco do fornecedor aplicado:{" "}
                    {formatarPorMoeda(precoFornecedorSelecionado, form.moeda)}
                  </p>
                )}
              </div>

              {itemEmEdicaoTemProduto && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      Loja onde será usado (opcional)
                    </label>
                    <select
                      value={itemEmEdicao.lojaId}
                      onChange={(e) =>
                        setItemEmEdicao((prev) => ({ ...prev, lojaId: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                    >
                      <option value="">Nenhuma</option>
                      {lojas.map((loja) => (
                        <option key={loja.id} value={loja.id}>
                          {loja.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      Onde será usado (detalhe)
                    </label>
                    <input
                      value={itemEmEdicao.descricaoUso}
                      onChange={(e) =>
                        setItemEmEdicao((prev) => ({ ...prev, descricaoUso: e.target.value }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                      placeholder="Ex: Máquina 5, Fabricação de pelúcia..."
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-3 flex justify-end gap-2">
                {itemEditandoTempId && (
                  <button
                    type="button"
                    className="btn-secondary px-4 py-2 text-sm"
                    onClick={cancelarEdicaoItemCompra}
                  >
                    Cancelar edição
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary px-4 py-2 text-sm"
                  onClick={adicionarItemCompra}
                >
                  {itemEditandoTempId ? "Salvar alterações do item" : "+ Adicionar item na lista"}
                </button>
              </div>
            </div>

            {itensCompra.length > 0 && (
              <div className="mt-3 space-y-2">
                {itensCompra.map((item) => (
                  <div
                    key={item.tempId}
                    className="rounded-lg border border-orange-200 bg-white p-3 text-sm"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900">
                          {item.nomeItem}
                          {item.sku ? ` (${item.sku})` : ""}
                        </p>
                        <p className="text-xs text-gray-600">
                          {item.tipoItem} — {[item.loja?.nome, item.descricaoUso]
                            .filter(Boolean)
                            .join(" — ") || "Sem destino definido"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2 text-xs"
                          onClick={() => editarItemCompra(item)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-danger px-3 py-2 text-xs"
                          onClick={() => removerItemCompra(item.tempId)}
                        >
                          Remover
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                          Quantidade
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantidade || ""}
                          onChange={(e) =>
                            atualizarItemCompra(item.tempId, "quantidade", e.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                          Unidade
                        </label>
                        <input
                          value={item.unidade || ""}
                          onChange={(e) =>
                            atualizarItemCompra(item.tempId, "unidade", e.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                          Valor unitário
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.valorUnitario || ""}
                          onChange={(e) =>
                            atualizarItemCompra(item.tempId, "valorUnitario", e.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <p className="text-right text-sm font-bold text-gray-700">
                  Total dos itens: {formatarPorMoeda(valorTotalItens, form.moeda)}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
            <h3 className="text-sm font-bold text-gray-900">Desconto</h3>
            <p className="text-xs text-gray-600">
              Aplicado só sobre o total dos itens — não afeta os custos adicionais.
            </p>
            <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Tipo
                </label>
                <select
                  value={form.descontoTipo}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      descontoTipo: e.target.value,
                      descontoValor: e.target.value ? prev.descontoValor : "",
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                >
                  <option value="">Sem desconto</option>
                  {TIPOS_DESCONTO.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {form.descontoTipo && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    {form.descontoTipo === "PERCENTUAL" ? "Porcentagem (%)" : "Valor"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={form.descontoTipo === "PERCENTUAL" ? "100" : undefined}
                    step="0.01"
                    value={form.descontoValor}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, descontoValor: e.target.value }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>
              )}
              {form.descontoTipo && valorDescontoPreview > 0 && (
                <div className="flex flex-col justify-end text-xs text-gray-700">
                  <p>Desconto: -{formatarPorMoeda(valorDescontoPreview, form.moeda)}</p>
                  <p className="font-bold">
                    Itens com desconto: {formatarPorMoeda(valorItensComDescontoPreview, form.moeda)}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Custos adicionais</h3>
                <p className="text-xs text-gray-600">
                  Frete, impostos, taxas... cada um com sua forma de pagamento.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary px-4 py-2 text-sm"
                onClick={adicionarCustoAdicional}
              >
                + Adicionar custo
              </button>
            </div>

            {custosAdicionais.length > 0 && (
              <div className="mt-3 space-y-2">
                {custosAdicionais.map((custo) => (
                  <div
                    key={custo.tempId}
                    className="grid grid-cols-1 gap-3 rounded-lg border border-orange-200 bg-white p-3 md:grid-cols-6"
                  >
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                        Descrição
                      </label>
                      <input
                        value={custo.descricao}
                        onChange={(e) =>
                          atualizarCustoAdicional(custo.tempId, "descricao", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                        placeholder="Ex: Frete"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                        Tipo
                      </label>
                      <select
                        value={custo.tipoValor}
                        onChange={(e) =>
                          atualizarCustoAdicional(custo.tempId, "tipoValor", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                      >
                        {TIPOS_VALOR_CUSTO.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                        {custo.tipoValor === "PERCENTUAL" ? "Porcentagem (%)" : "Valor"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={custo.tipoValor === "PERCENTUAL" ? "100" : undefined}
                        step="0.01"
                        value={custo.valor}
                        onChange={(e) =>
                          atualizarCustoAdicional(custo.tempId, "valor", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                        Moeda
                      </label>
                      <select
                        value={custo.moeda}
                        onChange={(e) =>
                          atualizarCustoAdicional(custo.tempId, "moeda", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                      >
                        {MOEDAS_CUSTO.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <select
                        value={custo.formaPagamento}
                        onChange={(e) =>
                          atualizarCustoAdicional(custo.tempId, "formaPagamento", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                      >
                        {FORMAS_PAGAMENTO.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-danger px-3 py-2 text-xs"
                        onClick={() => removerCustoAdicional(custo.tempId)}
                      >
                        Remover
                      </button>
                    </div>
                    {custo.tipoValor === "PERCENTUAL" && (
                      <div className="md:col-span-3">
                        <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                          Calcular sobre
                        </label>
                        <select
                          value={custo.baseCalculo || "SEM_DESCONTO"}
                          onChange={(e) =>
                            atualizarCustoAdicional(custo.tempId, "baseCalculo", e.target.value)
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                        >
                          {BASES_CALCULO_CUSTO.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {custo.tipoValor === "PERCENTUAL" && Number(custo.valor) > 0 && (
                      <p className="md:col-span-3 self-end text-xs text-gray-600">
                        = {formatarPorMoeda(calcularValorCustoPreview(custo), custo.moeda)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 space-y-1 rounded-lg border border-gray-200 bg-white p-3 text-sm">
            <p className="flex justify-between text-gray-600">
              <span>Total dos itens</span>
              <span>{formatarPorMoeda(valorTotalItens, form.moeda)}</span>
            </p>
            {form.descontoTipo && valorDescontoPreview > 0 && (
              <>
                <p className="flex justify-between text-gray-600">
                  <span>Desconto</span>
                  <span>-{formatarPorMoeda(valorDescontoPreview, form.moeda)}</span>
                </p>
                <p className="flex justify-between text-gray-600">
                  <span>Itens com desconto</span>
                  <span>{formatarPorMoeda(valorItensComDescontoPreview, form.moeda)}</span>
                </p>
              </>
            )}
            {valorTotalCustosNaMoedaDoPedido > 0 && (
              <p className="flex justify-between text-gray-600">
                <span>Custos adicionais ({form.moeda})</span>
                <span>{formatarPorMoeda(valorTotalCustosNaMoedaDoPedido, form.moeda)}</span>
              </p>
            )}
            {outrasMoedasPreview.map(([moedaCusto, valor]) => (
              <p key={moedaCusto} className="flex justify-between text-gray-600">
                <span>Custos adicionais em outra moeda</span>
                <span>{formatarPorMoeda(valor, moedaCusto)}</span>
              </p>
            ))}
            <p className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold text-gray-900">
              <span>Total do pedido</span>
              <span>{formatarPorMoeda(valorTotalPedidoPreview, form.moeda)}</span>
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary disabled:opacity-60"
            >
              {submitting ? "Salvando..." : "Lançar pedido"}
            </button>
          </div>
        </form>
          </>
        )}

        {secaoAtiva === "statusCompra" && (
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Histórico de compras ({compras.length})
          </h2>

          <form
            onSubmit={aplicarFiltrosCompras}
            className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Fornecedor
                </label>
                <select
                  value={filtrosCompras.fornecedorId}
                  onChange={(e) =>
                    setFiltrosCompras((prev) => ({
                      ...prev,
                      fornecedorId: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Todos</option>
                  {fornecedores.map((fornecedor) => (
                    <option key={fornecedor.id} value={fornecedor.id}>
                      {fornecedor.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Produto ou item
                </label>
                <input
                  value={filtrosCompras.produto}
                  onChange={(e) =>
                    setFiltrosCompras((prev) => ({
                      ...prev,
                      produto: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder="Ex: pelúcia, urso, insumo..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Valor mín.
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={filtrosCompras.valorMin}
                    onChange={(e) =>
                      setFiltrosCompras((prev) => ({
                        ...prev,
                        valorMin: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Valor máx.
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={filtrosCompras.valorMax}
                    onChange={(e) =>
                      setFiltrosCompras((prev) => ({
                        ...prev,
                        valorMax: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    placeholder="5"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Data início
                </label>
                <input
                  type="date"
                  value={filtrosCompras.dataInicio}
                  onChange={(e) =>
                    setFiltrosCompras((prev) => ({
                      ...prev,
                      dataInicio: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  Data fim
                </label>
                <input
                  type="date"
                  value={filtrosCompras.dataFim}
                  onChange={(e) =>
                    setFiltrosCompras((prev) => ({
                      ...prev,
                      dataFim: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-end gap-2">
                <button type="submit" className="btn-primary flex-1">
                  Aplicar filtros
                </button>
                <button
                  type="button"
                  onClick={limparFiltrosCompras}
                  className="btn-secondary"
                >
                  Hoje
                </button>
              </div>
            </div>
          </form>

          {compras.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhuma compra registrada.</p>
          ) : (
            <div className="space-y-5">
              {comprasPorStatus.map((grupo) => (
                <section key={grupo.value} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold uppercase text-gray-700">
                        {grupo.label}
                      </h3>
                      <Badge variant={grupo.variant} size="sm">
                        {grupo.compras.length}
                      </Badge>
                    </div>
                  </div>

                  {grupo.compras.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-gray-500">
                      Nenhum pedido nesta etapa.
                    </p>
                  ) : (
                    grupo.compras.map((compra) => {
                      const statusAtual = normalizarStatusCompra(compra.status);
                      const statusInfo = obterStatusInfo(statusAtual);
                return (
                  <div
                    key={compra.id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">
                          {compra.numeroPedido ? `#${compra.numeroPedido} — ` : ""}
                          {compra.fornecedor?.nome || "Sem fornecedor"}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {compra.moeda} · {compra.itens?.length || 0} item(ns)
                          {compra.tipoPagamento
                            ? ` · ${TIPOS_PAGAMENTO.find(([v]) => v === compra.tipoPagamento)?.[1] || compra.tipoPagamento}`
                            : ""}
                          {compra.formaPagamento
                            ? ` · ${FORMAS_PAGAMENTO.find(([v]) => v === compra.formaPagamento)?.[1] || compra.formaPagamento}`
                            : ""}
                        </p>
                      </div>
                      <Badge variant={statusInfo.variant} size="sm">
                        {statusInfo.label}
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-2">
                      {(compra.itens || []).map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-700"
                        >
                          <span>
                            {item.nomeItem}
                            {item.sku ? ` (${item.sku})` : ""} — {item.quantidade}{" "}
                            {item.unidade || "un"} ×{" "}
                            {formatarPorMoeda(item.valorUnitario, compra.moeda)}
                            {statusAtual === "RECEBIDO" &&
                              Number(item.quantidadeRecebida || 0) < Number(item.quantidade) && (
                                <span className="ml-2 font-bold text-red-600">
                                  · recebido {item.quantidadeRecebida ?? 0}/{item.quantidade} — faltam{" "}
                                  {Number(item.quantidade) - Number(item.quantidadeRecebida || 0)}{" "}
                                  {item.unidade || "un"}
                                </span>
                              )}
                          </span>
                          <span className="font-semibold">
                            {formatarPorMoeda(item.valorTotal, compra.moeda)}
                          </span>
                        </div>
                      ))}
                      {compra.valorDesconto > 0 && (
                        <p className="text-xs text-gray-600">
                          Desconto (
                          {compra.descontoTipo === "PERCENTUAL"
                            ? `${numeroFormatado.format(Number(compra.descontoValor))}%`
                            : "valor fixo"}
                          ): -{formatarPorMoeda(compra.valorDesconto, compra.moeda)}
                        </p>
                      )}
                      {compra.custosAdicionais?.length > 0 && (
                        <div className="mt-1 border-t border-slate-200 pt-1">
                          {compra.custosAdicionais.map((custo) => (
                            <p key={custo.id} className="text-xs text-gray-600">
                              + {custo.descricao}
                              {custo.tipoValor === "PERCENTUAL"
                                ? ` (${numeroFormatado.format(Number(custo.valor))}%)`
                                : ""}
                              : {formatarPorMoeda(custo.valorCalculado ?? custo.valor, custo.moeda || compra.moeda)}{" "}
                              (
                              {FORMAS_PAGAMENTO.find(([v]) => v === custo.formaPagamento)?.[1] ||
                                custo.formaPagamento}
                              )
                            </p>
                          ))}
                        </div>
                      )}
                      {compra.custosAdicionaisOutrasMoedas?.length > 0 &&
                        compra.custosAdicionaisOutrasMoedas.map(({ moeda: moedaCusto, valor }) => (
                          <p key={moedaCusto} className="text-xs text-gray-600">
                            Custos adicionais em {moedaCusto}: {formatarPorMoeda(valor, moedaCusto)}
                          </p>
                        ))}
                      <p className="pt-1 text-right text-sm font-bold text-gray-900">
                        Total: {formatarPorMoeda(compra.valorGeralPedido, compra.moeda)}
                      </p>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-600 sm:grid-cols-2">
                      <p>Criado por: {compra.criadoPor?.nome || "-"}</p>
                      {compra.dataCompra && (
                        <p>
                          Comprado em: {compra.dataCompra} por{" "}
                          {compra.comprador?.nome || "-"}
                        </p>
                      )}
                      {compra.recebidoEm && (
                        <p>
                          Recebido em: {formatarDataHora(compra.recebidoEm)} por{" "}
                          {compra.recebidoPor?.nome || "-"}
                        </p>
                      )}
                    </div>

                    {compra.fotoUrl && (
                      <a
                        href={compra.fotoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block"
                      >
                        <img
                          src={compra.fotoUrl}
                          alt="Comprovante"
                          className="h-16 w-16 rounded-lg border border-gray-300 object-cover"
                        />
                      </a>
                    )}

                    {statusAtual === "RECEBIDO" &&
                      (compra.itens || [])
                        .filter((item) => item.produtoId && item.lojaId)
                        .map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleCriarEnvioDoItem(compra, item)}
                            className="mt-2 block text-sm font-bold text-primary hover:text-primary/80"
                          >
                            {item.nomeItem}: está no Depósito Principal — criar envio com
                            lacre para {item.loja?.nome} →
                          </button>
                        ))}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {statusAtual === "PESQUISANDO" && (
                        <button
                          type="button"
                          onClick={() => handleAtualizarStatus(compra.id, "COMPRADO")}
                          className="btn-primary px-4 py-2 text-sm"
                        >
                          Dar como comprado
                        </button>
                      )}
                      {statusAtual === "COMPRADO" && (
                        <button
                          type="button"
                          onClick={() => abrirModalConferencia(compra)}
                          className="btn-primary px-4 py-2 text-sm"
                        >
                          Conferir recebimento
                        </button>
                      )}
                      {statusAtual === "RECEBIDO" && !compra.possuiPendencia && (
                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
                          Compra finalizada
                        </span>
                      )}
                      {statusAtual === "RECEBIDO" && compra.possuiPendencia && (
                        <>
                          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                            ⚠️ Itens em falta
                          </span>
                          <button
                            type="button"
                            onClick={() => abrirModalConferencia(compra)}
                            className="btn-primary px-4 py-2 text-sm"
                          >
                            Completar recebimento
                          </button>
                        </>
                      )}
                      {compra.contasPagar?.length > 0 ? (
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                          Contas a pagar geradas ({compra.contasPagar.length})
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirModalParcelas(compra)}
                          className="btn-secondary px-4 py-2 text-sm"
                        >
                          Gerar contas a pagar
                        </button>
                      )}
                    </div>
                  </div>
                );
                    })
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
        )}

        {secaoAtiva === "pendencias" && (
          <div className="card">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Pendências de recebimento
                </h2>
                <p className="text-sm text-gray-500">
                  Compras conferidas onde a quantidade recebida ficou abaixo do pedido.
                </p>
              </div>
              <Badge variant="danger" size="sm">
                {comprasComPendencia.length}
              </Badge>
            </div>

            {comprasComPendencia.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-gray-500">
                Nenhuma pendência no momento.
              </p>
            ) : (
              <div className="space-y-4">
                {comprasComPendencia.map((compra) => {
                  const itensFaltantes = (compra.itens || []).filter(
                    (item) => Number(item.quantidadeRecebida || 0) < Number(item.quantidade),
                  );
                  return (
                    <div
                      key={compra.id}
                      className="rounded-lg border border-red-200 bg-red-50/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">
                            {compra.numeroPedido ? `#${compra.numeroPedido} — ` : ""}
                            {compra.fornecedor?.nome || "Sem fornecedor"}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {compra.moeda} · Recebido em{" "}
                            {formatarDataHora(compra.recebidoEm)} por{" "}
                            {compra.recebidoPor?.nome || "-"}
                          </p>
                        </div>
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                          {itensFaltantes.length} item(ns) em falta
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 rounded-lg border border-red-100 bg-white p-2">
                        {itensFaltantes.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-700"
                          >
                            <span>
                              {item.nomeItem}
                              {item.sku ? ` (${item.sku})` : ""}
                            </span>
                            <span className="font-bold text-red-700">
                              Pedido {item.quantidade} · Recebido {item.quantidadeRecebida ?? 0} ·
                              Faltam{" "}
                              {Number(item.quantidade) - Number(item.quantidadeRecebida || 0)}{" "}
                              {item.unidade || "un"}
                            </span>
                          </div>
                        ))}
                      </div>

                      <p className="mt-2 text-right text-sm font-bold text-gray-900">
                        Total do pedido: {formatarPorMoeda(compra.valorGeralPedido, compra.moeda)}
                      </p>

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => abrirModalConferencia(compra)}
                          className="btn-primary px-4 py-2 text-sm"
                        >
                          Completar recebimento
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {secaoAtiva === "pesquisa" && (
          <>
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Histórico de preços
          </h2>
          <form onSubmit={handleBuscarHistorico} className="flex gap-2">
            <input
              value={buscaHistorico}
              onChange={(e) => setBuscaHistorico(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              placeholder="Nome do item (ex: pelúcia urso)"
            />
            <button
              type="submit"
              disabled={buscandoHistorico}
              className="btn-secondary disabled:opacity-60"
            >
              {buscandoHistorico ? "Buscando..." : "Buscar"}
            </button>
          </form>

          {historico && (
            <div className="mt-4 space-y-4">
              {historico.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Nenhum histórico de compra encontrado para esse item.
                </p>
              ) : (
                historico.map(([fornecedorNome, registros]) => (
                  <div key={fornecedorNome}>
                    <p className="text-sm font-semibold text-gray-800">
                      {fornecedorNome}
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-gray-600">
                      {registros.map((registro) => (
                        <li key={registro.id}>
                          {registro.compra?.dataCompra || "-"} — {registro.nomeItem}:{" "}
                          {formatarMoeda(registro.valorUnitario)} / {registro.unidade || "un"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Pesquisa de mercado
              </h2>
              <p className="text-sm text-gray-500">
                Compare fornecedores pelo custo unitario dos produtos cadastrados.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              {comparacoesFiltradas.length} produtos
            </span>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Produto
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                value={filtroFornecedor.produto}
                onChange={(e) =>
                  setFiltroFornecedor((prev) => ({ ...prev, produto: e.target.value }))
                }
                placeholder="Ex: pelucia panda"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Fornecedor
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                value={filtroFornecedor.busca}
                onChange={(e) =>
                  setFiltroFornecedor((prev) => ({ ...prev, busca: e.target.value }))
                }
                placeholder="Ex: Atacado Centro"
              />
            </div>
          </div>

          <div className="space-y-3">
            {comparacoesFiltradas.map((comparacao) => (
              <article
                key={comparacao.produto}
                className="rounded-lg border border-slate-200 p-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-gray-900">{comparacao.produto}</h4>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                    Melhor: {moeda.format(Number(comparacao.melhorPrecoUnitario || 0))}/un
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  {comparacao.fornecedores.map((item, index) => (
                    <div
                      key={`${item.fornecedorId}-${item.produtoId}`}
                      className={`rounded-lg border p-3 text-sm ${
                        index === 0
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-gray-900">
                            {item.fornecedorNome}
                          </p>
                          <p className="text-xs text-gray-600">
                            {numeroFormatado.format(item.quantidade)} {item.unidade}{" "}
                            por {moeda.format(Number(item.preco || 0))}
                          </p>
                        </div>
                        <p className="font-bold text-gray-900">
                          {moeda.format(Number(item.precoUnitario || 0))}/un
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {comparacoesFiltradas.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-gray-500">
                Nenhum produto para comparar ainda.
              </div>
            )}
          </div>
        </div>
          </>
        )}

        {secaoAtiva === "fornecedores" && (
          <>
        <div id="fornecedores" className="card scroll-mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Cadastro de fornecedores
            </h2>
            <button type="button" className="btn-primary" onClick={abrirNovoFornecedor}>
              Cadastrar fornecedor
            </button>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Total</p>
              <p className="text-xl font-bold text-gray-900">{resumoFornecedores.total}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold text-emerald-700">Ativos</p>
              <p className="text-xl font-bold text-emerald-800">
                {resumoFornecedores.ativos}
              </p>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <p className="text-xs font-semibold text-orange-700">Com produtos</p>
              <p className="text-xl font-bold text-orange-800">
                {resumoFornecedores.comProdutos}
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-700">Com anexos</p>
              <p className="text-xl font-bold text-blue-800">
                {resumoFornecedores.comAnexos}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Fornecedor, contato ou cidade
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                value={filtroFornecedor.busca}
                onChange={(e) =>
                  setFiltroFornecedor((prev) => ({ ...prev, busca: e.target.value }))
                }
                placeholder="Ex: Atacado Centro"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Produto
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                value={filtroFornecedor.produto}
                onChange={(e) =>
                  setFiltroFornecedor((prev) => ({ ...prev, produto: e.target.value }))
                }
                placeholder="Ex: pelúcia panda"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                value={filtroFornecedor.status}
                onChange={(e) =>
                  setFiltroFornecedor((prev) => ({ ...prev, status: e.target.value }))
                }
              >
                <option value="ativos">Ativos</option>
                <option value="todos">Todos</option>
                <option value="inativos">Inativos</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Conteudo
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                value={filtroFornecedor.conteudo}
                onChange={(e) =>
                  setFiltroFornecedor((prev) => ({ ...prev, conteudo: e.target.value }))
                }
              >
                <option value="todos">Todos</option>
                <option value="comProdutos">Com produtos</option>
                <option value="comAnexos">Com anexos</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Ordenar por
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                value={filtroFornecedor.ordenacao}
                onChange={(e) =>
                  setFiltroFornecedor((prev) => ({ ...prev, ordenacao: e.target.value }))
                }
              >
                <option value="nome">Nome</option>
                <option value="cidade">Cidade</option>
                <option value="maisProdutos">Mais produtos</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setFiltroFornecedor({
                  busca: "",
                  produto: "",
                  status: "ativos",
                  conteudo: "todos",
                  ordenacao: "nome",
                })
              }
            >
              Limpar filtros
            </button>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">
                Fornecedores cadastrados
              </h3>
              <span className="text-xs font-semibold text-gray-500">
                {fornecedoresFiltrados.length} encontrados
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {fornecedoresFiltrados.map((fornecedor) => (
                <article
                  key={fornecedor.id}
                  className="rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-gray-900">{fornecedor.nome}</h4>
                        {!fornecedor.ativo && (
                          <Badge variant="danger" size="sm">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        {fornecedor.contato || "Sem contato"} —{" "}
                        {fornecedor.telefoneWhatsapp || "Sem WhatsApp"}
                      </p>
                      {fornecedor.cidade && (
                        <p className="text-xs text-gray-600">{fornecedor.cidade}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => abrirEdicaoFornecedor(fornecedor)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-danger text-xs"
                        onClick={() => excluirFornecedor(fornecedor)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                      {fornecedor.produtos?.length || 0} produtos
                    </span>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                      {fornecedor.anexos?.length || 0} anexos
                    </span>
                    {fornecedor.cidade && (
                      <span className="rounded-full bg-orange-50 px-2 py-1 text-orange-700">
                        {fornecedor.cidade}
                      </span>
                    )}
                  </div>

                  {fornecedor.observacoes && (
                    <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-gray-600">
                      {fornecedor.observacoes}
                    </p>
                  )}

                  <div className="mt-3 space-y-2">
                    {fornecedor.produtos?.map((produto) => (
                      <div
                        key={produto.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-gray-900">
                              {produto.produtoNome}
                            </p>
                            <p className="text-gray-600">
                              {numeroFormatado.format(Number(produto.quantidade || 0))}{" "}
                              {produto.unidade} por{" "}
                              {moeda.format(Number(produto.preco || 0))}
                            </p>
                          </div>
                          <span className="rounded-full bg-orange-50 px-2 py-0.5 font-bold text-orange-700">
                            {moeda.format(calcularUnitarioFornecedor(produto))}/un
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {fornecedor.anexos?.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-bold text-gray-700">
                        Fotos e orçamentos
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {fornecedor.anexos.map((anexo) => (
                          <a
                            key={anexo.id}
                            href={anexo.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700"
                          >
                            {anexo.titulo || anexo.tipo || "Anexo"}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))}
              {fornecedoresFiltrados.length === 0 && (
                <div className="col-span-full rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-gray-600">
                  Nenhum fornecedor encontrado.
                </div>
              )}
            </div>
          </div>
        </div>
          </>
        )}

        <Modal
          isOpen={mostrarModalParcelas}
          onClose={() => {
            setMostrarModalParcelas(false);
            setCompraParaGerarParcelas(null);
          }}
          title="Gerar contas a pagar"
          size="md"
        >
          {compraParaGerarParcelas && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {compraParaGerarParcelas.numeroPedido
                  ? `Pedido #${compraParaGerarParcelas.numeroPedido} de `
                  : "Pedido de "}
                {compraParaGerarParcelas.fornecedor?.nome || "fornecedor"} — total{" "}
                {formatarPorMoeda(
                  compraParaGerarParcelas.valorGeralPedido,
                  compraParaGerarParcelas.moeda,
                )}
              </p>

              {parcelasForm.map((parcela, index) => (
                <div
                  key={parcela.numeroParcela}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-4"
                >
                  <p className="sm:col-span-4 text-xs font-bold uppercase text-gray-500">
                    Parcela {parcela.numeroParcela}/{parcelasForm.length}
                  </p>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Vencimento</label>
                    <input
                      type="date"
                      value={parcela.vencimento}
                      onChange={(e) => atualizarParcelaForm(index, "vencimento", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Valor</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={parcela.valor}
                      onChange={(e) => atualizarParcelaForm(index, "valor", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  {compraParaGerarParcelas.moeda === "USD" && (
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">Cotação US$→R$</label>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={parcela.cotacaoDolar}
                        onChange={(e) =>
                          atualizarParcelaForm(index, "cotacaoDolar", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                        placeholder="Ex: 5.35"
                      />
                    </div>
                  )}
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Forma de pagamento</label>
                    <select
                      value={parcela.formaPagamento}
                      onChange={(e) =>
                        atualizarParcelaForm(index, "formaPagamento", e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                    >
                      {FORMAS_PAGAMENTO.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-secondary px-4 py-2 text-sm"
                  onClick={() => {
                    setMostrarModalParcelas(false);
                    setCompraParaGerarParcelas(null);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
                  disabled={salvandoParcelas}
                  onClick={salvarParcelas}
                >
                  {salvandoParcelas ? "Salvando..." : "Gerar contas a pagar"}
                </button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          isOpen={mostrarModalConferencia}
          onClose={() => {
            setMostrarModalConferencia(false);
            setCompraParaConferir(null);
            setConferenciaForm([]);
          }}
          title="Conferência de recebimento"
          size="md"
        >
          {compraParaConferir && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Confira quanto chegou de cada item de{" "}
                {compraParaConferir.fornecedor?.nome || "fornecedor"}. Itens abaixo do
                pedido geram uma pendência.
              </p>

              {conferenciaForm.map((item) => {
                const valorRecebido = Number(item.quantidadeRecebida);
                const faltando =
                  Number.isFinite(valorRecebido) && valorRecebido < item.quantidade
                    ? item.quantidade - valorRecebido
                    : 0;
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-3 sm:items-center"
                  >
                    <div className="sm:col-span-2">
                      <p className="text-sm font-semibold text-gray-800">{item.nomeItem}</p>
                      <p className="text-xs text-gray-500">
                        Pedido: {item.quantidade} {item.unidade}
                        {faltando > 0 && (
                          <span className="ml-2 font-bold text-red-600">
                            Faltam {faltando} {item.unidade}
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">
                        Quantidade recebida
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.quantidadeRecebida}
                        onChange={(e) =>
                          atualizarQuantidadeConferencia(item.id, e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-secondary px-4 py-2 text-sm"
                  onClick={() => {
                    setMostrarModalConferencia(false);
                    setCompraParaConferir(null);
                    setConferenciaForm([]);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
                  disabled={salvandoConferencia}
                  onClick={salvarConferencia}
                >
                  {salvandoConferencia ? "Salvando..." : "Confirmar recebimento"}
                </button>
              </div>
            </div>
          )}
        </Modal>

        {mostrarModalFornecedor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4">
            <form
              onSubmit={salvarFornecedor}
              className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-orange-100 bg-white p-4 shadow-2xl sm:p-5"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-gray-900">
                  {editandoFornecedor ? "Editar fornecedor" : "Cadastrar fornecedor"}
                </h2>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => setMostrarModalFornecedor(false)}
                >
                  Fechar
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nome *
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                    value={formFornecedor.nome}
                    onChange={(e) =>
                      setFormFornecedor({ ...formFornecedor, nome: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Contato
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                    value={formFornecedor.contato}
                    onChange={(e) =>
                      setFormFornecedor({ ...formFornecedor, contato: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Telefone/WhatsApp
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                    value={formFornecedor.telefoneWhatsapp}
                    onChange={(e) =>
                      setFormFornecedor({
                        ...formFornecedor,
                        telefoneWhatsapp: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Cidade
                  </label>
                  <input
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                    value={formFornecedor.cidade}
                    onChange={(e) =>
                      setFormFornecedor({ ...formFornecedor, cidade: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50/60 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-900">Produtos e custos</h3>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() =>
                      setFormFornecedor({
                        ...formFornecedor,
                        produtos: [
                          ...formFornecedor.produtos,
                          { ...produtoFornecedorVazio },
                        ],
                      })
                    }
                  >
                    Adicionar produto
                  </button>
                </div>
                <div className="space-y-2">
                  {formFornecedor.produtos.map((produto, index) => (
                    <div
                      key={`produto-${index}`}
                      className="rounded-lg border border-orange-100 bg-white p-2"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {[
                          ["produto", "Produto"],
                          ["insumo", "Insumo"],
                          ["peca", "Peça"],
                        ].map(([value, label]) => {
                          const ativo = (produto.tipo || "produto") === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                setFormFornecedor((prev) => ({
                                  ...prev,
                                  produtos: prev.produtos.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          tipo: value,
                                          produtoNome: "",
                                          unidade: value === "insumo" ? "" : "un",
                                        }
                                      : item,
                                  ),
                                }))
                              }
                              className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                                ativo
                                  ? "border-primary bg-primary text-white"
                                  : "border-orange-200 bg-white text-gray-700 hover:bg-orange-100"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                        <label className="ml-auto flex items-center gap-1 text-xs font-semibold text-gray-600">
                          <input
                            type="checkbox"
                            checked={Boolean(produto.itemNovo)}
                            onChange={(e) =>
                              setFormFornecedor((prev) => ({
                                ...prev,
                                produtos: prev.produtos.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...item,
                                        itemNovo: e.target.checked,
                                        produtoNome: "",
                                      }
                                    : item,
                                ),
                              }))
                            }
                          />
                          Item novo (não existe no catálogo)
                        </label>
                      </div>

                      {produto.itemNovo ? (
                        <input
                          className="mb-2 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                          value={produto.produtoNome}
                          onChange={(e) =>
                            atualizarProdutoFornecedor(index, "produtoNome", e.target.value)
                          }
                          placeholder={`Nome do ${rotuloTipoItem(produto.tipo)} novo`}
                        />
                      ) : (
                        <select
                          className="mb-2 w-full min-w-0 rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                          value={produto.produtoNome}
                          onChange={(e) =>
                            atualizarProdutoFornecedor(index, "produtoNome", e.target.value)
                          }
                        >
                          <option value="">Selecione...</option>
                          {(produto.tipo === "insumo"
                            ? insumos
                            : produto.tipo === "peca"
                              ? pecas
                              : produtos
                          ).map((item) => (
                            <option key={item.id} value={item.nome}>
                              {item.nome}
                            </option>
                          ))}
                        </select>
                      )}

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-6 lg:grid-cols-12">
                      <input
                        className="min-w-0 rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 md:col-span-2 lg:col-span-2"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={produto.quantidade}
                        onChange={(e) =>
                          atualizarProdutoFornecedor(index, "quantidade", e.target.value)
                        }
                        placeholder="Qtd"
                      />
                      {produto.tipo === "insumo" ? (
                        <input
                          className="min-w-0 rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 md:col-span-2 lg:col-span-1"
                          value={produto.unidade}
                          onChange={(e) =>
                            atualizarProdutoFornecedor(index, "unidade", e.target.value)
                          }
                          placeholder="kg"
                        />
                      ) : (
                        <input
                          className="min-w-0 cursor-not-allowed rounded-lg border border-gray-300 bg-gray-100 px-2 py-1.5 text-sm text-gray-500 outline-none md:col-span-2 lg:col-span-1"
                          value="un"
                          disabled
                        />
                      )}
                      <input
                        className="min-w-0 rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 md:col-span-2 lg:col-span-2"
                        type="number"
                        min="0"
                        step="0.01"
                        value={produto.preco}
                        onChange={(e) =>
                          atualizarProdutoFornecedor(index, "preco", e.target.value)
                        }
                        placeholder="Custo total"
                      />
                      <div className="flex h-[38px] min-w-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-gray-900 md:col-span-3 lg:col-span-2">
                        {moeda.format(calcularUnitarioFornecedor(produto))}
                      </div>
                      <button
                        type="button"
                        className="btn-danger min-h-[38px] px-3 text-xs md:col-span-3 lg:col-span-1"
                        onClick={() =>
                          setFormFornecedor({
                            ...formFornecedor,
                            produtos: formFornecedor.produtos.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          })
                        }
                      >
                        Remover
                      </button>
                      </div>
                    </div>
                  ))}
                  {formFornecedor.produtos.length === 0 && (
                    <p className="text-xs text-gray-500">
                      Nenhum produto vinculado. Isso é opcional — adicione apenas se
                      quiser comparar custos deste fornecedor.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-gray-900">Fotos e orçamentos</h3>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() =>
                      setFormFornecedor({
                        ...formFornecedor,
                        anexos: [...formFornecedor.anexos, { ...anexoFornecedorVazio }],
                      })
                    }
                  >
                    Adicionar anexo
                  </button>
                </div>
                <div className="space-y-2">
                  {formFornecedor.anexos.map((anexo, index) => (
                    <div
                      key={`anexo-${index}`}
                      className="grid grid-cols-1 gap-2 rounded-lg border border-blue-100 bg-white p-2 md:grid-cols-12"
                    >
                      <input
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 md:col-span-3"
                        value={anexo.titulo}
                        onChange={(e) =>
                          atualizarAnexoFornecedor(index, "titulo", e.target.value)
                        }
                        placeholder="Título"
                      />
                      <input
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 md:col-span-6"
                        value={anexo.url}
                        onChange={(e) =>
                          atualizarAnexoFornecedor(index, "url", e.target.value)
                        }
                        placeholder="Link do arquivo ou foto"
                      />
                      <select
                        className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 md:col-span-2"
                        value={anexo.tipo}
                        onChange={(e) =>
                          atualizarAnexoFornecedor(index, "tipo", e.target.value)
                        }
                      >
                        <option value="ORCAMENTO">Orçamento</option>
                        <option value="FOTO">Foto</option>
                        <option value="NOTA">Nota</option>
                      </select>
                      <button
                        type="button"
                        className="btn-danger text-xs md:col-span-1"
                        onClick={() =>
                          setFormFornecedor({
                            ...formFornecedor,
                            anexos: formFornecedor.anexos.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          })
                        }
                      >
                        X
                      </button>
                    </div>
                  ))}
                  {formFornecedor.anexos.length === 0 && (
                    <p className="text-xs text-gray-500">Nenhum anexo vinculado.</p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Observações
                </label>
                <textarea
                  className="min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                  value={formFornecedor.observacoes}
                  onChange={(e) =>
                    setFormFornecedor({ ...formFornecedor, observacoes: e.target.value })
                  }
                  placeholder="Condições de entrega, prazo, pagamento, qualidade..."
                />
              </div>

              <label className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={formFornecedor.ativo}
                  onChange={(e) =>
                    setFormFornecedor({ ...formFornecedor, ativo: e.target.checked })
                  }
                />
                Fornecedor ativo
              </label>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMostrarModalFornecedor(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar fornecedor
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
