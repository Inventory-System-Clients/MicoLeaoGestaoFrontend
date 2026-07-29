import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, DataTable, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import LancarGastoVariavel from "../components/LancarGastoVariavel";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const getPrimeiroDiaMesAtual = () => {
  const hoje = new Date();
  return toDateInputValue(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
};

const getUltimoDiaMesAtual = () => {
  const hoje = new Date();
  return toDateInputValue(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
};

export function GastosVariaveis() {
  const [lojas, setLojas] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalAberto, setModalAberto] = useState(false);

  const [filtroLojaId, setFiltroLojaId] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState(
    getPrimeiroDiaMesAtual,
  );
  const [filtroDataFim, setFiltroDataFim] = useState(getUltimoDiaMesAtual);

  const [editando, setEditando] = useState(null);
  const [editForm, setEditForm] = useState({
    lojaId: "",
    nome: "",
    valor: "",
    observacao: "",
    data: "",
  });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const carregarGastos = async (filtros = {}) => {
    try {
      setLoading(true);
      setError("");
      const {
        lojaId = filtroLojaId,
        nome = filtroCategoria,
        dataInicio = filtroDataInicio,
        dataFim = filtroDataFim,
      } = filtros;

      const params = {};
      if (lojaId) params.lojaId = lojaId;
      if (nome) params.nome = nome;
      if (dataInicio) params.dataInicio = dataInicio;
      if (dataFim) params.dataFim = dataFim;

      const response = await api.get("/gastos-variaveis", { params });
      setGastos(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Erro ao carregar gastos variáveis:", err);
      setError("Erro ao carregar gastos variáveis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const carregarBase = async () => {
      try {
        const [lojasRes, veiculosRes] = await Promise.all([
          api.get("/lojas"),
          api.get("/veiculos"),
        ]);
        setLojas(lojasRes.data || []);
        setVeiculos(veiculosRes.data || []);
      } catch (err) {
        console.error("Erro ao carregar lojas/veículos:", err);
      }
    };
    carregarBase();
    carregarGastos();
  }, []);

  const handleFiltrar = (event) => {
    event.preventDefault();
    carregarGastos();
  };

  const handleLimparFiltros = () => {
    const dataInicio = getPrimeiroDiaMesAtual();
    const dataFim = getUltimoDiaMesAtual();
    setFiltroLojaId("");
    setFiltroCategoria("");
    setFiltroDataInicio(dataInicio);
    setFiltroDataFim(dataFim);
    carregarGastos({ lojaId: "", nome: "", dataInicio, dataFim });
  };

  const abrirEdicao = (gasto) => {
    setEditando(gasto);
    setEditForm({
      lojaId: gasto.lojaId || "",
      nome: gasto.nome || "",
      valor: gasto.valor ?? "",
      observacao: gasto.observacao || "",
      data: toDateInputValue(gasto.dataInicio),
    });
  };

  const fecharEdicao = () => {
    setEditando(null);
  };

  const salvarEdicao = async () => {
    if (!editando || salvandoEdicao) return;
    try {
      setSalvandoEdicao(true);
      await api.put(`/gastos-variaveis/${editando.id}`, {
        lojaId: editForm.lojaId,
        nome: editForm.nome,
        valor: Number(editForm.valor),
        observacao: editForm.observacao || undefined,
        data: editForm.data,
      });
      setSuccess("Gasto variável atualizado com sucesso!");
      fecharEdicao();
      carregarGastos();
    } catch (err) {
      console.error("Erro ao atualizar gasto variável:", err);
      Swal.fire(
        "Erro",
        err?.response?.data?.error || "Não foi possível atualizar o gasto.",
        "error",
      );
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const excluirGasto = async (gasto) => {
    const confirmacao = await Swal.fire({
      icon: "warning",
      title: "Excluir gasto?",
      text: `Tem certeza que deseja excluir "${gasto.nome}" (R$ ${formatCurrency(gasto.valor)})?`,
      showCancelButton: true,
      confirmButtonText: "Excluir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (!confirmacao.isConfirmed) return;

    try {
      await api.delete(`/gastos-variaveis/${gasto.id}`);
      setSuccess("Gasto variável excluído com sucesso!");
      carregarGastos();
    } catch (err) {
      console.error("Erro ao excluir gasto variável:", err);
      Swal.fire(
        "Erro",
        err?.response?.data?.error || "Não foi possível excluir o gasto.",
        "error",
      );
    }
  };

  const totalFiltrado = gastos.reduce(
    (acc, gasto) => acc + Number(gasto.valor || 0),
    0,
  );

  const headers = [
    { key: "data", label: "Data", render: (g) => formatDateTime(g.dataInicio) },
    { key: "nome", label: "Categoria" },
    {
      key: "loja",
      label: "Loja",
      render: (g) => g.loja?.nome || lojas.find((l) => l.id === g.lojaId)?.nome || "-",
    },
    { key: "usuario", label: "Usuário", render: (g) => g.usuario?.nome || "-" },
    { key: "veiculo", label: "Veículo", render: (g) => g.veiculo?.nome || "-" },
    {
      key: "valor",
      label: "Valor",
      render: (g) => `R$ ${formatCurrency(g.valor)}`,
    },
    { key: "observacao", label: "Observação", render: (g) => g.observacao || "-" },
    {
      key: "acoes",
      label: "Ações",
      render: (g) => (
        <div className="flex gap-2 justify-center">
          <button
            className="px-3 py-1 text-xs rounded bg-blue-100 text-blue-800 hover:bg-blue-200 font-semibold"
            onClick={() => abrirEdicao(g)}
          >
            Editar
          </button>
          <button
            className="px-3 py-1 text-xs rounded bg-red-100 text-red-800 hover:bg-red-200 font-semibold"
            onClick={() => excluirGasto(g)}
          >
            Excluir
          </button>
        </div>
      ),
    },
  ];

  if (loading && gastos.length === 0) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Gastos Variáveis"
          subtitle="Gasolina, estacionamento e outros gastos avulsos"
          icon="🧾"
          action={{
            label: "Lançar Gasto Variável",
            onClick: () => setModalAberto(true),
          }}
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

        {modalAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="relative w-full max-w-md rounded-lg border border-orange-100 bg-white p-6 shadow-2xl">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar"
              >
                ×
              </button>
              <LancarGastoVariavel
                lojas={lojas}
                veiculos={veiculos}
                onClose={() => setModalAberto(false)}
                onSuccess={() => {
                  setSuccess("Gasto variável lançado com sucesso!");
                  carregarGastos();
                }}
              />
            </div>
          </div>
        )}

        {editando && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 shadow-lg relative">
              <button
                onClick={fecharEdicao}
                style={{
                  position: "absolute",
                  top: 12,
                  right: 16,
                  fontSize: 22,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#888",
                }}
                aria-label="Fechar"
              >
                ×
              </button>
              <h2 className="text-lg font-bold mb-4">Editar Gasto</h2>
              <div className="mb-3">
                <label className="block text-sm font-medium">Categoria</label>
                <input
                  value={editForm.nome}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, nome: e.target.value }))
                  }
                  className="w-full border rounded p-1"
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Loja</label>
                <select
                  value={editForm.lojaId}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      lojaId: e.target.value,
                    }))
                  }
                  className="w-full border rounded p-1"
                >
                  <option value="">Selecione a loja</option>
                  {lojas.map((loja) => (
                    <option key={loja.id} value={loja.id}>
                      {loja.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editForm.valor}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      valor: e.target.value,
                    }))
                  }
                  className="w-full border rounded p-1"
                  onWheel={(e) => e.target.blur()}
                />
              </div>
              <div className="mb-3">
                <label className="block text-sm font-medium">Data</label>
                <input
                  type="date"
                  value={editForm.data}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, data: e.target.value }))
                  }
                  className="w-full border rounded p-1"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium">
                  Observação:
                </label>
                <input
                  value={editForm.observacao}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      observacao: e.target.value,
                    }))
                  }
                  className="w-full border rounded p-1"
                  placeholder="Opcional"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-1 bg-gray-300 rounded hover:bg-gray-400"
                  onClick={fecharEdicao}
                  disabled={salvandoEdicao}
                >
                  Cancelar
                </button>
                <button
                  className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={salvarEdicao}
                  disabled={
                    salvandoEdicao ||
                    !editForm.lojaId ||
                    !editForm.nome ||
                    !editForm.valor
                  }
                >
                  {salvandoEdicao ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleFiltrar}
          className="card-gradient mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Loja
            </label>
            <select
              value={filtroLojaId}
              onChange={(e) => setFiltroLojaId(e.target.value)}
              className="input-field"
            >
              <option value="">Todas as lojas</option>
              {lojas.map((loja) => (
                <option key={loja.id} value={loja.id}>
                  {loja.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Categoria
            </label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="input-field"
            >
              <option value="">Todas</option>
              <option value="Gasolina">Gasolina</option>
              <option value="Estacionamento">Estacionamento</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              De
            </label>
            <input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Até
            </label>
            <input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="md:col-span-4 flex gap-3">
            <button type="submit" className="btn-primary">
              Filtrar
            </button>
            <button
              type="button"
              onClick={handleLimparFiltros}
              className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-100"
            >
              Limpar filtro
            </button>
          </div>
        </form>

        <div className="card-gradient mb-6">
          <p className="text-sm font-semibold text-gray-700">
            Total no período filtrado
          </p>
          <p className="text-3xl font-bold text-gray-900">
            R$ {formatCurrency(totalFiltrado)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {gastos.length} registro(s) encontrado(s)
          </p>
        </div>

        <DataTable
          headers={headers}
          data={gastos}
          emptyMessage="Nenhum gasto variável encontrado no período."
        />
      </div>
      <Footer />
    </div>
  );
}

export default GastosVariaveis;
