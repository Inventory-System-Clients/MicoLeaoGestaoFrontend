import { useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { useAuth } from "../contexts/AuthContext";

const NOTE_VALUES = [2, 5, 10, 20, 50, 100, 200];

const getNowForDateTimeLocal = () => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
};

const createEmptyNotes = () =>
  NOTE_VALUES.reduce((acc, note) => {
    acc[note] = "";
    return acc;
  }, {});

const toNumber = (value) => Number(value || 0);

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
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  )}`;
};

const extractApiErrorMessage = (err, fallbackMessage) => {
  const data = err?.response?.data;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data && typeof data === "object") {
    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }

    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }

    if (typeof data.erro === "string" && data.erro.trim()) {
      return data.erro;
    }

    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const firstError = data.errors[0];
      if (typeof firstError === "string") return firstError;
      if (typeof firstError?.message === "string") return firstError.message;
      if (typeof firstError?.msg === "string") return firstError.msg;
    }

    if (data.errors && typeof data.errors === "object") {
      const firstKey = Object.keys(data.errors)[0];
      if (firstKey) {
        const value = data.errors[firstKey];
        if (Array.isArray(value) && value.length > 0) {
          return `${firstKey}: ${value[0]}`;
        }
        if (typeof value === "string") {
          return `${firstKey}: ${value}`;
        }
      }
    }
  }

  return fallbackMessage;
};

const normalizeLojaIdValue = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
};

export function Sangrias() {
  const { usuario } = useAuth();
  const didInitRef = useRef(false);
  const [lojas, setLojas] = useState([]);
  const [loadingLojas, setLoadingLojas] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [historico, setHistorico] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [endpointIndisponivel, setEndpointIndisponivel] = useState(false);

  const [formData, setFormData] = useState({
    lojaId: "",
    dataHoraContagem: getNowForDateTimeLocal(),
    quantidade: "",
    observacao: "",
    notas: createEmptyNotes(),
  });

  const [filtros, setFiltros] = useState({
    lojaId: "",
    dataInicio: "",
    dataFim: "",
  });

  const totalCalculadoNotas = useMemo(
    () =>
      NOTE_VALUES.reduce(
        (acc, note) => acc + toNumber(formData.notas[note]) * Number(note),
        0,
      ),
    [formData.notas],
  );

  const isAdmin = usuario?.role === "ADMIN";
  const podeVerHistorico = usuario?.role === "ADMIN";

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    carregarLojas();
    if (podeVerHistorico) {
      carregarHistorico();
    }
  }, []);

  const carregarLojas = async () => {
    try {
      setLoadingLojas(true);
      const response = await api.get("/lojas");
      setLojas(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Erro ao carregar lojas:", err);
      setError("Erro ao carregar lojas.");
    } finally {
      setLoadingLojas(false);
    }
  };

  const normalizarHistorico = (data) => {
    if (Array.isArray(data)) {
      return data;
    }

    if (Array.isArray(data?.registros)) {
      return data.registros;
    }

    if (Array.isArray(data?.sangria?.registros)) {
      return data.sangria.registros;
    }

    if (Array.isArray(data?.items)) {
      return data.items;
    }

    return [];
  };

  const carregarHistorico = async (filtrosAtuais = filtros) => {
    if (endpointIndisponivel) {
      setHistorico([]);
      return;
    }

    try {
      setLoadingList(true);
      setError("");

      const params = {};
      if (filtrosAtuais.lojaId) params.lojaId = filtrosAtuais.lojaId;
      if (filtrosAtuais.dataInicio) params.dataInicio = filtrosAtuais.dataInicio;
      if (filtrosAtuais.dataFim) params.dataFim = filtrosAtuais.dataFim;

      const response = await api.get("/sangrias", { params });
      setEndpointIndisponivel(false);
      setHistorico(normalizarHistorico(response.data));
      setSelectedIds([]);
    } catch (err) {
      if (err?.response?.status === 404) {
        setEndpointIndisponivel(true);
        setHistorico([]);
        setError(
          "Endpoint de Sangria indisponível no backend (404).",
        );
      } else {
        console.error("Erro ao carregar histórico de sangrias:", err);
        setError("Erro ao carregar histórico de sangrias.");
      }
    } finally {
      setLoadingList(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.lojaId) {
      setError("Selecione a loja para registrar a sangria.");
      return;
    }

    if (toNumber(formData.quantidade) <= 0) {
      setError("Informe um valor total retirado maior que zero.");
      return;
    }

    if (endpointIndisponivel) {
      setError(
        "Não foi possível registrar. O endpoint de Sangria não está disponível no backend.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const lojaIdNormalizado = normalizeLojaIdValue(formData.lojaId);
      if (lojaIdNormalizado === null) {
        setError("Loja inválida. Selecione novamente.");
        setSaving(false);
        return;
      }

      const dataHoraIso = isAdmin
        ? new Date(formData.dataHoraContagem).toISOString()
        : new Date().toISOString();
      const notasObj = NOTE_VALUES.reduce((acc, note) => {
        acc[note] = toNumber(formData.notas[note]);
        return acc;
      }, {});

      const payloadPrincipal = {
        lojaId: lojaIdNormalizado,
        lojaid: lojaIdNormalizado,
        loja: lojaIdNormalizado,
        loja_id: lojaIdNormalizado,
        idLoja: lojaIdNormalizado,
        dataHoraContagem: dataHoraIso,
        dataHora: dataHoraIso,
        data_hora_contagem: dataHoraIso,
        quantidade: toNumber(formData.quantidade),
        valorTotal: toNumber(formData.quantidade),
        valor_total_retirado: toNumber(formData.quantidade),
        totalCalculadoPelasNotas: totalCalculadoNotas,
        observacao: formData.observacao?.trim() || null,
        observacoes: formData.observacao?.trim() || null,
        quantidadeNotas: notasObj,
        notas: notasObj,
        quantidadeNotas2: toNumber(formData.notas[2]),
        quantidadeNotas5: toNumber(formData.notas[5]),
        quantidadeNotas10: toNumber(formData.notas[10]),
        quantidadeNotas20: toNumber(formData.notas[20]),
        quantidadeNotas50: toNumber(formData.notas[50]),
        quantidadeNotas100: toNumber(formData.notas[100]),
        quantidadeNotas200: toNumber(formData.notas[200]),
        notas2: toNumber(formData.notas[2]),
        notas5: toNumber(formData.notas[5]),
        notas10: toNumber(formData.notas[10]),
        notas20: toNumber(formData.notas[20]),
        notas50: toNumber(formData.notas[50]),
        notas100: toNumber(formData.notas[100]),
        notas200: toNumber(formData.notas[200]),
      };

      try {
        await api.post("/sangrias", payloadPrincipal);
      } catch (postError) {
        const status = postError?.response?.status;
        const message = extractApiErrorMessage(postError, "").toLowerCase();
        const erroLojaId =
          status === 400 &&
          (message.includes("lojaid") ||
            message.includes("idloja") ||
            message.includes("loja_id"));

        if (!erroLojaId) {
          throw postError;
        }

        const payloadFallback = {
          lojaid: String(formData.lojaId).trim(),
          idLoja: String(formData.lojaId).trim(),
          dataHoraContagem: dataHoraIso,
          quantidade: toNumber(formData.quantidade),
          observacao: formData.observacao?.trim() || null,
          quantidadeNotas2: toNumber(formData.notas[2]),
          quantidadeNotas5: toNumber(formData.notas[5]),
          quantidadeNotas10: toNumber(formData.notas[10]),
          quantidadeNotas20: toNumber(formData.notas[20]),
          quantidadeNotas50: toNumber(formData.notas[50]),
          quantidadeNotas100: toNumber(formData.notas[100]),
          quantidadeNotas200: toNumber(formData.notas[200]),
        };

        await api.post("/sangrias", payloadFallback);
      }

      setEndpointIndisponivel(false);

      setSuccess("Sangria registrada com sucesso.");
      setFormData({
        lojaId: formData.lojaId,
        dataHoraContagem: getNowForDateTimeLocal(),
        quantidade: "",
        observacao: "",
        notas: createEmptyNotes(),
      });

      if (podeVerHistorico) {
        await carregarHistorico();
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        setEndpointIndisponivel(true);
        setError("Endpoint de Sangria indisponível no backend (404)." );
      } else {
        console.error("Erro ao registrar sangria:", err);
        setError(
          extractApiErrorMessage(
            err,
            "Erro ao registrar sangria. Tente novamente.",
          ),
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFiltroSubmit = async (event) => {
    event.preventDefault();
    if (!podeVerHistorico) return;
    await carregarHistorico(filtros);
  };

  const handleLimparFiltros = async () => {
    if (!podeVerHistorico) return;
    const filtrosLimpos = {
      lojaId: "",
      dataInicio: "",
      dataFim: "",
    };
    setFiltros(filtrosLimpos);
    await carregarHistorico(filtrosLimpos);
  };

  const resumoHistorico = useMemo(() => {
    return historico.reduce(
      (acc, item) => {
        const quantidade = toNumber(
          item.quantidade ?? item.valorTotal ?? item.totalRetirado,
        );
        const calculadoNotas = toNumber(
          item.totalCalculadoPelasNotas ??
            item.valorCalculadoNotas ??
            item.totalNotas,
        );

        acc.totalQuantidade += quantidade;
        acc.totalCalculadoNotas += calculadoNotas;
        return acc;
      },
      { totalQuantidade: 0, totalCalculadoNotas: 0 },
    );
  }, [historico]);

  const getSangriaId = (item) =>
    item?.id || item?._id || item?.sangriaId || item?.sangria_id || null;

  const getSangriaDataHora = (item) =>
    item?.dataContagem ||
    item?.dataHoraContagem ||
    item?.dataHora ||
    item?.data_contagem ||
    item?.createdAt ||
    item?.created_at ||
    null;

  const idsVisiveis = useMemo(
    () => historico.map((item) => getSangriaId(item)).filter(Boolean),
    [historico],
  );

  const todosSelecionados =
    idsVisiveis.length > 0 &&
    idsVisiveis.every((id) => selectedIds.includes(String(id)));

  const toggleSelecionarTodos = () => {
    if (todosSelecionados) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(idsVisiveis.map((id) => String(id)));
  };

  const toggleSelecionarUm = (id) => {
    const key = String(id);
    setSelectedIds((prev) =>
      prev.includes(key)
        ? prev.filter((item) => item !== key)
        : [...prev, key],
    );
  };

  const excluirSangria = async (item) => {
    const id = getSangriaId(item);
    if (!id) {
      setError("Não foi possível excluir: registro sem ID.");
      return;
    }

    const confirmou = window.confirm("Deseja excluir esta sangria?");
    if (!confirmou) return;

    try {
      setDeletingId(String(id));
      setError("");
      await api.delete(`/sangrias/${id}`);
      setSuccess("Sangria excluída com sucesso.");
      await carregarHistorico();
    } catch (err) {
      console.error("Erro ao excluir sangria:", err);
      setError(
        extractApiErrorMessage(err, "Erro ao excluir sangria."),
      );
    } finally {
      setDeletingId(null);
    }
  };

  const excluirSangriasEmLote = async () => {
    if (selectedIds.length === 0) {
      setError("Selecione ao menos uma sangria para excluir em lote.");
      return;
    }

    const confirmou = window.confirm(
      `Deseja excluir ${selectedIds.length} sangria(s)?`,
    );
    if (!confirmou) return;

    try {
      setDeletingBatch(true);
      setError("");
      await api.delete("/sangrias", {
        data: {
          ids: selectedIds,
        },
      });
      setSuccess("Sangrias selecionadas excluídas com sucesso.");
      await carregarHistorico();
    } catch (err) {
      console.error("Erro ao excluir sangrias em lote:", err);
      setError(
        extractApiErrorMessage(err, "Erro ao excluir sangrias em lote."),
      );
    } finally {
      setDeletingBatch(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="💸 Sangria"
          subtitle="Registre retiradas de caixa e consulte o histórico por loja e período"
          icon="🧾"
        />

        {(error || success) && (
          <div className="mb-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                <p className="text-red-700 text-sm">⚠️ {error}</p>
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 text-sm">✅ {success}</p>
              </div>
            )}
          </div>
        )}

        {endpointIndisponivel && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-amber-800 text-sm">
              ⚠️ O backend ainda não publicou o endpoint de Sangria. Assim que
              ele estiver disponível, a tela voltará a funcionar normalmente.
            </p>
          </div>
        )}

        <div className={`grid grid-cols-1 ${podeVerHistorico ? "xl:grid-cols-2" : ""} gap-6`}>
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Registrar Sangria
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🏪 Loja *
                  </label>
                  <select
                    value={formData.lojaId}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        lojaId: event.target.value,
                      }))
                    }
                    className="input-field w-full"
                    required
                    disabled={loadingLojas || endpointIndisponivel}
                  >
                    <option value="">Selecione uma loja</option>
                    {lojas.map((loja) => (
                      <option key={loja.id} value={loja.id}>
                        {loja.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🕒 Data/Hora da contagem
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.dataHoraContagem}
                    onChange={(event) => {
                      if (!isAdmin) return;
                      setFormData((prev) => ({
                        ...prev,
                        dataHoraContagem: event.target.value,
                      }));
                    }}
                    className="input-field w-full"
                    required
                    disabled={endpointIndisponivel || !isAdmin}
                  />
                  {!isAdmin && (
                    <p className="text-xs text-gray-500 mt-1">
                      Registro automático no momento da sangria.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    💵 Quantidade (total retirado) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.quantidade}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        quantidade: event.target.value,
                      }))
                    }
                    className="input-field w-full"
                    placeholder="0,00"
                    required
                    disabled={endpointIndisponivel}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-1">
                  Quantidade de notas
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Opcional: preencha somente se quiser registrar a contagem de
                  notas.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {NOTE_VALUES.map((note) => (
                    <div key={note}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Nota de R$ {note}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={formData.notas[note]}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            notas: {
                              ...prev.notas,
                              [note]: event.target.value,
                            },
                          }))
                        }
                        className="input-field w-full text-xs px-2 py-1 min-h-0 h-8"
                        placeholder="0"
                        disabled={endpointIndisponivel}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  Total calculado pelas notas: <strong>R$ {formatCurrency(totalCalculadoNotas)}</strong>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📝 Observação (opcional)
                </label>
                <textarea
                  value={formData.observacao}
                  onChange={(event) =>
                    setFormData((prev) => ({
                      ...prev,
                      observacao: event.target.value,
                    }))
                  }
                  className="input-field w-full min-h-22.5"
                  placeholder="Detalhes adicionais da sangria"
                  disabled={endpointIndisponivel}
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={saving || endpointIndisponivel}
              >
                {saving ? "⏳ Salvando..." : "💾 Registrar Sangria"}
              </button>
            </form>
          </div>

          {podeVerHistorico ? (
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Filtros do Histórico
              </h2>

              <form onSubmit={handleFiltroSubmit} className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🏪 Loja
                  </label>
                  <select
                    value={filtros.lojaId}
                    onChange={(event) =>
                      setFiltros((prev) => ({
                        ...prev,
                        lojaId: event.target.value,
                      }))
                    }
                    className="input-field w-full"
                    disabled={loadingLojas || endpointIndisponivel}
                  >
                    <option value="">Todas as lojas</option>
                    {lojas.map((loja) => (
                      <option key={loja.id} value={loja.id}>
                        {loja.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📅 Data inicial
                    </label>
                    <input
                      type="date"
                      value={filtros.dataInicio}
                      onChange={(event) =>
                        setFiltros((prev) => ({
                          ...prev,
                          dataInicio: event.target.value,
                        }))
                      }
                      className="input-field w-full"
                      disabled={endpointIndisponivel}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      📅 Data final
                    </label>
                    <input
                      type="date"
                      value={filtros.dataFim}
                      onChange={(event) =>
                        setFiltros((prev) => ({
                          ...prev,
                          dataFim: event.target.value,
                        }))
                      }
                      className="input-field w-full"
                      disabled={endpointIndisponivel}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loadingList || endpointIndisponivel}
                  >
                    {loadingList ? "⏳ Filtrando..." : "🔎 Filtrar Histórico"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleLimparFiltros}
                    disabled={loadingList || endpointIndisponivel}
                  >
                    Limpar
                  </button>
                </div>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-gray-200 bg-white">
                  <p className="text-xs text-gray-500">Registros</p>
                  <p className="text-xl font-bold text-gray-900">{historico.length}</p>
                </div>
                <div className="p-3 rounded-lg border border-gray-200 bg-white">
                  <p className="text-xs text-gray-500">Total Sangria</p>
                  <p className="text-xl font-bold text-red-600">
                    R$ {formatCurrency(resumoHistorico.totalQuantidade)}
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-gray-200 bg-white">
                  <p className="text-xs text-gray-500">Total Notas</p>
                  <p className="text-xl font-bold text-blue-600">
                    R$ {formatCurrency(resumoHistorico.totalCalculadoNotas)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {podeVerHistorico ? (
          <div className="card mt-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Histórico de Sangrias
            </h2>

            <div className="mb-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                onClick={excluirSangriasEmLote}
                disabled={
                  selectedIds.length === 0 ||
                  loadingList ||
                  deletingBatch ||
                  endpointIndisponivel
                }
              >
                {deletingBatch
                  ? "⏳ Excluindo..."
                  : `🗑️ Excluir Selecionadas (${selectedIds.length})`}
              </button>
            </div>

          {loadingList ? (
            <div className="py-8 text-center text-gray-600">Carregando histórico...</div>
          ) : historico.length === 0 ? (
            <div className="py-8 text-center text-gray-600">
              Nenhuma sangria encontrada para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={todosSelecionados}
                        onChange={toggleSelecionarTodos}
                        aria-label="Selecionar todas as sangrias"
                      />
                    </th>
                    <th>Loja</th>
                    <th>Data/Hora</th>
                    <th>Total Retirado</th>
                    <th>Total pelas Notas</th>
                    <th>Observação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((item) => {
                    const idSangria = getSangriaId(item);
                    const idSelecionado =
                      idSangria && selectedIds.includes(String(idSangria));
                    const dataHoraSangria = getSangriaDataHora(item);
                    const lojaNome =
                      item.lojaNome ||
                      item.loja?.nome ||
                      lojas.find((loja) => String(loja.id) === String(item.lojaId))
                        ?.nome ||
                      "-";

                    return (
                      <tr key={item.id || `${item.lojaId}-${dataHoraSangria || "sem-data"}`}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!idSelecionado}
                            onChange={() => idSangria && toggleSelecionarUm(idSangria)}
                            disabled={!idSangria}
                            aria-label="Selecionar sangria"
                          />
                        </td>
                        <td>{lojaNome}</td>
                        <td>
                          {formatDateTime(dataHoraSangria)}
                        </td>
                        <td>
                          R${" "}
                          {formatCurrency(
                            item.quantidade ?? item.valorTotal ?? item.totalRetirado,
                          )}
                        </td>
                        <td>
                          R${" "}
                          {formatCurrency(
                            item.totalCalculadoPelasNotas ??
                              item.valorCalculadoNotas ??
                              item.totalNotas,
                          )}
                        </td>
                        <td>{item.observacao || item.observacoes || "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-60"
                            onClick={() => excluirSangria(item)}
                            disabled={!idSangria || deletingId === String(idSangria)}
                          >
                            {deletingId === String(idSangria)
                              ? "Excluindo..."
                              : "Excluir"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
        ) : (
          <div className="card mt-6">
            <p className="text-sm text-gray-600">
              Histórico de sangrias disponível apenas para administradores.
            </p>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
