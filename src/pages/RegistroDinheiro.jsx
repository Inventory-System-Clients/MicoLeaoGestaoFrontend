import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import RegistrarDinheiro from "../components/RegistrarDinheiro";
import { filtrarLojasOperacionais } from "../utils/lojas";

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

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("pt-BR");
};

const paraDataISO = (data) => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

const filtrosPadrao = () => {
  const hoje = new Date();
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(hoje.getDate() - 30);
  return {
    lojaId: "",
    maquinaId: "",
    conferidoPorId: "",
    dataInicio: paraDataISO(trintaDiasAtras),
    dataFim: paraDataISO(hoje),
  };
};

export function RegistroDinheiro() {
  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filtros, setFiltros] = useState(filtrosPadrao);
  const [filtrosAplicados, setFiltrosAplicados] = useState(filtrosPadrao);

  const carregarBase = async () => {
    try {
      setLoading(true);
      const [lojasRes, maquinasRes, usuariosRes] = await Promise.all([
        api.get("/lojas"),
        api.get("/maquinas"),
        // /usuarios é restrito a ADMIN/FUNCIONARIO_ESTOQUE; um DESENVOLVEDOR
        // pode não ter acesso, então isso não pode derrubar a página inteira.
        api.get("/usuarios").catch(() => ({ data: [] })),
      ]);
      setLojas(filtrarLojasOperacionais(lojasRes.data || []));
      setMaquinas(maquinasRes.data || []);
      setUsuarios(usuariosRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      setError("Erro ao carregar dados iniciais.");
    } finally {
      setLoading(false);
    }
  };

  const carregarHistorico = async (filtrosAtuais) => {
    try {
      setLoadingHistorico(true);
      const params = {};
      if (filtrosAtuais.lojaId) params.lojaId = filtrosAtuais.lojaId;
      if (filtrosAtuais.maquinaId) params.maquinaId = filtrosAtuais.maquinaId;
      if (filtrosAtuais.conferidoPorId) {
        params.conferidoPorId = filtrosAtuais.conferidoPorId;
      }
      if (filtrosAtuais.dataInicio)
        params.dataInicio = filtrosAtuais.dataInicio;
      if (filtrosAtuais.dataFim) params.dataFim = filtrosAtuais.dataFim;

      const response = await api.get("/registro-dinheiro", { params });
      setHistorico(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Erro ao carregar histórico de registro de dinheiro:", err);
      setError("Erro ao carregar histórico de registros.");
    } finally {
      setLoadingHistorico(false);
    }
  };

  useEffect(() => {
    carregarBase();
  }, []);

  useEffect(() => {
    carregarHistorico(filtrosAplicados);
  }, [filtrosAplicados]);

  const aplicarFiltros = (event) => {
    event.preventDefault();
    setFiltrosAplicados({ ...filtros });
  };

  const limparFiltros = () => {
    const padrao = filtrosPadrao();
    setFiltros(padrao);
    setFiltrosAplicados(padrao);
  };

  const maquinasDaLojaFiltro = useMemo(() => {
    if (!filtros.lojaId) return maquinas;
    return maquinas.filter((m) => m.lojaId === filtros.lojaId);
  }, [filtros.lojaId, maquinas]);

  const handleSubmit = async (data) => {
    try {
      setError("");
      setSuccess("");
      const response = await api.post("/registro-dinheiro", data);
      const diferenca = Number(response.data?.diferenca || 0);
      setSuccess(
        Math.abs(diferenca) >= 0.01
          ? `Registro salvo, mas com divergência de R$ ${diferenca.toFixed(2)} em relação ao valor esperado pelo sistema.`
          : "Registro de dinheiro salvo com sucesso, sem divergência!",
      );
      await carregarHistorico(filtrosAplicados);
      if (Math.abs(diferenca) >= 0.01) {
        window.location.reload();
      }
      return response.data;
    } catch (err) {
      setError(err?.response?.data?.error || "Erro ao registrar dinheiro.");
      return null;
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="💵 Registrar Dinheiro"
          subtitle="Feche o caixa de uma máquina ou loja e compare com o valor esperado pelo sistema"
          icon="💵"
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

        <div className="card mb-6">
          <RegistrarDinheiro
            lojas={lojas}
            maquinas={maquinas}
            usuarios={usuarios}
            onSubmit={handleSubmit}
          />
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Histórico de Registros
          </h2>

          <form
            onSubmit={aplicarFiltros}
            className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  🏪 Loja
                </label>
                <select
                  value={filtros.lojaId}
                  onChange={(e) =>
                    setFiltros((prev) => ({
                      ...prev,
                      lojaId: e.target.value,
                      maquinaId: "",
                    }))
                  }
                  className="select-field"
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
                  🎮 Máquina
                </label>
                <select
                  value={filtros.maquinaId}
                  onChange={(e) =>
                    setFiltros((prev) => ({
                      ...prev,
                      maquinaId: e.target.value,
                    }))
                  }
                  className="select-field"
                >
                  <option value="">Todas</option>
                  {maquinasDaLojaFiltro.map((maquina) => (
                    <option key={maquina.id} value={maquina.id}>
                      {maquina.codigo} - {maquina.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                  👤 Quem conferiu
                </label>
                <select
                  value={filtros.conferidoPorId}
                  onChange={(e) =>
                    setFiltros((prev) => ({
                      ...prev,
                      conferidoPorId: e.target.value,
                    }))
                  }
                  className="select-field"
                >
                  <option value="">Todos</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    📅 De
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
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    📅 Até
                  </label>
                  <input
                    type="date"
                    value={filtros.dataFim}
                    onChange={(e) =>
                      setFiltros((prev) => ({
                        ...prev,
                        dataFim: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" className="btn-primary">
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={limparFiltros}
                className="btn-secondary"
              >
                Últimos 30 dias
              </button>
            </div>
          </form>

          {loadingHistorico ? (
            <div className="py-8 text-center text-gray-600">
              Carregando histórico...
            </div>
          ) : historico.length === 0 ? (
            <div className="py-8 text-center text-gray-600">
              Nenhum registro de dinheiro encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>Loja</th>
                    <th>Máquina</th>
                    <th>Período</th>
                    <th>Contado</th>
                    <th>Esperado</th>
                    <th>Diferença</th>
                    <th>Conferido por</th>
                    <th>Registrado em</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((item) => {
                    const contado =
                      Number(item.valorDinheiro || 0) +
                      Number(item.valorCartaoPix || 0) +
                      Number(item.valorBlink || 0);
                    const diferenca = Number(item.diferenca || 0);

                    return (
                      <tr key={item.id}>
                        <td>{item.loja?.nome || "-"}</td>
                        <td>
                          {item.registrarTotalLoja
                            ? "Total da loja"
                            : item.maquina?.nome || "-"}
                        </td>
                        <td>
                          {formatDate(item.inicio)} — {formatDate(item.fim)}
                        </td>
                        <td>R$ {formatCurrency(contado)}</td>
                        <td>
                          {item.valorEsperadoSistema !== null
                            ? `R$ ${formatCurrency(item.valorEsperadoSistema)}`
                            : "-"}
                        </td>
                        <td
                          className={
                            Math.abs(diferenca) >= 0.01
                              ? "font-bold text-red-600"
                              : "text-emerald-600"
                          }
                        >
                          R$ {formatCurrency(diferenca)}
                        </td>
                        <td>{item.conferidoPor?.nome || "-"}</td>
                        <td>{formatDateTime(item.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default RegistroDinheiro;
