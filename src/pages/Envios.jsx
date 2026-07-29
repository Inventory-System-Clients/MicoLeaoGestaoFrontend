import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { AlertBox, Badge, PageHeader } from "../components/UIComponents";
import { filtrarLojasOperacionais } from "../utils/lojas";

const STATUS_LACRE = {
  SEPARADO: { label: "Separado", variant: "warning" },
  EM_TRANSITO: { label: "Em trânsito", variant: "info" },
  CONFERIDO: { label: "Conferido", variant: "success" },
  DIVERGENTE: { label: "Divergente", variant: "danger" },
};

const novoLacreVazio = () => ({
  numero: "",
  itens: [{ produtoId: "", quantidade: "" }],
});

const formatarDataHora = (dataIso) => {
  if (!dataIso) return "-";
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR");
};

const numeroLacrePendente = (numero) =>
  String(numero || "").startsWith("PENDENTE-");

const formatarNumeroLacre = (numero) =>
  numeroLacrePendente(numero) ? "Aguardando lacre" : numero;

export default function Envios() {
  const { usuario, loading: authLoading } = useAuth();
  const location = useLocation();
  const prefill = location.state;
  const isEntregador = usuario?.role === "ENTREGADOR";

  const [envios, setEnvios] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [divergentes, setDivergentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [numerosRetirada, setNumerosRetirada] = useState({});

  const [form, setForm] = useState({
    lojaDestinoId: prefill?.lojaDestinoId || "",
    transportadorId: "",
    observacao: "",
    lacres: [
      prefill?.produtoId
        ? {
            numero: "",
            itens: [
              {
                produtoId: prefill.produtoId,
                quantidade: prefill.quantidade || "",
              },
            ],
          }
        : novoLacreVazio(),
    ],
  });

  const carregarDados = useCallback(async () => {
    try {
      setError("");
      if (isEntregador) {
        const enviosRes = await api.get("/envios");
        setEnvios(Array.isArray(enviosRes.data) ? enviosRes.data : []);
        setLoading(false);
        return;
      }

      const [enviosRes, lojasRes, usuariosRes, produtosRes, divergentesRes] =
        await Promise.all([
          api.get("/envios"),
          api.get("/lojas"),
          api.get("/usuarios"),
          api.get("/produtos"),
          api.get("/lacres/divergentes"),
        ]);

      setEnvios(Array.isArray(enviosRes.data) ? enviosRes.data : []);
      setLojas(filtrarLojasOperacionais(Array.isArray(lojasRes.data) ? lojasRes.data : []));
      setUsuarios(
        Array.isArray(usuariosRes.data)
          ? usuariosRes.data.filter((user) => user.role === "ENTREGADOR")
          : [],
      );
      setProdutos(Array.isArray(produtosRes.data) ? produtosRes.data : []);
      setDivergentes(
        Array.isArray(divergentesRes.data) ? divergentesRes.data : [],
      );
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [isEntregador]);

  useEffect(() => {
    if (authLoading) return;
    carregarDados();
  }, [authLoading, carregarDados]);

  const adicionarLacre = () => {
    setForm((prev) => ({
      ...prev,
      lacres: [...prev.lacres, novoLacreVazio()],
    }));
  };

  const removerLacre = (indexLacre) => {
    setForm((prev) => ({
      ...prev,
      lacres: prev.lacres.filter((_, idx) => idx !== indexLacre),
    }));
  };

  const atualizarNumeroLacre = (indexLacre, numero) => {
    setForm((prev) => ({
      ...prev,
      lacres: prev.lacres.map((lacre, idx) =>
        idx === indexLacre ? { ...lacre, numero } : lacre,
      ),
    }));
  };

  const adicionarItem = (indexLacre) => {
    setForm((prev) => ({
      ...prev,
      lacres: prev.lacres.map((lacre, idx) =>
        idx === indexLacre
          ? { ...lacre, itens: [...lacre.itens, { produtoId: "", quantidade: "" }] }
          : lacre,
      ),
    }));
  };

  const removerItem = (indexLacre, indexItem) => {
    setForm((prev) => ({
      ...prev,
      lacres: prev.lacres.map((lacre, idx) =>
        idx === indexLacre
          ? { ...lacre, itens: lacre.itens.filter((_, i) => i !== indexItem) }
          : lacre,
      ),
    }));
  };

  const atualizarItem = (indexLacre, indexItem, campo, valor) => {
    setForm((prev) => ({
      ...prev,
      lacres: prev.lacres.map((lacre, idx) =>
        idx === indexLacre
          ? {
              ...lacre,
              itens: lacre.itens.map((item, i) =>
                i === indexItem ? { ...item, [campo]: valor } : item,
              ),
            }
          : lacre,
      ),
    }));
  };

  const handleCriarEnvio = async (event) => {
    event.preventDefault();

    if (!form.lojaDestinoId || !form.transportadorId) {
      setError("Selecione a loja de destino e o transportador.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post("/envios", {
        lojaDestinoId: form.lojaDestinoId,
        transportadorId: form.transportadorId,
        observacao: form.observacao || null,
        lacres: form.lacres.map((lacre) => ({
          numero: lacre.numero,
          itens: lacre.itens.map((item) => ({
            produtoId: item.produtoId,
            quantidade: Number(item.quantidade),
          })),
        })),
      });
      setForm({
        lojaDestinoId: "",
        transportadorId: "",
        observacao: "",
        lacres: [novoLacreVazio()],
      });
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao criar envio");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDespachar = async (envio) => {
    try {
      setError("");
      await api.patch(`/envios/${envio.id}/despachar`, {
        lacres: envio.lacres.map((lacre) => ({
          id: lacre.id,
          numero:
            numerosRetirada[lacre.id] ||
            (numeroLacrePendente(lacre.numero) ? "" : lacre.numero),
        })),
      });
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao despachar envio");
    }
  };

  const handleReabrir = async (lacreId) => {
    try {
      setError("");
      await api.patch(`/lacres/${lacreId}/reabrir`);
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao reabrir lacre");
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
          title={isEntregador ? "Minhas Entregas" : "Envios"}
          subtitle={`Usuário: ${usuario?.nome || "-"} (${usuario?.role || "-"})`}
          icon="📦"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}

        {!isEntregador && prefill?.produtoId && (
          <AlertBox
            type="info"
            message="Loja e produto pré-preenchidos a partir da compra recebida. Informe o número do lacre e o transportador para montar o envio."
          />
        )}

        {!isEntregador && (
        <form onSubmit={handleCriarEnvio} className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Montar novo envio
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Loja de destino
              </label>
              <select
                value={form.lojaDestinoId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, lojaDestinoId: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="">Selecione...</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Transportador
              </label>
              <select
                value={form.transportadorId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    transportadorId: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              >
                <option value="">Selecione...</option>
                {usuarios.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Observação
              </label>
              <input
                value={form.observacao}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, observacao: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {form.lacres.map((lacre, indexLacre) => (
              <div
                key={indexLacre}
                className="rounded-lg border border-gray-200 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Número do lacre
                    </label>
                    <input
                      value={lacre.numero}
                      onChange={(e) =>
                        atualizarNumeroLacre(indexLacre, e.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                      placeholder="Ex: 5011"
                    />
                  </div>
                  {form.lacres.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerLacre(indexLacre)}
                      className="btn-secondary text-xs"
                    >
                      Remover lacre
                    </button>
                  )}
                </div>

                <div className="mt-2 space-y-2">
                  {lacre.itens.map((item, indexItem) => (
                    <div key={indexItem} className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          Produto
                        </label>
                        <select
                          value={item.produtoId}
                          onChange={(e) =>
                            atualizarItem(
                              indexLacre,
                              indexItem,
                              "produtoId",
                              e.target.value,
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                        >
                          <option value="">Selecione...</option>
                          {produtos.map((produto) => (
                            <option key={produto.id} value={produto.id}>
                              {produto.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-28">
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          Quantidade
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantidade}
                          onChange={(e) =>
                            atualizarItem(
                              indexLacre,
                              indexItem,
                              "quantidade",
                              e.target.value,
                            )
                          }
                          className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                        />
                      </div>
                      {lacre.itens.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removerItem(indexLacre, indexItem)}
                          className="btn-secondary text-xs"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => adicionarItem(indexLacre)}
                    className="btn-secondary text-xs"
                  >
                    + Adicionar item
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={adicionarLacre}
              className="btn-secondary text-sm"
            >
              + Adicionar lacre
            </button>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary disabled:opacity-60"
            >
              {submitting ? "Salvando..." : "Montar envio"}
            </button>
          </div>
        </form>
        )}

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {isEntregador ? "Entregas atribuídas" : "Envios"} ({envios.length})
          </h2>

          {envios.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhum envio registrado.</p>
          ) : (
            <div className="space-y-3">
              {envios.map((envio) => (
                <div
                  key={envio.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        {envio.lojaDestino?.nome || "-"}
                      </h3>
                      <p className="text-xs text-gray-600">
                        Separado por {envio.separadoPor?.nome || "-"} — leva{" "}
                        {envio.transportador?.nome || "-"}
                      </p>
                    </div>
                    {!envio.despachadoEm ? (
                      <button
                        type="button"
                        onClick={() => handleDespachar(envio)}
                        className="btn-primary text-sm"
                      >
                        {isEntregador ? "Registrar retirada" : "Despachar"}
                      </button>
                    ) : (
                      <Badge variant="info" size="sm">
                        Despachado em {formatarDataHora(envio.despachadoEm)}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 space-y-2">
                    {envio.lacres.map((lacre) => {
                      const statusInfo =
                        STATUS_LACRE[lacre.status] || STATUS_LACRE.SEPARADO;
                      return (
                        <div
                          key={lacre.id}
                          className="rounded-lg bg-gray-50 p-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-gray-800">
                              Lacre {formatarNumeroLacre(lacre.numero)}
                            </span>
                            <Badge variant={statusInfo.variant} size="sm">
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <p className="mt-1 text-gray-600">
                            {lacre.itens
                              .map(
                                (item) =>
                                  `${item.quantidade}x ${item.produto?.nome || "-"}`,
                              )
                              .join(", ")}
                          </p>
                          {!envio.despachadoEm && (
                            <div className="mt-2">
                              <label className="mb-1 block text-[11px] font-medium text-gray-700">
                                Número físico do lacre
                              </label>
                              <input
                                value={
                                  numerosRetirada[lacre.id] ??
                                  (numeroLacrePendente(lacre.numero)
                                    ? ""
                                    : lacre.numero)
                                }
                                onChange={(event) =>
                                  setNumerosRetirada((prev) => ({
                                    ...prev,
                                    [lacre.id]: event.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                                placeholder="Digite o lacre que está levando"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!isEntregador && (
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Lacres divergentes
          </h2>
          {divergentes.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhum lacre divergente no momento.
            </p>
          ) : (
            <div className="space-y-2">
              {divergentes.map((lacre) => (
                <div
                  key={lacre.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs"
                >
                  <span>
                    Loja <strong>{lacre.envio?.lojaDestino?.nome}</strong> —
                    esperado <strong>{lacre.numero}</strong>, digitado{" "}
                    <strong>{lacre.numeroDigitado}</strong> por{" "}
                    {lacre.conferidoPor?.nome || "-"} em{" "}
                    {formatarDataHora(lacre.conferidoEm)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleReabrir(lacre.id)}
                    className="btn-secondary text-xs"
                  >
                    Reabrir para nova conferência
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
