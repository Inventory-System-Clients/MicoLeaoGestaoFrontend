import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { AlertBox, Badge, PageHeader } from "../components/UIComponents";
import { filtrarLojasOperacionais } from "../utils/lojas";
import { SelectBusca } from "../components/SelectBusca";

const STATUS_LACRE = {
  SEPARADO: { label: "Separado", variant: "warning" },
  EM_TRANSITO: { label: "Em trânsito", variant: "info" },
  CONFERIDO: { label: "Conferido", variant: "success" },
  DIVERGENTE: { label: "Divergente", variant: "danger" },
};

const novoLacreVazio = () => ({
  numero: "",
  produtoId: "",
  quantidade: "",
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

  const [envios, setEnvios] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [transportadores, setTransportadores] = useState([]);
  // Rotas do motorista ainda abertas: o envio pode ir por uma delas
  const [rotas, setRotas] = useState([]);
  const [novoTransportadorNome, setNovoTransportadorNome] = useState("");
  const [criandoTransportador, setCriandoTransportador] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [divergentes, setDivergentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [numerosRetirada, setNumerosRetirada] = useState({});
  const [filtroDataHoraInicio, setFiltroDataHoraInicio] = useState("");
  const [filtroDataHoraFim, setFiltroDataHoraFim] = useState("");

  const [form, setForm] = useState({
    lojaDestinoId: prefill?.lojaDestinoId || "",
    transportadorId: "",
    roteiroId: "",
    observacao: "",
    lacres: [
      prefill?.produtoId
        ? {
            numero: "",
            produtoId: prefill.produtoId,
            quantidade: prefill.quantidade || "",
          }
        : novoLacreVazio(),
    ],
  });

  const carregarDados = useCallback(async (params = {}) => {
    try {
      setError("");

      const [
        enviosRes,
        lojasRes,
        transportadoresRes,
        _rotasCarregadas,
        produtosRes,
        divergentesRes,
      ] = await Promise.all([
        api.get("/envios", { params }),
        api.get("/lojas"),
        api.get("/transportadores").catch(() => ({ data: [] })),
        api.get("/roteiros").then((r) => setRotas((Array.isArray(r.data) ? r.data : []).filter((rota) => rota.dataInicio && rota.status !== "FINALIZADA"))).catch(() => setRotas([])),
        api.get("/produtos"),
        api.get("/lacres/divergentes"),
      ]);

      setEnvios(Array.isArray(enviosRes.data) ? enviosRes.data : []);
      setLojas(
        filtrarLojasOperacionais(
          Array.isArray(lojasRes.data) ? lojasRes.data : [],
        ),
      );
      setTransportadores(
        Array.isArray(transportadoresRes.data) ? transportadoresRes.data : [],
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
  }, []);

  useEffect(() => {
    if (authLoading) return;
    carregarDados();
  }, [authLoading, carregarDados]);

  const aplicarFiltros = async () => {
    const params = {};
    if (filtroDataHoraInicio) params.dataInicio = filtroDataHoraInicio;
    if (filtroDataHoraFim) params.dataFim = filtroDataHoraFim;
    setLoading(true);
    await carregarDados(params);
  };

  const limparFiltros = async () => {
    setFiltroDataHoraInicio("");
    setFiltroDataHoraFim("");
    setLoading(true);
    await carregarDados();
  };

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

  const atualizarLacreCampo = (indexLacre, campo, valor) => {
    setForm((prev) => ({
      ...prev,
      lacres: prev.lacres.map((lacre, idx) =>
        idx === indexLacre ? { ...lacre, [campo]: valor } : lacre,
      ),
    }));
  };

  const handleCriarTransportador = async () => {
    const nome = novoTransportadorNome.trim();
    if (!nome) return;

    try {
      setCriandoTransportador(true);
      setError("");
      const response = await api.post("/transportadores", { nome });
      setTransportadores((prev) =>
        [...prev, response.data].sort((a, b) => a.nome.localeCompare(b.nome)),
      );
      setForm((prev) => ({ ...prev, transportadorId: response.data.id }));
      setNovoTransportadorNome("");
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao cadastrar transportador");
    } finally {
      setCriandoTransportador(false);
    }
  };

  const handleCriarEnvio = async (event) => {
    event.preventDefault();

    if (!form.lojaDestinoId || (!form.transportadorId && !form.roteiroId)) {
      setError("Selecione a loja de destino e quem leva (rota do motorista ou transportador).");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post("/envios", {
        lojaDestinoId: form.lojaDestinoId,
        transportadorId: form.transportadorId || null,
        roteiroId: form.roteiroId || null,
        observacao: form.observacao || null,
        lacres: form.lacres.map((lacre) => ({
          numero: lacre.numero,
          itens: [
            {
              produtoId: lacre.produtoId,
              quantidade: Number(lacre.quantidade),
            },
          ],
        })),
      });
      setForm({
        lojaDestinoId: "",
        transportadorId: "",
    roteiroId: "",
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
          title="Envios"
          subtitle={`Usuário: ${usuario?.nome || "-"} (${usuario?.role || "-"})`}
          icon="📦"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Filtros de período
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Início
              </label>
              <input
                type="datetime-local"
                value={filtroDataHoraInicio}
                onChange={(e) => setFiltroDataHoraInicio(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Fim
              </label>
              <input
                type="datetime-local"
                value={filtroDataHoraFim}
                onChange={(e) => setFiltroDataHoraFim(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={aplicarFiltros}
                className="btn-primary text-sm"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={limparFiltros}
                className="btn-secondary text-sm"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </div>

        {prefill?.produtoId && (
          <AlertBox
            type="info"
            message="Loja e produto pré-preenchidos a partir da compra recebida. Informe o número do lacre e o transportador para montar o envio."
          />
        )}

        <form onSubmit={handleCriarEnvio} className="card">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              Montar novo envio
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Loja de destino
                </label>
                <SelectBusca
                  opcoes={lojas.map((loja) => ({ valor: loja.id, rotulo: loja.nome ?? "" }))}
                  valor={form.lojaDestinoId}
                  aoMudar={(valorEscolhido) => setForm((prev) => ({
                      ...prev,
                      lojaDestinoId: valorEscolhido,
                    }))}
                  opcaoVazia="Selecione..."
                  placeholder="Selecione..."
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  🚚 Rota do motorista
                </label>
                <SelectBusca
                  opcoes={rotas.map((rota) => ({
                    valor: rota.id,
                    rotulo: rota.nome,
                    detalhe: `${rota.funcionario?.nome || ""} · ${new Date(rota.dataInicio).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`,
                  }))}
                  valor={form.roteiroId}
                  aoMudar={(roteiroId) => setForm((prev) => ({ ...prev, roteiroId }))}
                  opcaoVazia="Não vai por rota"
                  placeholder="Buscar rota"
                />
                <p className="mt-1 text-xs text-gray-500">A loja do envio vira parada da rota. Se não for por rota, escolha o transportador.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Transportador {form.roteiroId && <span className="font-normal text-gray-400">(opcional com rota)</span>}
                </label>
                <SelectBusca
                  opcoes={transportadores.map((transportador) => ({ valor: transportador.id, rotulo: transportador.nome ?? "" }))}
                  valor={form.transportadorId}
                  aoMudar={(valorEscolhido) => setForm((prev) => ({
                      ...prev,
                      transportadorId: valorEscolhido,
                    }))}
                  opcaoVazia="Selecione..."
                  placeholder="Selecione..."
                />
                <div className="mt-2 flex gap-2">
                  <input
                    value={novoTransportadorNome}
                    onChange={(e) => setNovoTransportadorNome(e.target.value)}
                    placeholder="Novo transportador (nome)"
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleCriarTransportador}
                    disabled={criandoTransportador || !novoTransportadorNome.trim()}
                    className="btn-secondary text-xs whitespace-nowrap disabled:opacity-60"
                  >
                    {criandoTransportador ? "Cadastrando..." : "+ Cadastrar"}
                  </button>
                </div>
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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-60">
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Número do lacre
                      </label>
                      <input
                        value={lacre.numero}
                        onChange={(e) =>
                          atualizarLacreCampo(
                            indexLacre,
                            "numero",
                            e.target.value,
                          )
                        }
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                        placeholder="Ex: 5011"
                      />
                    </div>

                    <div className="flex-1 min-w-60">
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Produto
                      </label>
                      <SelectBusca
                        opcoes={produtos.map((produto) => ({ valor: produto.id, rotulo: produto.nome ?? "", detalhe: produto.codigo || undefined }))}
                        valor={lacre.produtoId}
                        aoMudar={(valorEscolhido) => atualizarLacreCampo(
                            indexLacre,
                            "produtoId",
                            valorEscolhido,
                          )}
                        opcaoVazia="Selecione..."
                        placeholder="Selecione..."
                        className="text-sm"
                      />
                    </div>

                    <div className="w-28 min-w-30">
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Quantidade
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={lacre.quantidade}
                        onChange={(e) =>
                          atualizarLacreCampo(
                            indexLacre,
                            "quantidade",
                            e.target.value,
                          )
                        }
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                      />
                    </div>

                    {form.lacres.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removerLacre(indexLacre)}
                        className="btn-secondary text-xs self-end"
                      >
                        Remover lacre
                      </button>
                    )}
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

        <div className="card">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Envios ({envios.length})
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
                        {envio.roteiro
                          ? `🚚 rota "${envio.roteiro.nome}" (${envio.roteiro.funcionario?.nome || "motorista"})`
                          : envio.transportador?.nome || "-"}
                      </p>
                    </div>
                    {!envio.despachadoEm ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => handleDespachar(envio)}
                          className="btn-primary text-sm"
                        >
                          Dar baixa
                        </button>
                        <p className="text-xs text-gray-500">
                          Clique em Dar baixa para registrar que este envio saiu
                          do depósito e será enviado para conferência de lacre.
                        </p>
                      </div>
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
      </div>

      <Footer />
    </div>
  );
}
