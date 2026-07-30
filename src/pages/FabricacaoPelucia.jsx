import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { AlertBox, Badge, PageHeader } from "../components/UIComponents";

const formatarDataHora = (dataIso) => {
  if (!dataIso) return "-";
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR");
};

const formatarMoeda = (valor) =>
  valor !== null && valor !== undefined ? `R$ ${Number(valor).toFixed(2)}` : "-";

export default function FabricacaoPelucia() {
  const { usuario, loading: authLoading } = useAuth();

  const [insumos, setInsumos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [secaoAtiva, setSecaoAtiva] = useState("insumos");

  const [formInsumo, setFormInsumo] = useState({
    nome: "",
    unidade: "",
    estoqueMinimo: "",
  });

  const [compraAbertaId, setCompraAbertaId] = useState(null);
  const [formCompra, setFormCompra] = useState({
    quantidade: "",
    custoUnitario: "",
    fornecedorId: "",
    observacao: "",
  });

  const [formPedido, setFormPedido] = useState({
    produtoId: "",
    quantidade: "",
    observacao: "",
  });

  const carregarDados = useCallback(async () => {
    try {
      setError("");
      const [insumosRes, comprasRes, produtosRes, fornecedoresRes, pedidosRes] =
        await Promise.all([
          api.get("/insumos"),
          api.get("/insumos/compras"),
          api.get("/produtos"),
          api.get("/fornecedores"),
          api.get("/pedidos-pelucia"),
        ]);

      setInsumos(Array.isArray(insumosRes.data) ? insumosRes.data : []);
      setCompras(Array.isArray(comprasRes.data) ? comprasRes.data : []);
      setProdutos(Array.isArray(produtosRes.data) ? produtosRes.data : []);
      setFornecedores(
        Array.isArray(fornecedoresRes.data) ? fornecedoresRes.data : [],
      );
      setPedidos(Array.isArray(pedidosRes.data) ? pedidosRes.data : []);
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

  const abrirCompra = (insumoId) => {
    setCompraAbertaId((atual) => (atual === insumoId ? null : insumoId));
    setFormCompra({
      quantidade: "",
      custoUnitario: "",
      fornecedorId: "",
      observacao: "",
    });
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
      setCompraAbertaId(null);
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

  const handleDarBaixa = async (id) => {
    try {
      setError("");
      await api.patch(`/pedidos-pelucia/${id}/baixa`);
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao dar baixa no pedido");
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

        <div className="card">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Insumos ({insumos.length})
          </h2>

          {insumos.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhum insumo cadastrado.</p>
          ) : (
            <div className="space-y-3">
              {insumos.map((insumo) => {
                const estoqueBaixo =
                  insumo.estoqueMinimo !== null &&
                  insumo.estoqueMinimo !== undefined &&
                  Number(insumo.quantidadeEstoque) < Number(insumo.estoqueMinimo);

                return (
                  <div
                    key={insumo.id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">
                          {insumo.nome}
                        </h3>
                        <p className="text-xs text-gray-600">
                          Estoque: {insumo.quantidadeEstoque}{" "}
                          {insumo.unidade || ""}
                          {" · "}Custo unitário última compra:{" "}
                          {formatarMoeda(insumo.custoUnitarioUltimo)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {estoqueBaixo && (
                          <Badge variant="danger" size="sm">
                            Estoque baixo
                          </Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => abrirCompra(insumo.id)}
                          className="btn-secondary text-sm"
                        >
                          {compraAbertaId === insumo.id
                            ? "Cancelar"
                            : "Registrar compra"}
                        </button>
                      </div>
                    </div>

                    {compraAbertaId === insumo.id && (
                      <form
                        onSubmit={(e) => handleRegistrarCompra(e, insumo.id)}
                        className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-3 md:grid-cols-4"
                      >
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">
                            Quantidade
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
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
                              <option key={fornecedor.id} value={fornecedor.id}>
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
                            {submitting ? "Salvando..." : "Confirmar compra"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
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

                  {pedido.status === "PENDENTE" && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => handleDarBaixa(pedido.id)}
                        className="btn-primary"
                      >
                        Dar baixa (entra no Depósito Principal)
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
