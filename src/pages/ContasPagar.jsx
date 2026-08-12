import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import {
  AlertBox,
  Badge,
  DataTable,
  Modal,
  PageHeader,
  StatsGrid,
} from "../components/UIComponents";
import { confirmar } from "../utils/alerts";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moedaUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const formatarPorMoeda = (valor, moedaCodigo) =>
  moedaCodigo === "USD" ? moedaUsd.format(Number(valor || 0)) : moeda.format(Number(valor || 0));

const valorEmReais = (conta) =>
  conta.moeda === "USD" ? Number(conta.valorBrl || 0) : Number(conta.valor || 0);

const FORMAS_PAGAMENTO = [
  ["PIX", "Pix"],
  ["DINHEIRO", "Dinheiro"],
  ["BOLETO", "Boleto"],
];

const contaAvulsaVazia = {
  descricao: "",
  fornecedorId: "",
  valor: "",
  moeda: "BRL",
  cotacaoDolar: "",
  vencimento: "",
  formaPagamento: "PIX",
  observacao: "",
};

const hojeISO = () => {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

const filtrosIniciais = {
  status: "PENDENTE",
  fornecedorId: "",
  origem: "",
  vencimentoInicio: "",
  vencimentoFim: "",
};

export default function ContasPagar() {
  const { usuario, loading: authLoading } = useAuth();

  const [contas, setContas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtrosIniciais);

  const [mostrarModalAvulsa, setMostrarModalAvulsa] = useState(false);
  const [contaAvulsa, setContaAvulsa] = useState(contaAvulsaVazia);
  const [salvandoAvulsa, setSalvandoAvulsa] = useState(false);

  const carregarDados = useCallback(async () => {
    try {
      setError("");
      const params = Object.fromEntries(
        Object.entries(filtrosAplicados).filter(([, valor]) => valor !== "" && valor !== undefined),
      );
      const [contasRes, fornecedoresRes] = await Promise.all([
        api.get("/contas-pagar", { params }),
        api.get("/fornecedores"),
      ]);
      setContas(Array.isArray(contasRes.data) ? contasRes.data : []);
      setFornecedores(Array.isArray(fornecedoresRes.data) ? fornecedoresRes.data : []);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar contas a pagar");
    } finally {
      setLoading(false);
    }
  }, [filtrosAplicados]);

  useEffect(() => {
    if (authLoading) return;
    carregarDados();
  }, [authLoading, carregarDados]);

  const stats = useMemo(() => {
    const hoje = hojeISO();
    const em7dias = new Date();
    em7dias.setDate(em7dias.getDate() + 7);
    const em7diasISO = em7dias.toISOString().slice(0, 10);

    const pendentes = contas.filter((conta) => conta.status === "PENDENTE");
    const pagas = contas.filter((conta) => conta.status === "PAGA");
    const vencidas = pendentes.filter((conta) => conta.vencimento < hoje);
    const vencendoEm7Dias = pendentes.filter(
      (conta) => conta.vencimento >= hoje && conta.vencimento <= em7diasISO,
    );

    return {
      totalPendente: pendentes.reduce((acc, conta) => acc + valorEmReais(conta), 0),
      totalPago: pagas.reduce((acc, conta) => acc + valorEmReais(conta), 0),
      totalVencendoEm7Dias: vencendoEm7Dias.reduce((acc, conta) => acc + valorEmReais(conta), 0),
      totalVencidas: vencidas.reduce((acc, conta) => acc + valorEmReais(conta), 0),
      quantidadeVencidas: vencidas.length,
    };
  }, [contas]);

  const aplicarFiltros = (event) => {
    event.preventDefault();
    setFiltrosAplicados({ ...filtros });
  };

  const limparFiltros = () => {
    setFiltros(filtrosIniciais);
    setFiltrosAplicados(filtrosIniciais);
  };

  const marcarComoPaga = async (conta) => {
    const confirmado = await confirmar({
      title: "Marcar como paga?",
      text: `${conta.descricao || "Conta"} — ${formatarPorMoeda(conta.valor, conta.moeda)}`,
      confirmButtonText: "Marcar como paga",
    });
    if (!confirmado) return;

    try {
      setError("");
      await api.patch(`/contas-pagar/${conta.id}/pagar`, {});
      setSuccess("Conta marcada como paga.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao marcar conta como paga");
    }
  };

  const excluirConta = async (conta) => {
    const confirmado = await confirmar({
      title: "Excluir conta a pagar?",
      text: conta.descricao || "Conta avulsa",
      confirmButtonText: "Excluir",
    });
    if (!confirmado) return;

    try {
      setError("");
      await api.delete(`/contas-pagar/${conta.id}`);
      setSuccess("Conta a pagar excluída.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao excluir conta a pagar");
    }
  };

  const salvarContaAvulsa = async (event) => {
    event.preventDefault();

    if (!contaAvulsa.descricao.trim()) {
      setError("Informe a descrição da conta.");
      return;
    }
    if (!Number(contaAvulsa.valor) || Number(contaAvulsa.valor) <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    if (!contaAvulsa.vencimento) {
      setError("Informe o vencimento.");
      return;
    }

    try {
      setSalvandoAvulsa(true);
      setError("");
      await api.post("/contas-pagar", {
        descricao: contaAvulsa.descricao.trim(),
        fornecedorId: contaAvulsa.fornecedorId || null,
        valor: Number(contaAvulsa.valor),
        moeda: contaAvulsa.moeda,
        cotacaoDolar: contaAvulsa.cotacaoDolar ? Number(contaAvulsa.cotacaoDolar) : null,
        vencimento: contaAvulsa.vencimento,
        formaPagamento: contaAvulsa.formaPagamento,
        observacao: contaAvulsa.observacao || null,
      });
      setMostrarModalAvulsa(false);
      setContaAvulsa(contaAvulsaVazia);
      setSuccess("Conta a pagar cadastrada.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao cadastrar conta a pagar");
    } finally {
      setSalvandoAvulsa(false);
    }
  };

  const headers = [
    {
      label: "Vencimento",
      key: "vencimento",
      render: (conta) => conta.vencimento,
    },
    {
      label: "Descrição / Fornecedor",
      render: (conta) => (
        <div>
          <p className="font-semibold text-gray-900">{conta.descricao || "-"}</p>
          <p className="text-xs text-gray-500">{conta.fornecedor?.nome || "-"}</p>
        </div>
      ),
    },
    {
      label: "Origem",
      render: (conta) => (
        <Badge variant={conta.origem === "COMPRA" ? "info" : "warning"} size="sm">
          {conta.origem === "COMPRA" ? "Compra" : "Avulso"}
        </Badge>
      ),
    },
    {
      label: "Valor",
      render: (conta) => (
        <div>
          <p className="font-semibold">{formatarPorMoeda(conta.valor, conta.moeda)}</p>
          {conta.moeda === "USD" && (
            <p className="text-xs text-gray-500">
              {conta.cotacaoDolar
                ? `Cotação ${conta.cotacaoDolar} — ${formatarPorMoeda(conta.valorBrl, "BRL")}`
                : "Sem cotação informada"}
            </p>
          )}
        </div>
      ),
    },
    {
      label: "Forma",
      render: (conta) =>
        FORMAS_PAGAMENTO.find(([value]) => value === conta.formaPagamento)?.[1] ||
        conta.formaPagamento,
    },
    {
      label: "Status",
      render: (conta) => (
        <Badge variant={conta.status === "PAGA" ? "success" : "warning"} size="sm">
          {conta.status === "PAGA" ? "Paga" : "Pendente"}
        </Badge>
      ),
    },
    {
      label: "Ações",
      render: (conta) =>
        conta.status === "PENDENTE" ? (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary px-3 py-1.5 text-xs"
              onClick={() => marcarComoPaga(conta)}
            >
              Marcar paga
            </button>
            {conta.origem === "AVULSO" && (
              <button
                type="button"
                className="btn-danger px-3 py-1.5 text-xs"
                onClick={() => excluirConta(conta)}
              >
                Excluir
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-500">
            Paga em {conta.pagoEm ? new Date(conta.pagoEm).toLocaleDateString("pt-BR") : "-"}
          </span>
        ),
    },
  ];

  if (loading || authLoading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Contas a Pagar"
          subtitle={`Usuário: ${usuario?.nome || "-"} (${usuario?.role || "-"})`}
          icon="💳"
          action={{
            label: "+ Nova conta avulsa",
            onClick: () => setMostrarModalAvulsa(true),
          }}
        />

        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}
        {success && (
          <AlertBox type="success" message={success} onClose={() => setSuccess("")} />
        )}

        <StatsGrid
          stats={[
            {
              label: "Pendente",
              value: moeda.format(stats.totalPendente),
              icon: "⏳",
              gradient: "bg-gradient-to-br from-amber-500 to-orange-600",
            },
            {
              label: "Vencendo em 7 dias",
              value: moeda.format(stats.totalVencendoEm7Dias),
              icon: "⚠️",
              gradient: "bg-gradient-to-br from-orange-500 to-red-500",
            },
            {
              label: "Vencidas",
              value: moeda.format(stats.totalVencidas),
              subtitle: `${stats.quantidadeVencidas} conta(s)`,
              icon: "🚨",
              gradient: "bg-gradient-to-br from-red-600 to-red-800",
            },
            {
              label: "Pago",
              value: moeda.format(stats.totalPago),
              icon: "✅",
              gradient: "bg-gradient-to-br from-green-500 to-emerald-600",
            },
          ]}
        />

        <div className="card">
          <form onSubmit={aplicarFiltros} className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Status
              </label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltros((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Todos</option>
                <option value="PENDENTE">Pendente</option>
                <option value="PAGA">Paga</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Fornecedor
              </label>
              <select
                value={filtros.fornecedorId}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, fornecedorId: e.target.value }))
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
                Origem
              </label>
              <select
                value={filtros.origem}
                onChange={(e) => setFiltros((prev) => ({ ...prev, origem: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Todas</option>
                <option value="COMPRA">Compra</option>
                <option value="AVULSO">Avulso</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Vencimento de
              </label>
              <input
                type="date"
                value={filtros.vencimentoInicio}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, vencimentoInicio: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                até
              </label>
              <input
                type="date"
                value={filtros.vencimentoFim}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, vencimentoFim: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-5 flex gap-2">
              <button type="submit" className="btn-primary px-4 py-2 text-sm">
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={limparFiltros}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Limpar
              </button>
            </div>
          </form>
        </div>

        <DataTable headers={headers} data={contas} emptyMessage="Nenhuma conta a pagar encontrada." />
      </div>

      <Modal
        isOpen={mostrarModalAvulsa}
        onClose={() => setMostrarModalAvulsa(false)}
        title="Nova conta avulsa"
        size="md"
      >
        <form onSubmit={salvarContaAvulsa} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Descrição</label>
            <input
              value={contaAvulsa.descricao}
              onChange={(e) =>
                setContaAvulsa((prev) => ({ ...prev, descricao: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              placeholder="Ex: Aluguel do depósito"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Fornecedor (opcional)
            </label>
            <select
              value={contaAvulsa.fornecedorId}
              onChange={(e) =>
                setContaAvulsa((prev) => ({ ...prev, fornecedorId: e.target.value }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            >
              <option value="">Nenhum</option>
              {fornecedores.map((fornecedor) => (
                <option key={fornecedor.id} value={fornecedor.id}>
                  {fornecedor.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Valor</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={contaAvulsa.valor}
                onChange={(e) =>
                  setContaAvulsa((prev) => ({ ...prev, valor: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Moeda</label>
              <div className="flex gap-2">
                {["BRL", "USD"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setContaAvulsa((prev) => ({ ...prev, moeda: value }))}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                      contaAvulsa.moeda === value
                        ? "border-primary bg-primary text-white"
                        : "border-orange-200 bg-white text-gray-700 hover:bg-orange-100"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {contaAvulsa.moeda === "USD" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cotação US$→R$ (opcional)
              </label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={contaAvulsa.cotacaoDolar}
                onChange={(e) =>
                  setContaAvulsa((prev) => ({ ...prev, cotacaoDolar: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                placeholder="Ex: 5.35"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Vencimento</label>
              <input
                type="date"
                value={contaAvulsa.vencimento}
                onChange={(e) =>
                  setContaAvulsa((prev) => ({ ...prev, vencimento: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Forma de pagamento
              </label>
              <select
                value={contaAvulsa.formaPagamento}
                onChange={(e) =>
                  setContaAvulsa((prev) => ({ ...prev, formaPagamento: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                {FORMAS_PAGAMENTO.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Observação (opcional)
            </label>
            <textarea
              value={contaAvulsa.observacao}
              onChange={(e) =>
                setContaAvulsa((prev) => ({ ...prev, observacao: e.target.value }))
              }
              className="min-h-16 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary px-4 py-2 text-sm"
              onClick={() => setMostrarModalAvulsa(false)}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvandoAvulsa}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
            >
              {salvandoAvulsa ? "Salvando..." : "Cadastrar conta"}
            </button>
          </div>
        </form>
      </Modal>

      <Footer />
    </div>
  );
}
