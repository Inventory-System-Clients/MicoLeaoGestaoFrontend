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

export default function Pecas() {
  const { usuario, loading: authLoading } = useAuth();

  const [pecas, setPecas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [estoquesFuncionarios, setEstoquesFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [formPeca, setFormPeca] = useState({
    codigo: "",
    nome: "",
    unidade: "",
    estoqueMinimo: "",
    custoUnitario: "",
  });

  const [acaoAbertaId, setAcaoAbertaId] = useState(null);
  const [formQuantidade, setFormQuantidade] = useState({ quantidade: "" });
  const [formEnvio, setFormEnvio] = useState({
    funcionarioId: "",
    quantidade: "",
    observacao: "",
  });

  const carregarDados = useCallback(async () => {
    try {
      setError("");
      const [pecasRes, funcionariosRes, enviosRes, estoquesRes] =
        await Promise.all([
          api.get("/pecas"),
          api.get("/manutencoes/funcionarios"),
          api.get("/pecas/envios"),
          api.get("/pecas/estoque-funcionario"),
        ]);

      setPecas(Array.isArray(pecasRes.data) ? pecasRes.data : []);
      setFuncionarios(
        Array.isArray(funcionariosRes.data) ? funcionariosRes.data : [],
      );
      setEnvios(Array.isArray(enviosRes.data) ? enviosRes.data : []);
      setEstoquesFuncionarios(
        Array.isArray(estoquesRes.data) ? estoquesRes.data : [],
      );
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

  const handleCriarPeca = async (event) => {
    event.preventDefault();
    if (!formPeca.nome.trim()) {
      setError("Informe o nome da peça.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post("/pecas", {
        codigo: formPeca.codigo.trim() || null,
        nome: formPeca.nome.trim(),
        unidade: formPeca.unidade.trim() || null,
        estoqueMinimo: formPeca.estoqueMinimo || 0,
        custoUnitario: formPeca.custoUnitario || null,
      });
      setFormPeca({
        codigo: "",
        nome: "",
        unidade: "",
        estoqueMinimo: "",
        custoUnitario: "",
      });
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao criar peça");
    } finally {
      setSubmitting(false);
    }
  };

  const abrirAcao = (pecaId, tipo) => {
    const chave = `${tipo}:${pecaId}`;
    setAcaoAbertaId((atual) => (atual === chave ? null : chave));
    setFormQuantidade({ quantidade: "" });
    setFormEnvio({ funcionarioId: "", quantidade: "", observacao: "" });
  };

  const handleLancarQuantidade = async (event, pecaId) => {
    event.preventDefault();
    const quantidadeNumerica = Number(formQuantidade.quantidade);
    if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
      setError("Informe uma quantidade válida (inteiro maior que zero).");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post(`/pecas/${pecaId}/lancar-quantidade`, {
        quantidade: quantidadeNumerica,
      });
      setAcaoAbertaId(null);
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao lançar quantidade");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnviarPeca = async (event, pecaId) => {
    event.preventDefault();
    const quantidadeNumerica = Number(formEnvio.quantidade);
    if (!formEnvio.funcionarioId) {
      setError("Selecione o funcionário.");
      return;
    }
    if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
      setError("Informe uma quantidade válida (inteiro maior que zero).");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post(`/pecas/${pecaId}/enviar`, {
        funcionarioId: formEnvio.funcionarioId,
        quantidade: quantidadeNumerica,
        observacao: formEnvio.observacao || null,
      });
      setAcaoAbertaId(null);
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao enviar peça para funcionário");
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
          title="Peças"
          subtitle={`Usuário: ${usuario?.nome || "-"} (${usuario?.role || "-"})`}
          icon="🔧"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Nova peça
          </h2>
          <form
            onSubmit={handleCriarPeca}
            className="grid grid-cols-1 gap-4 md:grid-cols-5"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Código
              </label>
              <input
                value={formPeca.codigo}
                onChange={(e) =>
                  setFormPeca((prev) => ({ ...prev, codigo: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                placeholder="Ex: PC-001"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nome
              </label>
              <input
                value={formPeca.nome}
                onChange={(e) =>
                  setFormPeca((prev) => ({ ...prev, nome: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                placeholder="Ex: Trava da garra"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Unidade
              </label>
              <input
                value={formPeca.unidade}
                onChange={(e) =>
                  setFormPeca((prev) => ({ ...prev, unidade: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                placeholder="Ex: un"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Estoque mínimo
              </label>
              <input
                type="number"
                min="0"
                value={formPeca.estoqueMinimo}
                onChange={(e) =>
                  setFormPeca((prev) => ({
                    ...prev,
                    estoqueMinimo: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-5 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary disabled:opacity-60"
              >
                {submitting ? "Salvando..." : "Adicionar peça"}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Peças ({pecas.length})
          </h2>

          {pecas.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhuma peça cadastrada.</p>
          ) : (
            <div className="space-y-3">
              {pecas.map((peca) => {
                const estoqueBaixo =
                  peca.estoqueMinimo !== null &&
                  peca.estoqueMinimo !== undefined &&
                  Number(peca.quantidadeEstoque) < Number(peca.estoqueMinimo);
                const chaveQuantidade = `quantidade:${peca.id}`;
                const chaveEnvio = `envio:${peca.id}`;

                return (
                  <div
                    key={peca.id}
                    className="rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">
                          {peca.codigo ? `${peca.codigo} - ` : ""}
                          {peca.nome}
                        </h3>
                        <p className="text-xs text-gray-600">
                          Estoque central: {peca.quantidadeEstoque}{" "}
                          {peca.unidade || ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {estoqueBaixo && (
                          <Badge variant="danger" size="sm">
                            Estoque baixo
                          </Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => abrirAcao(peca.id, "quantidade")}
                          className="btn-secondary text-sm"
                        >
                          {acaoAbertaId === chaveQuantidade
                            ? "Cancelar"
                            : "Lançar quantidade"}
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirAcao(peca.id, "envio")}
                          className="btn-secondary text-sm"
                        >
                          {acaoAbertaId === chaveEnvio
                            ? "Cancelar"
                            : "Enviar para funcionário"}
                        </button>
                      </div>
                    </div>

                    {acaoAbertaId === chaveQuantidade && (
                      <form
                        onSubmit={(e) => handleLancarQuantidade(e, peca.id)}
                        className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 p-3"
                      >
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">
                            Quantidade a adicionar
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={formQuantidade.quantidade}
                            onChange={(e) =>
                              setFormQuantidade({ quantidade: e.target.value })
                            }
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="btn-primary text-sm disabled:opacity-60"
                        >
                          {submitting ? "Salvando..." : "Confirmar"}
                        </button>
                      </form>
                    )}

                    {acaoAbertaId === chaveEnvio && (
                      <form
                        onSubmit={(e) => handleEnviarPeca(e, peca.id)}
                        className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-3 md:grid-cols-4"
                      >
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">
                            Funcionário
                          </label>
                          <select
                            value={formEnvio.funcionarioId}
                            onChange={(e) =>
                              setFormEnvio((prev) => ({
                                ...prev,
                                funcionarioId: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                          >
                            <option value="">Selecione...</option>
                            {funcionarios.map((funcionario) => (
                              <option key={funcionario.id} value={funcionario.id}>
                                {funcionario.nome}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">
                            Quantidade
                          </label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={formEnvio.quantidade}
                            onChange={(e) =>
                              setFormEnvio((prev) => ({
                                ...prev,
                                quantidade: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">
                            Observação
                          </label>
                          <input
                            value={formEnvio.observacao}
                            onChange={(e) =>
                              setFormEnvio((prev) => ({
                                ...prev,
                                observacao: e.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            type="submit"
                            disabled={submitting}
                            className="btn-primary text-sm disabled:opacity-60"
                          >
                            {submitting ? "Salvando..." : "Enviar"}
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
            Envios recentes
          </h2>
          {envios.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhum envio registrado.</p>
          ) : (
            <div className="space-y-2 text-xs text-gray-700">
              {envios.slice(0, 10).map((envio) => (
                <div
                  key={envio.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2"
                >
                  <span>
                    {formatarDataHora(envio.dataEnvio)} —{" "}
                    <strong>{envio.peca?.nome}</strong>: {envio.quantidade}{" "}
                    {envio.peca?.unidade || ""} para{" "}
                    {envio.funcionario?.nome || "-"}
                  </span>
                  <span className="text-gray-500">
                    enviado por {envio.enviadoPor?.nome || "-"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Estoque de peças por funcionário
          </h2>
          {estoquesFuncionarios.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhum funcionário com peças em estoque.
            </p>
          ) : (
            <div className="space-y-2 text-xs text-gray-700">
              {estoquesFuncionarios
                .filter((item) => item.quantidade > 0)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2"
                  >
                    <span>
                      <strong>{item.funcionario?.nome}</strong> —{" "}
                      {item.peca?.nome}
                    </span>
                    <span className="text-gray-500">
                      {item.quantidade} {item.peca?.unidade || ""}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
