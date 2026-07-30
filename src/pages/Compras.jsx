import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { AlertBox, Badge, PageHeader } from "../components/UIComponents";
import { enviarImagemParaCloudinary } from "../utils/cloudinary";
import { confirmar } from "../utils/alerts";
import { filtrarLojasOperacionais } from "../utils/lojas";

const STATUS_OPCOES = [
  { value: "PESQUISANDO", label: "Pesquisando", variant: "info" },
  { value: "APROVADO", label: "Aprovado", variant: "warning" },
  { value: "COMPRADO", label: "Comprado", variant: "warning" },
  { value: "RECEBIDO", label: "Recebido", variant: "success" },
];

const obterStatusInfo = (status) =>
  STATUS_OPCOES.find((opcao) => opcao.value === status) || {
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

const numeroFormatado = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const formInicial = {
  nomeItem: "",
  produtoId: "",
  insumoId: "",
  fornecedorId: "",
  lojaId: "",
  descricaoUso: "",
  quantidade: "",
  unidade: "",
  valorUnitario: "",
  observacao: "",
  fotoUrl: "",
};

const produtoFornecedorVazio = {
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
  produtos: [{ ...produtoFornecedorVazio }],
  anexos: [],
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

const limparPayloadFornecedor = (form) => ({
  ...form,
  produtos: form.produtos.map((produto) => ({
    ...produto,
    quantidade: Number(produto.quantidade),
    preco: Number(produto.preco),
  })),
  anexos: form.anexos.filter((anexo) => anexo.url.trim()),
});

export default function Compras() {
  const { usuario, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [compras, setCompras] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [comparacoes, setComparacoes] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState(formInicial);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

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
      const [
        comprasRes,
        produtosRes,
        insumosRes,
        fornecedoresRes,
        comparacoesRes,
        lojasRes,
      ] = await Promise.all([
        api.get("/compras", { params: filtrosComprasAplicados }),
        api.get("/produtos"),
        api.get("/insumos"),
        api.get("/fornecedores"),
        api.get("/fornecedores/comparacoes"),
        api.get("/lojas"),
      ]);

      setCompras(Array.isArray(comprasRes.data) ? comprasRes.data : []);
      setProdutos(Array.isArray(produtosRes.data) ? produtosRes.data : []);
      setInsumos(Array.isArray(insumosRes.data) ? insumosRes.data : []);
      setFornecedores(
        Array.isArray(fornecedoresRes.data) ? fornecedoresRes.data : [],
      );
      setComparacoes(Array.isArray(comparacoesRes.data) ? comparacoesRes.data : []);
      setLojas(filtrarLojasOperacionais(Array.isArray(lojasRes.data) ? lojasRes.data : []));
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
    form.quantidade && form.valorUnitario
      ? Number(form.quantidade) * Number(form.valorUnitario)
      : null;

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

    if (!form.nomeItem.trim()) {
      setError("Informe o nome do item.");
      return;
    }

    const quantidadeNumerica = Number(form.quantidade);
    if (!Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0) {
      setError("Informe uma quantidade válida (maior que zero).");
      return;
    }

    if (enviandoFoto) {
      setError("Aguarde o envio da foto terminar.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post("/compras", {
        nomeItem: form.nomeItem.trim(),
        produtoId: form.produtoId || null,
        insumoId: form.insumoId || null,
        fornecedorId: form.fornecedorId || null,
        lojaId: form.lojaId || null,
        descricaoUso: form.descricaoUso || null,
        quantidade: quantidadeNumerica,
        unidade: form.unidade || null,
        valorUnitario: form.valorUnitario || null,
        fotoUrl: form.fotoUrl || null,
        observacao: form.observacao || null,
      });
      setForm(formInicial);
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao criar compra");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCriarEnvioDaCompra = (compra) => {
    navigate("/envios", {
      state: {
        lojaDestinoId: compra.lojaId,
        produtoId: compra.produtoId,
        quantidade: compra.quantidade,
      },
    });
  };

  const handleAtualizarStatus = async (id, novoStatus) => {
    try {
      setError("");
      await api.patch(`/compras/${id}/status`, { status: novoStatus });
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao atualizar status da compra");
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
        const chave = registro.fornecedor?.nome || "Sem fornecedor";
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
      produtos: [{ ...produtoFornecedorVazio }],
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
        fornecedor.produtos?.length > 0
          ? fornecedor.produtos.map((produto) => ({
              produtoNome: produto.produtoNome || "",
              quantidade: produto.quantidade || "",
              unidade: produto.unidade || "un",
              preco: produto.preco || "",
              observacoes: produto.observacoes || "",
            }))
          : [{ ...produtoFornecedorVazio }],
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
                title: "Nova compra",
                subtitle: "Lançar compra, acompanhar status e receber.",
              },
            ].map((opcao) => {
              const ativo = secaoAtiva === opcao.key;
              return (
                <button
                  key={opcao.key}
                  type="button"
                  onClick={() => setSecaoAtiva(opcao.key)}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    ativo
                      ? "border-primary bg-primary text-white shadow-md"
                      : "border-slate-200 bg-white text-gray-900 hover:border-primary/50 hover:bg-orange-50"
                  }`}
                >
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

        {secaoAtiva === "novaCompra" && (
          <>
        <form onSubmit={handleCriarCompra} className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Nova compra</h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nome do item
              </label>
              <input
                value={form.nomeItem}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, nomeItem: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                placeholder="Ex: Pelúcia urso 30cm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Produto do catálogo (opcional)
              </label>
              <select
                value={form.produtoId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    produtoId: e.target.value,
                    insumoId: e.target.value ? "" : prev.insumoId,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="">Nenhum</option>
                {produtos.map((produto) => (
                  <option key={produto.id} value={produto.id}>
                    {produto.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Insumo do catálogo (opcional)
              </label>
              <select
                value={form.insumoId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    insumoId: e.target.value,
                    produtoId: e.target.value ? "" : prev.produtoId,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="">Nenhum</option>
                {insumos.map((insumo) => (
                  <option key={insumo.id} value={insumo.id}>
                    {insumo.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Fornecedor
              </label>
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
              <a
                href="#fornecedores"
                className="mt-1 inline-block text-xs font-bold text-primary hover:text-primary/80"
              >
                Ver fornecedores e comparar preços ↓
              </a>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Loja onde será usado (opcional)
              </label>
              <select
                value={form.lojaId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, lojaId: e.target.value }))
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
              {form.lojaId && (
                <p className="mt-1 text-xs text-gray-500">
                  Ao marcar como "Recebido" o produto entra no Depósito
                  Principal; a ida até a loja é feita depois por um envio com
                  lacre.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Onde será usado (detalhe)
              </label>
              <input
                value={form.descricaoUso}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, descricaoUso: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                placeholder="Ex: Máquina 5, Fabricação de pelúcia..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Quantidade
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantidade}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, quantidade: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Unidade
              </label>
              <input
                value={form.unidade}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, unidade: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                placeholder="Ex: un, kg"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Valor unitário (R$)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.valorUnitario}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, valorUnitario: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
              {valorTotalPreview !== null && (
                <p className="mt-1 text-xs text-gray-500">
                  Valor total: {formatarMoeda(valorTotalPreview)}
                </p>
              )}
            </div>

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

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary disabled:opacity-60"
            >
              {submitting ? "Salvando..." : "Lançar compra"}
            </button>
          </div>
        </form>

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
            <div className="space-y-3">
              {compras.map((compra) => {
                const statusInfo = obterStatusInfo(compra.status);
                return (
                  <div
                    key={compra.id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-gray-900">
                        {compra.nomeItem}
                      </h3>
                      <Badge variant={statusInfo.variant} size="sm">
                        {statusInfo.label}
                      </Badge>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-600 sm:grid-cols-2">
                      <p>
                        Quantidade: {compra.quantidade} {compra.unidade || ""}
                      </p>
                      <p>Fornecedor: {compra.fornecedor?.nome || "-"}</p>
                      <p>Valor unitário: {formatarMoeda(compra.valorUnitario)}</p>
                      <p>Valor total: {formatarMoeda(compra.valorTotal)}</p>
                      <p>
                        Onde será usado:{" "}
                        {[compra.loja?.nome, compra.descricaoUso]
                          .filter(Boolean)
                          .join(" — ") || "-"}
                      </p>
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

                    {compra.status === "RECEBIDO" &&
                      compra.produtoId &&
                      compra.lojaId && (
                        <button
                          type="button"
                          onClick={() => handleCriarEnvioDaCompra(compra)}
                          className="mt-3 text-sm font-bold text-primary hover:text-primary/80"
                        >
                          Está no Depósito Principal — criar envio com lacre
                          para {compra.loja?.nome} →
                        </button>
                      )}

                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-xs font-medium text-gray-700">
                        Status:
                      </label>
                      <select
                        value={compra.status}
                        onChange={(e) =>
                          handleAtualizarStatus(compra.id, e.target.value)
                        }
                        className="rounded-lg border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
                      >
                        {STATUS_OPCOES.map((opcao) => (
                          <option key={opcao.value} value={opcao.value}>
                            {opcao.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </>
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
                          {registro.dataCompra || "-"} — {registro.nomeItem}:{" "}
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

          {false && (
          <div className="mt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-gray-900">
                Comparação de preços
              </h3>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                {comparacoesFiltradas.length} produtos
              </span>
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

          )}

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
                      className="grid grid-cols-1 gap-2 rounded-lg border border-orange-100 bg-white p-2 md:grid-cols-6 lg:grid-cols-12"
                    >
                      <input
                        className="min-w-0 rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 md:col-span-6 lg:col-span-4"
                        value={produto.produtoNome}
                        onChange={(e) =>
                          atualizarProdutoFornecedor(index, "produtoNome", e.target.value)
                        }
                        placeholder="Nome do produto"
                        required
                      />
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
                        required
                      />
                      <input
                        className="min-w-0 rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 md:col-span-2 lg:col-span-1"
                        value={produto.unidade}
                        onChange={(e) =>
                          atualizarProdutoFornecedor(index, "unidade", e.target.value)
                        }
                        placeholder="un"
                      />
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
                        required
                      />
                      <div className="flex h-[38px] min-w-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-gray-900 md:col-span-3 lg:col-span-2">
                        {moeda.format(calcularUnitarioFornecedor(produto))}
                      </div>
                      <button
                        type="button"
                        className="btn-danger min-h-[38px] px-3 text-xs md:col-span-3 lg:col-span-1"
                        disabled={formFornecedor.produtos.length === 1}
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
                  ))}
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
