import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { AlertBox, Badge, PageHeader } from "../components/UIComponents";
import { confirmar } from "../utils/alerts";

const formatarDataHora = (dataIso) => {
  if (!dataIso) return "-";
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR");
};

const formatarMoeda = (valor) =>
  valor !== null && valor !== undefined ? `R$ ${Number(valor).toFixed(2)}` : "-";

const formatarNumero = (valor) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return "0";
  return numero.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
};

export default function FabricacaoPelucia() {
  const { usuario, loading: authLoading } = useAuth();

  const [insumos, setInsumos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [receitas, setReceitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [secaoAtiva, setSecaoAtiva] = useState("insumos");

  const [formInsumo, setFormInsumo] = useState({
    nome: "",
    unidade: "",
    estoqueMinimo: "",
  });

  const [filtrosInsumo, setFiltrosInsumo] = useState({
    busca: "",
    status: "ativos",
    ordenacao: "nome",
  });

  const [acaoAbertaId, setAcaoAbertaId] = useState(null);
  const [formCompra, setFormCompra] = useState({
    quantidade: "",
    custoUnitario: "",
    fornecedorId: "",
    observacao: "",
  });
  const [formEditarInsumo, setFormEditarInsumo] = useState({
    nome: "",
    unidade: "",
    quantidadeEstoque: "",
    estoqueMinimo: "",
    custoUnitarioUltimo: "",
    observacao: "",
    ativo: true,
  });

  const [formPedido, setFormPedido] = useState({
    produtoId: "",
    quantidade: "",
    observacao: "",
  });

  const [produtoReceitaId, setProdutoReceitaId] = useState("");
  const [receitaReferencia, setReceitaReferencia] = useState(100);
  const [itensReceita, setItensReceita] = useState([]);

  const [baixaAbertaId, setBaixaAbertaId] = useState(null);
  const [itensBaixa, setItensBaixa] = useState([]);

  const carregarDados = useCallback(async () => {
    try {
      setError("");
      const [
        insumosRes,
        comprasRes,
        produtosRes,
        fornecedoresRes,
        pedidosRes,
        receitasRes,
      ] = await Promise.all([
        api.get("/insumos", { params: { incluirInativos: true } }),
        api.get("/insumos/compras"),
        api.get("/produtos"),
        api.get("/fornecedores"),
        api.get("/pedidos-pelucia"),
        api.get("/receitas"),
      ]);

      setInsumos(Array.isArray(insumosRes.data) ? insumosRes.data : []);
      setCompras(Array.isArray(comprasRes.data) ? comprasRes.data : []);
      setProdutos(Array.isArray(produtosRes.data) ? produtosRes.data : []);
      setFornecedores(
        Array.isArray(fornecedoresRes.data) ? fornecedoresRes.data : [],
      );
      setPedidos(Array.isArray(pedidosRes.data) ? pedidosRes.data : []);
      setReceitas(Array.isArray(receitasRes.data) ? receitasRes.data : []);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    carregarDados();
  }, [authLoading, carregarDados]);

  const handleCriarInsumo = async (event) => {
    event.preventDefault();
    if (!formInsumo.nome.trim()) {
      setError("Informe o nome do insumo.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post("/insumos", {
        nome: formInsumo.nome.trim(),
        unidade: formInsumo.unidade.trim() || null,
        estoqueMinimo: formInsumo.estoqueMinimo || 0,
      });
      setFormInsumo({ nome: "", unidade: "", estoqueMinimo: "" });
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao criar insumo");
    } finally {
      setSubmitting(false);
    }
  };

  const insumosFiltrados = useMemo(() => {
    const busca = filtrosInsumo.busca.trim().toLowerCase();
    const lista = insumos.filter((insumo) => {
      const estoqueBaixo =
        insumo.estoqueMinimo !== null &&
        insumo.estoqueMinimo !== undefined &&
        Number(insumo.quantidadeEstoque || 0) < Number(insumo.estoqueMinimo || 0);

      if (filtrosInsumo.status === "ativos" && insumo.ativo === false) return false;
      if (filtrosInsumo.status === "inativos" && insumo.ativo !== false) return false;
      if (filtrosInsumo.status === "baixo" && !estoqueBaixo) return false;
      if (busca && !insumo.nome?.toLowerCase().includes(busca)) return false;
      return true;
    });

    return [...lista].sort((a, b) => {
      if (filtrosInsumo.ordenacao === "estoque") {
        return Number(a.quantidadeEstoque || 0) - Number(b.quantidadeEstoque || 0);
      }
      if (filtrosInsumo.ordenacao === "recentes") {
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      }
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
  }, [filtrosInsumo, insumos]);

  const abrirAcaoInsumo = (insumo, tipo) => {
    const chave = `${tipo}:${insumo.id}`;
    setAcaoAbertaId((atual) => (atual === chave ? null : chave));
    setFormCompra({
      quantidade: "",
      custoUnitario: "",
      fornecedorId: "",
      observacao: "",
    });
    setFormEditarInsumo({
      nome: insumo.nome || "",
      unidade: insumo.unidade || "",
      quantidadeEstoque: insumo.quantidadeEstoque ?? "",
      estoqueMinimo: insumo.estoqueMinimo ?? "",
      custoUnitarioUltimo: insumo.custoUnitarioUltimo ?? "",
      observacao: insumo.observacao || "",
      ativo: insumo.ativo !== false,
    });
  };

  const handleAtualizarInsumo = async (event, insumoId) => {
    event.preventDefault();
    if (!formEditarInsumo.nome.trim()) {
      setError("Informe o nome do insumo.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");
      await api.put(`/insumos/${insumoId}`, {
        nome: formEditarInsumo.nome.trim(),
        unidade: formEditarInsumo.unidade.trim() || null,
        quantidadeEstoque: formEditarInsumo.quantidadeEstoque,
        estoqueMinimo: formEditarInsumo.estoqueMinimo,
        custoUnitarioUltimo: formEditarInsumo.custoUnitarioUltimo || null,
        observacao: formEditarInsumo.observacao || null,
        ativo: formEditarInsumo.ativo,
      });
      setAcaoAbertaId(null);
      setSuccess("Insumo atualizado com sucesso.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao atualizar insumo");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcluirInsumo = async (insumo) => {
    const confirmado = await confirmar({
      title: insumo.ativo === false ? "Excluir insumo definitivamente?" : "Desativar insumo?",
      text:
        insumo.ativo === false
          ? "Esse insumo ja esta inativo e sera removido permanentemente."
          : "O insumo fica inativo e pode ser removido definitivamente depois.",
      confirmButtonText: insumo.ativo === false ? "Excluir" : "Desativar",
    });

    if (!confirmado) return;

    try {
      setError("");
      setSuccess("");
      const response = await api.delete(`/insumos/${insumo.id}`);
      setSuccess(response.data?.message || "Insumo removido com sucesso.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao excluir insumo");
    }
  };

  const handleRegistrarCompra = async (event, insumoId) => {
    event.preventDefault();

    const quantidadeNumerica = Number(
      String(formCompra.quantidade).replace(",", "."),
    );
    if (!Number.isFinite(quantidadeNumerica) || quantidadeNumerica <= 0) {
      setError("Informe uma quantidade válida para a compra.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post(`/insumos/${insumoId}/compras`, {
        quantidade: quantidadeNumerica,
        custoUnitario: formCompra.custoUnitario || null,
        fornecedorId: formCompra.fornecedorId || null,
        observacao: formCompra.observacao || null,
      });
      setAcaoAbertaId(null);
      setSuccess("Compra registrada com sucesso.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao registrar compra");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCriarPedido = async (event) => {
    event.preventDefault();

    const quantidadeNumerica = Number(formPedido.quantidade);
    if (!formPedido.produtoId) {
      setError("Selecione a pelúcia a ser produzida.");
      return;
    }
    if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
      setError("Informe uma quantidade válida (inteiro maior que zero).");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post("/pedidos-pelucia", {
        produtoId: formPedido.produtoId,
        quantidade: quantidadeNumerica,
        observacao: formPedido.observacao || null,
      });
      setFormPedido({ produtoId: "", quantidade: "", observacao: "" });
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao criar pedido de pelúcia");
    } finally {
      setSubmitting(false);
    }
  };

  const produtosComReceita = useMemo(() => {
    const grupos = new Map();
    receitas.forEach((item) => {
      if (!grupos.has(item.produtoId)) grupos.set(item.produtoId, []);
      grupos.get(item.produtoId).push(item);
    });
    return Array.from(grupos.entries());
  }, [receitas]);

  const selecionarProdutoReceita = (produtoId) => {
    setProdutoReceitaId(produtoId);
    const referenciaNumerica = Number(receitaReferencia) || 100;
    const existentes = receitas.filter((item) => item.produtoId === produtoId);

    setItensReceita(
      existentes.length > 0
        ? existentes.map((item) => ({
            insumoId: item.insumoId,
            quantidadeLote: formatarNumero(
              Number(item.quantidadePorUnidade) * referenciaNumerica,
            ),
          }))
        : [{ insumoId: "", quantidadeLote: "" }],
    );
  };

  const adicionarLinhaReceita = () =>
    setItensReceita((prev) => [...prev, { insumoId: "", quantidadeLote: "" }]);

  const removerLinhaReceita = (index) =>
    setItensReceita((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

  const atualizarLinhaReceita = (index, campo, valor) =>
    setItensReceita((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [campo]: valor } : item,
      ),
    );

  const handleSalvarReceita = async () => {
    if (!produtoReceitaId) {
      setError("Selecione o produto para cadastrar a receita.");
      return;
    }

    const referenciaNumerica = Number(receitaReferencia);
    if (!Number.isFinite(referenciaNumerica) || referenciaNumerica <= 0) {
      setError("Informe uma quantidade de referência válida (maior que zero).");
      return;
    }

    const itens = itensReceita
      .filter((item) => item.insumoId && item.quantidadeLote)
      .map((item) => ({
        insumoId: item.insumoId,
        quantidadePorUnidade:
          Number(String(item.quantidadeLote).replace(",", ".")) /
          referenciaNumerica,
      }));

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");
      await api.put(`/receitas/produto/${produtoReceitaId}`, { itens });
      setSuccess("Receita salva com sucesso.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao salvar receita");
    } finally {
      setSubmitting(false);
    }
  };

  const abrirBaixa = (pedido) => {
    if (baixaAbertaId === pedido.id) {
      setBaixaAbertaId(null);
      return;
    }

    const receitaProduto = receitas.filter(
      (item) => item.produtoId === pedido.produtoId,
    );

    setItensBaixa(
      receitaProduto.map((item) => ({
        insumoId: item.insumoId,
        quantidade: formatarNumero(
          Number(item.quantidadePorUnidade) * pedido.quantidade,
        ),
      })),
    );
    setBaixaAbertaId(pedido.id);
  };

  const adicionarLinhaBaixa = () =>
    setItensBaixa((prev) => [...prev, { insumoId: "", quantidade: "" }]);

  const removerLinhaBaixa = (index) =>
    setItensBaixa((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

  const atualizarLinhaBaixa = (index, campo, valor) =>
    setItensBaixa((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [campo]: valor } : item,
      ),
    );

  const handleDarBaixa = async (id) => {
    const insumosPayload = itensBaixa
      .filter((item) => item.insumoId && item.quantidade)
      .map((item) => ({
        insumoId: item.insumoId,
        quantidade: item.quantidade,
      }));

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");
      await api.patch(`/pedidos-pelucia/${id}/baixa`, {
        insumos: insumosPayload,
      });
      setBaixaAbertaId(null);
      setItensBaixa([]);
      setSuccess("Baixa registrada com sucesso.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao dar baixa no pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Fabricação de Pelúcia"
          subtitle={`Usuário: ${usuario?.nome || "-"} (${usuario?.role || "-"})`}
          icon="🧵"
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
                key: "insumos",
                title: "Insumos",
                subtitle: "Cadastrar, controlar estoque e comprar.",
              },
              {
                key: "pedidos",
                title: "Pedidos de pelúcia",
                subtitle: "Lançar produção e acompanhar status.",
              },
              {
                key: "receitas",
                title: "Receitas",
                subtitle: "Quanto cada produto gasta de insumos.",
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

        {secaoAtiva === "insumos" && (
          <>
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Novo insumo
          </h2>
          <form
            onSubmit={handleCriarInsumo}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <div className="md:col-span-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nome
              </label>
              <input
                value={formInsumo.nome}
                onChange={(e) =>
                  setFormInsumo((prev) => ({ ...prev, nome: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                placeholder="Ex: Manta sintética"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Unidade
              </label>
              <input
                value={formInsumo.unidade}
                onChange={(e) =>
                  setFormInsumo((prev) => ({
                    ...prev,
                    unidade: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                placeholder="Ex: kg, m, un"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Estoque mínimo
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formInsumo.estoqueMinimo}
                onChange={(e) =>
                  setFormInsumo((prev) => ({
                    ...prev,
                    estoqueMinimo: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                placeholder="Ex: 10"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary disabled:opacity-60"
              >
                {submitting ? "Salvando..." : "Adicionar insumo"}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Insumos</h2>
              <p className="text-sm text-gray-500">
                Estoque de matéria-prima usada na fabricação.
              </p>
            </div>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
              {insumosFiltrados.length} resultados
            </span>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Buscar
              </label>
              <input
                value={filtrosInsumo.busca}
                onChange={(e) =>
                  setFiltrosInsumo((prev) => ({ ...prev, busca: e.target.value }))
                }
                className="input-field"
                placeholder="Nome do insumo"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Status
              </label>
              <select
                value={filtrosInsumo.status}
                onChange={(e) =>
                  setFiltrosInsumo((prev) => ({ ...prev, status: e.target.value }))
                }
                className="select-field"
              >
                <option value="ativos">Ativos</option>
                <option value="baixo">Estoque baixo</option>
                <option value="todos">Todos</option>
                <option value="inativos">Inativos</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Ordenar
              </label>
              <select
                value={filtrosInsumo.ordenacao}
                onChange={(e) =>
                  setFiltrosInsumo((prev) => ({
                    ...prev,
                    ordenacao: e.target.value,
                  }))
                }
                className="select-field"
              >
                <option value="nome">Nome</option>
                <option value="estoque">Menor estoque</option>
                <option value="recentes">Atualizados</option>
              </select>
            </div>
          </div>

          {insumosFiltrados.length === 0 ? (
            <div className="rounded-lg border border-dashed border-orange-200 p-8 text-center text-sm text-gray-600">
              Nenhum insumo encontrado com estes filtros.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Insumo</th>
                    <th>Estoque</th>
                    <th>Mínimo</th>
                    <th>Custo</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {insumosFiltrados.map((insumo) => {
                    const estoqueBaixo =
                      insumo.estoqueMinimo !== null &&
                      insumo.estoqueMinimo !== undefined &&
                      Number(insumo.quantidadeEstoque || 0) <
                        Number(insumo.estoqueMinimo || 0);
                    const chaveCompra = `compra:${insumo.id}`;
                    const chaveEditar = `editar:${insumo.id}`;
                    const acaoAberta =
                      acaoAbertaId === chaveCompra
                        ? "compra"
                        : acaoAbertaId === chaveEditar
                          ? "editar"
                          : null;

                    return (
                      <Fragment key={insumo.id}>
                        <tr>
                          <td className="whitespace-normal">
                            <div className="min-w-40 max-w-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-black text-gray-900">
                                  {insumo.nome}
                                </p>
                                {insumo.ativo === false && (
                                  <Badge variant="danger" size="sm">
                                    Inativo
                                  </Badge>
                                )}
                                {estoqueBaixo && (
                                  <Badge variant="danger" size="sm">
                                    Baixo
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="text-base font-black text-emerald-700">
                              {insumo.quantidadeEstoque || 0}
                            </span>{" "}
                            <span className="text-xs text-gray-500">
                              {insumo.unidade || "un"}
                            </span>
                          </td>
                          <td>{insumo.estoqueMinimo ?? 0}</td>
                          <td>{formatarMoeda(insumo.custoUnitarioUltimo)}</td>
                          <td>
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                className="btn-secondary px-3 py-2 text-xs whitespace-nowrap"
                                onClick={() => abrirAcaoInsumo(insumo, "compra")}
                              >
                                {acaoAberta === "compra"
                                  ? "Cancelar"
                                  : "Registrar compra"}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary px-3 py-2 text-xs whitespace-nowrap"
                                onClick={() => abrirAcaoInsumo(insumo, "editar")}
                              >
                                {acaoAberta === "editar" ? "Cancelar" : "Editar"}
                              </button>
                              <button
                                type="button"
                                className="btn-danger px-3 py-2 text-xs whitespace-nowrap"
                                onClick={() => handleExcluirInsumo(insumo)}
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>

                        {acaoAberta && (
                          <tr>
                            <td colSpan={5} className="bg-orange-50/60 p-0">
                              {acaoAberta === "compra" && (
                                <form
                                  onSubmit={(e) =>
                                    handleRegistrarCompra(e, insumo.id)
                                  }
                                  className="grid grid-cols-1 gap-3 p-4 md:grid-cols-4"
                                >
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                      Quantidade
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      autoFocus
                                      value={formCompra.quantidade}
                                      onChange={(e) =>
                                        setFormCompra((prev) => ({
                                          ...prev,
                                          quantidade: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                      Custo unitário (R$)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={formCompra.custoUnitario}
                                      onChange={(e) =>
                                        setFormCompra((prev) => ({
                                          ...prev,
                                          custoUnitario: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                      Fornecedor
                                    </label>
                                    <select
                                      value={formCompra.fornecedorId}
                                      onChange={(e) =>
                                        setFormCompra((prev) => ({
                                          ...prev,
                                          fornecedorId: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                    >
                                      <option value="">Selecione...</option>
                                      {fornecedores.map((fornecedor) => (
                                        <option
                                          key={fornecedor.id}
                                          value={fornecedor.id}
                                        >
                                          {fornecedor.nome}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                      Observação
                                    </label>
                                    <input
                                      value={formCompra.observacao}
                                      onChange={(e) =>
                                        setFormCompra((prev) => ({
                                          ...prev,
                                          observacao: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                    />
                                  </div>
                                  <div className="md:col-span-4 flex justify-end">
                                    <button
                                      type="submit"
                                      disabled={submitting}
                                      className="btn-primary text-sm disabled:opacity-60"
                                    >
                                      {submitting
                                        ? "Salvando..."
                                        : "Confirmar compra"}
                                    </button>
                                  </div>
                                </form>
                              )}

                              {acaoAberta === "editar" && (
                                <form
                                  onSubmit={(e) =>
                                    handleAtualizarInsumo(e, insumo.id)
                                  }
                                  className="grid grid-cols-1 gap-3 p-4 md:grid-cols-4"
                                >
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                      Nome
                                    </label>
                                    <input
                                      autoFocus
                                      value={formEditarInsumo.nome}
                                      onChange={(e) =>
                                        setFormEditarInsumo((prev) => ({
                                          ...prev,
                                          nome: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                      Unidade
                                    </label>
                                    <input
                                      value={formEditarInsumo.unidade}
                                      onChange={(e) =>
                                        setFormEditarInsumo((prev) => ({
                                          ...prev,
                                          unidade: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                      placeholder="Ex: kg, m, un"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                      Estoque atual
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={formEditarInsumo.quantidadeEstoque}
                                      onChange={(e) =>
                                        setFormEditarInsumo((prev) => ({
                                          ...prev,
                                          quantidadeEstoque: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                      Estoque mínimo
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={formEditarInsumo.estoqueMinimo}
                                      onChange={(e) =>
                                        setFormEditarInsumo((prev) => ({
                                          ...prev,
                                          estoqueMinimo: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                      Custo unitário última compra (R$)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={formEditarInsumo.custoUnitarioUltimo}
                                      onChange={(e) =>
                                        setFormEditarInsumo((prev) => ({
                                          ...prev,
                                          custoUnitarioUltimo: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="mb-1 block text-xs font-medium text-gray-700">
                                      Observação
                                    </label>
                                    <input
                                      value={formEditarInsumo.observacao}
                                      onChange={(e) =>
                                        setFormEditarInsumo((prev) => ({
                                          ...prev,
                                          observacao: e.target.value,
                                        }))
                                      }
                                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                    />
                                  </div>
                                  <div className="flex items-end">
                                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={formEditarInsumo.ativo}
                                        onChange={(e) =>
                                          setFormEditarInsumo((prev) => ({
                                            ...prev,
                                            ativo: e.target.checked,
                                          }))
                                        }
                                      />
                                      Ativo
                                    </label>
                                  </div>
                                  <div className="md:col-span-4 flex justify-end">
                                    <button
                                      type="submit"
                                      disabled={submitting}
                                      className="btn-primary text-sm disabled:opacity-60"
                                    >
                                      {submitting
                                        ? "Salvando..."
                                        : "Salvar alterações"}
                                    </button>
                                  </div>
                                </form>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Últimas compras de insumo
          </h2>
          {compras.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhuma compra registrada.</p>
          ) : (
            <div className="space-y-2 text-xs text-gray-700">
              {compras.slice(0, 10).map((compra) => (
                <div
                  key={compra.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2"
                >
                  <span>
                    {formatarDataHora(compra.dataCompra)} —{" "}
                    <strong>{compra.insumo?.nome}</strong>: +{compra.quantidade}{" "}
                    {compra.insumo?.unidade || ""}
                  </span>
                  <span className="text-gray-500">
                    {compra.fornecedor?.nome || "-"} ·{" "}
                    {formatarMoeda(compra.custoTotal)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        )}

        {secaoAtiva === "pedidos" && (
          <>
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Lançar pedido de pelúcia
          </h2>
          <form
            onSubmit={handleCriarPedido}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Pelúcia
              </label>
              <select
                value={formPedido.produtoId}
                onChange={(e) =>
                  setFormPedido((prev) => ({
                    ...prev,
                    produtoId: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="">Selecione...</option>
                {produtos.map((produto) => (
                  <option key={produto.id} value={produto.id}>
                    {produto.emoji ? `${produto.emoji} ` : ""}
                    {produto.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Quantidade
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={formPedido.quantidade}
                onChange={(e) =>
                  setFormPedido((prev) => ({
                    ...prev,
                    quantidade: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Observação
              </label>
              <input
                value={formPedido.observacao}
                onChange={(e) =>
                  setFormPedido((prev) => ({
                    ...prev,
                    observacao: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary disabled:opacity-60"
              >
                {submitting ? "Salvando..." : "Lançar pedido"}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Pedidos de pelúcia ({pedidos.length})
          </h2>

          {pedidos.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhum pedido de pelúcia registrado.
            </p>
          ) : (
            <div className="space-y-3">
              {pedidos.map((pedido) => (
                <div
                  key={pedido.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-gray-900">
                      {pedido.produto?.emoji ? `${pedido.produto.emoji} ` : ""}
                      {pedido.produto?.nome || "-"} — {pedido.quantidade} un.
                    </h3>
                    <Badge
                      variant={
                        pedido.status === "CONCLUIDO" ? "success" : "warning"
                      }
                      size="sm"
                    >
                      {pedido.status === "CONCLUIDO" ? "Concluído" : "Pendente"}
                    </Badge>
                  </div>

                  {pedido.observacao && (
                    <p className="mt-2 text-sm text-gray-700">
                      {pedido.observacao}
                    </p>
                  )}

                  <div className="mt-2 space-y-1 text-xs text-gray-600">
                    <p>Criado por: {pedido.criadoPor?.nome || "-"}</p>
                    <p>Criado em: {formatarDataHora(pedido.createdAt)}</p>
                    {pedido.status === "CONCLUIDO" && (
                      <>
                        <p>Concluído por: {pedido.concluidoPor?.nome || "-"}</p>
                        <p>
                          Concluído em: {formatarDataHora(pedido.concluidoEm)}
                        </p>
                      </>
                    )}
                  </div>

                  {pedido.status === "CONCLUIDO" &&
                    pedido.insumosConsumidos?.length > 0 && (
                      <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-gray-600">
                        <p className="font-bold text-gray-700">
                          Insumos consumidos:
                        </p>
                        {pedido.insumosConsumidos.map((consumo) => (
                          <p key={consumo.id}>
                            {consumo.insumo?.nome}: {consumo.quantidade}{" "}
                            {consumo.insumo?.unidade || ""}
                          </p>
                        ))}
                      </div>
                    )}

                  {pedido.status === "PENDENTE" && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => abrirBaixa(pedido)}
                        className="btn-primary"
                      >
                        {baixaAbertaId === pedido.id
                          ? "Cancelar"
                          : "Dar baixa (entra no Depósito Principal)"}
                      </button>

                      {baixaAbertaId === pedido.id && (
                        <div className="mt-3 rounded-lg border border-orange-100 bg-orange-50 p-3">
                          <p className="mb-2 text-sm font-bold text-gray-900">
                            Insumos gastos nesta produção
                          </p>

                          {itensBaixa.length === 0 && (
                            <p className="mb-2 text-xs text-gray-600">
                              Nenhuma receita cadastrada para{" "}
                              {pedido.produto?.nome || "este produto"}. A
                              baixa não vai descontar nenhum insumo
                              automaticamente — adicione manualmente se
                              quiser registrar o consumo, ou cadastre a
                              receita na aba Receitas.
                            </p>
                          )}

                          <div className="space-y-2">
                            {itensBaixa.map((item, index) => (
                              <div
                                key={index}
                                className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto]"
                              >
                                <select
                                  value={item.insumoId}
                                  onChange={(e) =>
                                    atualizarLinhaBaixa(
                                      index,
                                      "insumoId",
                                      e.target.value,
                                    )
                                  }
                                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                >
                                  <option value="">
                                    Selecione o insumo...
                                  </option>
                                  {insumos.map((insumo) => (
                                    <option key={insumo.id} value={insumo.id}>
                                      {insumo.nome} (estoque:{" "}
                                      {insumo.quantidadeEstoque}{" "}
                                      {insumo.unidade || ""})
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.0001"
                                  value={item.quantidade}
                                  onChange={(e) =>
                                    atualizarLinhaBaixa(
                                      index,
                                      "quantidade",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Quantidade"
                                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => removerLinhaBaixa(index)}
                                  className="btn-danger px-3 text-xs"
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={adicionarLinhaBaixa}
                              className="btn-secondary text-xs"
                            >
                              + Adicionar insumo
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleDarBaixa(pedido.id)}
                              className="btn-primary text-sm disabled:opacity-60"
                            >
                              {submitting ? "Salvando..." : "Confirmar baixa"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        )}

        {secaoAtiva === "receitas" && (
          <div className="card">
            <h2 className="mb-1 text-lg font-semibold text-gray-900">
              Receita de produção
            </h2>
            <p className="mb-4 text-sm text-gray-500">
              Cadastre quanto de cada insumo é gasto para produzir cada
              pelúcia. Ao dar baixa em um pedido, o sistema sugere o consumo
              automaticamente com base nessa receita.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Produto
                </label>
                <select
                  value={produtoReceitaId}
                  onChange={(e) => selecionarProdutoReceita(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                >
                  <option value="">Selecione...</option>
                  {produtos.map((produto) => (
                    <option key={produto.id} value={produto.id}>
                      {produto.emoji ? `${produto.emoji} ` : ""}
                      {produto.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Quantidade de referência
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={receitaReferencia}
                  onChange={(e) => setReceitaReferencia(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {produtoReceitaId && (
              <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50 p-3">
                <p className="mb-2 text-sm text-gray-700">
                  Ex: para produzir <strong>{receitaReferencia || 0}</strong>{" "}
                  unidades, quanto de cada insumo é gasto?
                </p>

                <div className="space-y-2">
                  {itensReceita.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px_auto]"
                    >
                      <select
                        value={item.insumoId}
                        onChange={(e) =>
                          atualizarLinhaReceita(index, "insumoId", e.target.value)
                        }
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                      >
                        <option value="">Selecione o insumo...</option>
                        {insumos.map((insumo) => (
                          <option key={insumo.id} value={insumo.id}>
                            {insumo.nome}
                            {insumo.unidade ? ` (${insumo.unidade})` : ""}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={item.quantidadeLote}
                        onChange={(e) =>
                          atualizarLinhaReceita(
                            index,
                            "quantidadeLote",
                            e.target.value,
                          )
                        }
                        placeholder="Quantidade gasta"
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => removerLinhaReceita(index)}
                        className="btn-danger px-3 text-xs"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={adicionarLinhaReceita}
                    className="btn-secondary text-xs"
                  >
                    + Adicionar insumo
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSalvarReceita}
                    className="btn-primary text-sm disabled:opacity-60"
                  >
                    {submitting ? "Salvando..." : "Salvar receita"}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-5">
              <h3 className="mb-2 text-base font-bold text-gray-900">
                Produtos com receita cadastrada
              </h3>
              {produtosComReceita.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Nenhuma receita cadastrada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {produtosComReceita.map(([produtoId, itens]) => (
                    <div
                      key={produtoId}
                      className="rounded-lg border border-gray-200 p-3 text-sm"
                    >
                      <p className="font-bold text-gray-900">
                        {itens[0]?.produto?.emoji
                          ? `${itens[0].produto.emoji} `
                          : ""}
                        {itens[0]?.produto?.nome || "-"}
                      </p>
                      <p className="text-xs text-gray-600">
                        {itens
                          .map(
                            (item) =>
                              `${item.insumo?.nome}: ${formatarNumero(item.quantidadePorUnidade)} ${item.insumo?.unidade || ""}/un`,
                          )
                          .join(" · ")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
