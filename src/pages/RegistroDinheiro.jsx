import { useEffect, useState } from "react";
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

export function RegistroDinheiro() {
  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const carregarHistorico = async () => {
    try {
      setLoadingHistorico(true);
      const response = await api.get("/registro-dinheiro");
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
    carregarHistorico();
  }, []);

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
      await carregarHistorico();
    } catch (err) {
      setError(
        err?.response?.data?.error || "Erro ao registrar dinheiro.",
      );
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

          {loadingHistorico ? (
            <div className="py-8 text-center text-gray-600">Carregando histórico...</div>
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
