import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, DataTable, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

const filtrosIniciais = {
  maquina: "",
  lojaId: "",
  dataInicio: "",
  dataFim: "",
};

const formatarDataOnly = (valor) => {
  if (!valor) return "-";
  const [ano, mes, dia] = String(valor).split("-");
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
};

export function RelatorioTransferenciasMaquinas() {
  const navigate = useNavigate();
  const [lojas, setLojas] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtrosIniciais);

  useEffect(() => {
    api
      .get("/lojas")
      .then((res) => setLojas(res.data || []))
      .catch(() => setLojas([]));
  }, []);

  useEffect(() => {
    const carregar = async () => {
      try {
        setLoading(true);
        setError("");
        const params = Object.fromEntries(
          Object.entries(filtrosAplicados).filter(([, valor]) => valor),
        );
        const response = await api.get("/relatorios/transferencias-maquinas", {
          params,
        });
        setTransferencias(response.data || []);
      } catch (err) {
        setError(
          "Erro ao carregar transferências: " +
            (err.response?.data?.error || err.message),
        );
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, [filtrosAplicados]);

  const aplicarFiltros = (e) => {
    e.preventDefault();
    setFiltrosAplicados({ ...filtros });
  };

  const limparFiltros = () => {
    setFiltros(filtrosIniciais);
    setFiltrosAplicados(filtrosIniciais);
  };

  const columns = useMemo(
    () => [
      {
        key: "dataTransferencia",
        label: "Data",
        render: (item) => formatarDataOnly(item.dataTransferencia),
      },
      {
        key: "maquina",
        label: "Máquina",
        render: (item) => (
          <button
            type="button"
            className="text-primary hover:underline font-semibold"
            onClick={() => navigate(`/maquinas/${item.maquina?.id}`)}
          >
            {item.maquina?.codigo} — {item.maquina?.nome || "-"}
          </button>
        ),
      },
      {
        key: "origem",
        label: "De",
        render: (item) => item.lojaOrigem?.nome || "Galpão (sem loja)",
      },
      {
        key: "destino",
        label: "Para",
        render: (item) => item.lojaDestino?.nome || "Galpão (sem loja)",
      },
      {
        key: "usuario",
        label: "Registrado por",
        render: (item) => item.usuario?.nome || "-",
      },
      {
        key: "observacao",
        label: "Observação",
        render: (item) => item.observacao || "-",
      },
    ],
    [navigate],
  );

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Transferências de Máquinas"
          subtitle="Rastreabilidade: todas as mudanças de localização das máquinas desde o cadastro"
          icon="🔁"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}

        <form
          onSubmit={aplicarFiltros}
          className="card mb-6 border border-slate-200 bg-slate-50"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Máquina (código ou produto)
              </label>
              <input
                value={filtros.maquina}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, maquina: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="Ex: 1044, Casinha..."
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Loja (origem ou destino)
              </label>
              <select
                value={filtros.lojaId}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, lojaId: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Todas</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                Data início
              </label>
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) =>
                  setFiltros((prev) => ({
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
                value={filtros.dataFim}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, dataFim: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-4">
              <button type="submit" className="btn-primary">
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={limparFiltros}
                className="btn-secondary"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </form>

        {loading ? (
          <PageLoader />
        ) : (
          <DataTable
            headers={columns}
            data={transferencias}
            emptyMessage="Nenhuma transferência encontrada para os filtros selecionados."
          />
        )}
      </div>

      <Footer />
    </div>
  );
}
