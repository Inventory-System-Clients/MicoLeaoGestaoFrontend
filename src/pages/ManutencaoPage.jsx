import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { AlertBox, Badge, PageHeader } from "../components/UIComponents";
import { filtrarLojasOperacionais } from "../utils/lojas";

const TIPOS_PROBLEMA = [
  { value: "MECANICO", label: "Mecânico" },
  { value: "ELETRICO", label: "Elétrico" },
  { value: "SOFTWARE", label: "Software/Sistema" },
  { value: "LIMPEZA", label: "Limpeza/Higienização" },
  { value: "ESTRUTURAL", label: "Estrutural da loja" },
  { value: "OUTRO", label: "Outro" },
];

const STATUS_OPCOES = [
  {
    value: "ABERTA",
    label: "Aberta",
    variant: "warning",
    emoji: "🟠",
    borderClass: "border-amber-300",
    bgClass: "bg-amber-50/60",
  },
  {
    value: "EM_ANDAMENTO",
    label: "Em andamento",
    variant: "info",
    emoji: "🔵",
    borderClass: "border-blue-300",
    bgClass: "bg-blue-50/60",
  },
  {
    value: "AGUARDANDO_PECA",
    label: "Aguardando peça",
    variant: "danger",
    emoji: "🔴",
    borderClass: "border-red-300",
    bgClass: "bg-red-50/60",
  },
  {
    value: "CONCLUIDA",
    label: "Concluída",
    variant: "success",
    emoji: "🟢",
    borderClass: "border-emerald-300",
    bgClass: "bg-emerald-50/50",
  },
];

const obterStatusInfo = (status) =>
  STATUS_OPCOES.find((opcao) => opcao.value === status) || {
    label: status || "-",
    variant: "info",
    emoji: "⚪",
    borderClass: "border-gray-200",
    bgClass: "bg-white",
  };

const obterLabelTipoProblema = (tipo) =>
  TIPOS_PROBLEMA.find((opcao) => opcao.value === tipo)?.label || tipo || "-";

export default function ManutencaoPage() {
  const {
    usuario,
    loading: authLoading,
    atualizarAlertasManutencaoCount,
  } = useAuth();
  const [manutencoes, setManutencoes] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [usuariosFiltro, setUsuariosFiltro] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [alertasMovimentacao, setAlertasMovimentacao] = useState([]);
  const [historicoMaquina, setHistoricoMaquina] = useState(null);
  const [alertaRecorrencia, setAlertaRecorrencia] = useState(null);
  const [pecas, setPecas] = useState([]);
  const [meuEstoquePecas, setMeuEstoquePecas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [funcionarioParaAdicionar, setFuncionarioParaAdicionar] = useState("");

  const [usoPecaAbertoId, setUsoPecaAbertoId] = useState(null);
  const [formUsoPeca, setFormUsoPeca] = useState({
    pecaId: "",
    quantidade: "",
    observacao: "",
  });

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    funcionariosIds: [],
    custo: "",
    lojaId: "",
    maquinaId: "",
    responsavelId: "",
    tipoProblema: "",
    prazo: "",
  });

  const [filtros, setFiltros] = useState({
    status: "TODAS",
    dataInicio: "",
    dataFim: "",
    lojaId: "",
    maquinaId: "",
    usuarioId: "",
  });

  const isAdmin = usuario?.role === "ADMIN";

  const manutencoesOrdenadas = useMemo(
    () =>
      [...manutencoes].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      ),
    [manutencoes],
  );

  const manutencoesVisiveis = useMemo(() => {
    if (isAdmin) return manutencoesOrdenadas;
    return manutencoesOrdenadas.filter((item) => item.status !== "CONCLUIDA");
  }, [isAdmin, manutencoesOrdenadas]);

  const carregarDados = useCallback(async () => {
    try {
      setError("");

      const params = {};
      if (usuario?.role === "ADMIN") {
        if (filtros.status !== "TODAS") params.status = filtros.status;
        if (filtros.dataInicio) params.dataInicio = filtros.dataInicio;
        if (filtros.dataFim) params.dataFim = filtros.dataFim;
        if (filtros.lojaId) params.lojaId = filtros.lojaId;
        if (filtros.maquinaId) params.maquinaId = filtros.maquinaId;
        if (filtros.usuarioId) params.usuarioId = filtros.usuarioId;
      }

      const manutencoesResponse = await api.get("/manutencoes", { params });
      const manutencoesData = manutencoesResponse.data;
      setManutencoes(Array.isArray(manutencoesData) ? manutencoesData : []);

      const pecasResponse = await api.get("/pecas");
      const pecasData = pecasResponse.data;
      setPecas(Array.isArray(pecasData) ? pecasData : []);

      if (usuario?.role === "FUNCIONARIO") {
        const estoquePecasResponse = await api.get("/pecas/estoque-funcionario");
        const estoquePecasData = estoquePecasResponse.data;
        setMeuEstoquePecas(
          Array.isArray(estoquePecasData) ? estoquePecasData : [],
        );
      } else {
        setMeuEstoquePecas([]);
      }

      if (usuario?.role === "ADMIN") {
        const [
          funcionariosResponse,
          lojasResponse,
          maquinasResponse,
          usuariosResponse,
          alertasResponse,
        ] = await Promise.all([
          api.get("/manutencoes/funcionarios"),
          api.get("/lojas"),
          api.get("/maquinas"),
          api.get("/usuarios"),
          api.get("/alertas-movimentacao"),
        ]);
        const funcionariosData = funcionariosResponse.data;
        const lojasData = lojasResponse.data;
        const maquinasData = maquinasResponse.data;
        const usuariosData = usuariosResponse.data;
        const alertasData = alertasResponse.data;
        setFuncionarios(
          Array.isArray(funcionariosData) ? funcionariosData : [],
        );
        setLojas(filtrarLojasOperacionais(Array.isArray(lojasData) ? lojasData : []));
        setMaquinas(Array.isArray(maquinasData) ? maquinasData : []);
        setUsuariosFiltro(Array.isArray(usuariosData) ? usuariosData : []);
        setAlertasMovimentacao(Array.isArray(alertasData) ? alertasData : []);
      } else {
        setFuncionarios([]);
        setLojas([]);
        setMaquinas([]);
        setUsuariosFiltro([]);
        setAlertasMovimentacao([]);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [filtros, usuario?.role]);

  useEffect(() => {
    if (authLoading) return;
    carregarDados();
  }, [authLoading, carregarDados]);

  const handleAtualizarDados = async () => {
    if (atualizando) return;

    try {
      setAtualizando(true);
      await carregarDados();
    } finally {
      setAtualizando(false);
    }
  };

  useEffect(() => {
    if (!form.maquinaId) {
      setHistoricoMaquina(null);
      return undefined;
    }

    let cancelado = false;
    api
      .get(`/manutencoes/maquina/${form.maquinaId}`)
      .then((response) => {
        if (!cancelado) setHistoricoMaquina(response.data);
      })
      .catch(() => {
        if (!cancelado) setHistoricoMaquina(null);
      });

    return () => {
      cancelado = true;
    };
  }, [form.maquinaId]);

  const handleAdicionarFuncionario = () => {
    if (!funcionarioParaAdicionar) return;
    setForm((prev) =>
      prev.funcionariosIds.includes(funcionarioParaAdicionar)
        ? prev
        : {
            ...prev,
            funcionariosIds: [
              ...prev.funcionariosIds,
              funcionarioParaAdicionar,
            ],
          },
    );
    setFuncionarioParaAdicionar("");
  };

  const handleRemoverFuncionario = (id) => {
    setForm((prev) => ({
      ...prev,
      funcionariosIds: prev.funcionariosIds.filter((fid) => fid !== id),
      responsavelId: prev.responsavelId === id ? "" : prev.responsavelId,
    }));
  };

  const handleDefinirResponsavel = (id) => {
    setForm((prev) => ({
      ...prev,
      responsavelId: prev.responsavelId === id ? "" : id,
    }));
  };

  const handleSelectLoja = (event) => {
    const lojaId = event.target.value;
    setForm((prev) => ({ ...prev, lojaId, maquinaId: "" }));
  };

  const handleSelectMaquina = (event) => {
    const maquinaId = event.target.value;
    setForm((prev) => ({ ...prev, maquinaId }));
  };

  const maquinasDaLoja = useMemo(
    () => maquinas.filter((maquina) => maquina.lojaId === form.lojaId),
    [maquinas, form.lojaId],
  );

  const handleCriar = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;

    if (
      !form.titulo.trim() ||
      !form.descricao.trim() ||
      form.funcionariosIds.length === 0
    ) {
      setError("Preencha título, descrição e selecione os funcionários.");
      return;
    }

    const custoInformado = form.custo !== "";
    const custoNumerico = custoInformado
      ? Number(String(form.custo).replace(",", "."))
      : null;

    if (
      custoInformado &&
      (!Number.isFinite(custoNumerico) || custoNumerico < 0)
    ) {
      setError("Informe um custo válido (maior ou igual a zero).");
      return;
    }

    if (custoInformado && custoNumerico > 0 && !form.lojaId && !form.maquinaId) {
      setError("Selecione a loja ou a máquina para lançar o gasto variável.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setAlertaRecorrencia(null);

      const response = await api.post("/manutencoes", {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        funcionariosIds: form.funcionariosIds,
        custo: custoInformado ? custoNumerico : null,
        lojaId: form.lojaId || null,
        maquinaId: form.maquinaId || null,
        responsavelId: form.responsavelId || null,
        tipoProblema: form.tipoProblema || null,
        prazo: form.prazo || null,
      });

      if (response.data?.recorrente) {
        setAlertaRecorrencia(response.data.recorrenciaMotivos || []);
      }

      setForm({
        titulo: "",
        descricao: "",
        funcionariosIds: [],
        custo: "",
        lojaId: "",
        maquinaId: "",
        responsavelId: "",
        tipoProblema: "",
        prazo: "",
      });
      setFuncionarioParaAdicionar("");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao criar manutenção");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAtualizarStatus = async (id, novoStatus) => {
    try {
      setError("");
      await api.patch(`/manutencoes/${id}/status`, { status: novoStatus });
      await carregarDados();
    } catch (err) {
      setError(
        err.response?.data?.error || "Erro ao atualizar status da manutenção",
      );
    }
  };

  const abrirUsoPeca = (manutencaoId) => {
    setUsoPecaAbertoId((atual) => (atual === manutencaoId ? null : manutencaoId));
    setFormUsoPeca({ pecaId: "", quantidade: "", observacao: "" });
  };

  const handleRegistrarUsoPeca = async (event, manutencaoId) => {
    event.preventDefault();

    const quantidadeNumerica = Number(formUsoPeca.quantidade);
    if (!formUsoPeca.pecaId) {
      setError("Selecione a peça utilizada.");
      return;
    }
    if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
      setError("Informe uma quantidade válida (inteiro maior que zero).");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      await api.post(`/manutencoes/${manutencaoId}/pecas`, {
        pecaId: formUsoPeca.pecaId,
        quantidade: quantidadeNumerica,
        observacao: formUsoPeca.observacao || null,
      });
      setUsoPecaAbertoId(null);
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao registrar uso de peça");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolverAlerta = async (id) => {
    try {
      setError("");
      await api.patch(`/alertas-movimentacao/${id}/resolver`);
      await carregarDados();
      await atualizarAlertasManutencaoCount();
    } catch (err) {
      setError(
        err.response?.data?.error || "Erro ao resolver alerta de movimentação",
      );
    }
  };

  if (loading || authLoading) {
    return <PageLoader />;
  }

  const limparFiltros = () => {
    setFiltros({
      status: "TODAS",
      dataInicio: "",
      dataFim: "",
      lojaId: "",
      maquinaId: "",
      usuarioId: "",
    });
  };

  const formatarDataHora = (dataIso) => {
    if (!dataIso) return "-";
    const data = new Date(dataIso);
    if (Number.isNaN(data.getTime())) return "-";
    return data.toLocaleString("pt-BR");
  };

  const formatarData = (dataIso) => {
    if (!dataIso) return "-";
    const data = new Date(`${dataIso}T00:00:00`);
    if (Number.isNaN(data.getTime())) return "-";
    return data.toLocaleDateString("pt-BR");
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Manutenção"
          subtitle={`Usuário: ${usuario?.nome || "-"} (${usuario?.role || "-"})`}
          icon="🛠️"
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}

        {alertaRecorrencia && alertaRecorrencia.length > 0 && (
          <AlertBox
            type="warning"
            message={`⚠️ Manutenção recorrente detectada: ${alertaRecorrencia.join(" ")}`}
            onClose={() => setAlertaRecorrencia(null)}
          />
        )}

        {usuario?.role === "FUNCIONARIO" && (
          <div className="card">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              🔩 Meu estoque de peças
            </h2>
            {meuEstoquePecas.filter((item) => item.quantidade > 0).length ===
            0 ? (
              <p className="text-sm text-gray-600">
                Você não tem peças em estoque no momento.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {meuEstoquePecas
                  .filter((item) => item.quantidade > 0)
                  .map((item) => (
                    <Badge key={item.id} variant="info" size="sm">
                      {item.peca?.nome}: {item.quantidade}{" "}
                      {item.peca?.unidade || ""}
                    </Badge>
                  ))}
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <div className="card border-l-4 border-amber-500">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              ⚠️ Alertas de Movimentação ({alertasMovimentacao.length})
            </h2>

            {alertasMovimentacao.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhum alerta pendente.</p>
            ) : (
              <div className="space-y-3">
                {alertasMovimentacao.map((alerta) => (
                  <div
                    key={alerta.id}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                  >
                    <div className="space-y-1 text-sm text-gray-800">
                      <p>
                        <span className="font-semibold">Loja:</span>{" "}
                        {alerta.loja?.nome || "-"}
                      </p>
                      <p>
                        <span className="font-semibold">Máquina:</span>{" "}
                        {alerta.maquina
                          ? `${alerta.maquina.nome || ""} - ${alerta.maquina.codigo || ""}`
                          : "-"}
                      </p>
                      <p>
                        <span className="font-semibold">Usuário:</span>{" "}
                        {alerta.usuario?.nome || "-"}
                      </p>
                      <p>
                        <span className="font-semibold">Data/Hora:</span>{" "}
                        {formatarDataHora(alerta.createdAt)}
                      </p>
                      <p>
                        <span className="font-semibold">Motivo:</span>{" "}
                        {alerta.observacao}
                      </p>
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => handleResolverAlerta(alerta.id)}
                        className="btn-primary"
                      >
                        Corrigido
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isAdmin && (
          <form onSubmit={handleCriar} className="card-gradient space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <span className="text-xl">🛠️</span> Lançar manutenção
              </h2>
              <span className="text-xs font-medium text-gray-500">
                <span className="text-red-500">*</span> campos obrigatórios,
                o resto é opcional
              </span>
            </div>

            {/* O que aconteceu */}
            <div className="rounded-lg border border-orange-100 bg-orange-50/70 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-orange-800">
                <span className="text-lg">📋</span> O que aconteceu?
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-bold text-gray-700">
                    Título <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.titulo}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, titulo: e.target.value }))
                    }
                    className="input-field"
                    placeholder="Ex: Troca de trava da máquina 12"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold text-gray-700">
                    Problema relatado <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.descricao}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        descricao: e.target.value,
                      }))
                    }
                    className="input-field min-h-28"
                    placeholder="Descreva o problema relatado"
                  />
                </div>
              </div>
            </div>

            {/* Onde é o problema */}
            <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-blue-800">
                <span className="text-lg">📍</span> Onde é o problema?
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-bold text-gray-700">
                    🏪 Loja{" "}
                    <span className="text-xs font-normal text-gray-500">
                      (selecione primeiro)
                    </span>
                  </label>
                  <select
                    value={form.lojaId}
                    onChange={handleSelectLoja}
                    className="select-field"
                  >
                    <option value="">Selecione a loja...</option>
                    {lojas.map((loja) => (
                      <option key={loja.id} value={loja.id}>
                        {loja.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold text-gray-700">
                    🎮 Máquina{" "}
                    <span className="text-xs font-normal text-gray-500">
                      (opcional)
                    </span>
                  </label>
                  <select
                    value={form.maquinaId}
                    onChange={handleSelectMaquina}
                    disabled={!form.lojaId}
                    className="select-field disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {form.lojaId
                        ? "Nenhuma (problema é da loja)"
                        : "Selecione a loja primeiro"}
                    </option>
                    {maquinasDaLoja.map((maquina) => (
                      <option key={maquina.id} value={maquina.id}>
                        {maquina.codigo}{" "}
                        {maquina.nome ? `- ${maquina.nome}` : ""}
                      </option>
                    ))}
                  </select>
                  {!form.lojaId && (
                    <p className="mt-1 text-xs text-gray-500">
                      Escolha a loja para poder escolher a máquina.
                    </p>
                  )}
                </div>
              </div>

              {historicoMaquina && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-white/70 p-3">
                  <p className="text-sm font-semibold text-gray-800">
                    Histórico desta máquina (
                    {historicoMaquina.manutencoes.length})
                  </p>
                  {historicoMaquina.recorrente && (
                    <p className="mt-1 text-xs font-medium text-amber-700">
                      ⚠️ {historicoMaquina.recorrenciaMotivos.join(" ")}
                    </p>
                  )}
                  {historicoMaquina.manutencoes.length === 0 ? (
                    <p className="mt-1 text-xs text-gray-500">
                      Nenhuma manutenção anterior registrada.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-xs text-gray-600">
                      {historicoMaquina.manutencoes.slice(0, 5).map((item) => (
                        <li key={item.id}>
                          {formatarDataHora(item.createdAt)} —{" "}
                          {obterLabelTipoProblema(item.tipoProblema)} —{" "}
                          {obterStatusInfo(item.status).label} — {item.titulo}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Classificação */}
            <div className="rounded-lg border border-violet-100 bg-violet-50/70 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-violet-800">
                <span className="text-lg">🏷️</span> Classificação{" "}
                <span className="text-xs font-normal normal-case text-gray-500">
                  (opcional)
                </span>
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-bold text-gray-700">
                    Tipo de problema
                  </label>
                  <select
                    value={form.tipoProblema}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        tipoProblema: e.target.value,
                      }))
                    }
                    className="select-field"
                  >
                    <option value="">Selecione...</option>
                    {TIPOS_PROBLEMA.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold text-gray-700">
                    📅 Prazo / data de aviso
                  </label>
                  <input
                    type="date"
                    value={form.prazo}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, prazo: e.target.value }))
                    }
                    className="input-field"
                  />
                </div>
              </div>
            </div>

            {/* Responsáveis */}
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-800">
                <span className="text-lg">👷</span> Responsáveis
              </h3>

              <div>
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Adicionar funcionário{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={funcionarioParaAdicionar}
                    onChange={(e) =>
                      setFuncionarioParaAdicionar(e.target.value)
                    }
                    className="select-field"
                  >
                    <option value="">Selecione um funcionário...</option>
                    {funcionarios
                      .filter(
                        (funcionario) =>
                          !form.funcionariosIds.includes(funcionario.id),
                      )
                      .map((funcionario) => (
                        <option key={funcionario.id} value={funcionario.id}>
                          {funcionario.nome} ({funcionario.email})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAdicionarFuncionario}
                    disabled={!funcionarioParaAdicionar}
                    className="btn-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ➕ Adicionar
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Adicione quantos funcionários forem necessários — todos
                  poderão ver e resolver essa manutenção. Clique na ⭐ de um
                  deles para marcá-lo como responsável principal (opcional).
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {form.funcionariosIds.length === 0 ? (
                  <p className="text-xs text-gray-500">
                    Nenhum funcionário adicionado ainda.
                  </p>
                ) : (
                  form.funcionariosIds.map((id) => {
                    const funcionario = funcionarios.find(
                      (item) => item.id === id,
                    );
                    const ehResponsavel = form.responsavelId === id;

                    return (
                      <span
                        key={id}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                          ehResponsavel
                            ? "border-emerald-400 bg-emerald-100 text-emerald-900"
                            : "border-gray-300 bg-white text-gray-700"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleDefinirResponsavel(id)}
                          title={
                            ehResponsavel
                              ? "Responsável principal"
                              : "Marcar como responsável principal"
                          }
                          className="text-sm leading-none"
                        >
                          {ehResponsavel ? "⭐" : "☆"}
                        </button>
                        {funcionario?.nome || "Funcionário"}
                        <button
                          type="button"
                          onClick={() => handleRemoverFuncionario(id)}
                          title="Remover"
                          className="ml-0.5 leading-none text-gray-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </span>
                    );
                  })
                )}
              </div>
            </div>

            {/* Custo */}
            <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-amber-800">
                <span className="text-lg">💰</span> Custo da manutenção{" "}
                <span className="text-xs font-normal normal-case text-gray-500">
                  (opcional)
                </span>
              </h3>
              <div className="sm:w-1/2">
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Custo (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.custo}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, custo: e.target.value }))
                  }
                  className="input-field"
                  placeholder="Ex: 150.00"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Se informado, gera automaticamente um gasto variável para a
                  loja ou máquina selecionada.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary disabled:opacity-60"
              >
                {submitting ? "Salvando..." : "🛠️ Lançar manutenção"}
              </button>
            </div>
          </form>
        )}

        {isAdmin && (
          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Filtros (Admin)
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAtualizarDados}
                  disabled={atualizando}
                  className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {atualizando ? "Atualizando..." : "Aplicar filtros"}
                </button>
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="btn-secondary"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={filtros.status}
                  onChange={(e) =>
                    setFiltros((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                >
                  <option value="TODAS">Todas</option>
                  {STATUS_OPCOES.map((opcao) => (
                    <option key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Data fim
                </label>
                <input
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) =>
                    setFiltros((prev) => ({ ...prev, dataFim: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Loja
                </label>
                <select
                  value={filtros.lojaId}
                  onChange={(e) =>
                    setFiltros((prev) => ({ ...prev, lojaId: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
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
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Máquina
                </label>
                <select
                  value={filtros.maquinaId}
                  onChange={(e) =>
                    setFiltros((prev) => ({
                      ...prev,
                      maquinaId: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                >
                  <option value="">Todas</option>
                  {maquinas.map((maquina) => (
                    <option key={maquina.id} value={maquina.id}>
                      {maquina.codigo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Usuário
                </label>
                <select
                  value={filtros.usuarioId}
                  onChange={(e) =>
                    setFiltros((prev) => ({
                      ...prev,
                      usuarioId: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-blue-500"
                >
                  <option value="">Todos</option>
                  {usuariosFiltro.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.nome} ({user.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
              <span className="text-xl">🗂️</span> Manutenções
            </h2>
            <button
              type="button"
              onClick={handleAtualizarDados}
              disabled={atualizando}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {atualizando ? "Atualizando..." : "🔄 Atualizar"}
            </button>
          </div>

          {manutencoesVisiveis.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nenhuma manutenção encontrada.
            </p>
          ) : (
            <div className="space-y-4">
              {manutencoesVisiveis.map((item) => {
                const podePermitido =
                  isAdmin ||
                  item.responsavel?.id === usuario?.id ||
                  (item.funcionariosPermitidos || []).some(
                    (f) => f.id === usuario?.id,
                  );
                const podeAtualizar = item.status !== "CONCLUIDA" && podePermitido;
                const statusInfo = obterStatusInfo(item.status);

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border-2 p-4 shadow-sm transition-shadow hover:shadow-md ${statusInfo.borderClass} ${statusInfo.bgClass}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          {item.titulo}
                        </h3>
                        <p className="mt-1 text-sm text-gray-700">
                          {item.descricao}
                        </p>
                      </div>
                      <Badge variant={statusInfo.variant} size="sm">
                        {statusInfo.emoji} {statusInfo.label}
                      </Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-lg bg-white/80 p-3 text-xs text-gray-700 sm:grid-cols-2">
                      <p>
                        🎮 <span className="font-semibold">Máquina:</span>{" "}
                        {item.maquina
                          ? `${item.maquina.codigo} ${item.maquina.nome || ""}`
                          : "-"}
                      </p>
                      <p>
                        🏪 <span className="font-semibold">Loja:</span>{" "}
                        {item.loja?.nome || "-"}
                      </p>
                      <p>
                        🏷️ <span className="font-semibold">Tipo:</span>{" "}
                        {obterLabelTipoProblema(item.tipoProblema)}
                      </p>
                      <p>
                        👷 <span className="font-semibold">Responsável:</span>{" "}
                        {item.responsavel?.nome || "-"}
                      </p>
                      <p>
                        📅 <span className="font-semibold">Prazo:</span>{" "}
                        {formatarData(item.prazo)}
                      </p>
                      <p>
                        ✍️ <span className="font-semibold">Criado por:</span>{" "}
                        {item.criadoPor?.nome || "-"}
                      </p>
                      {isAdmin && (
                        <p>
                          💰 <span className="font-semibold">Custo:</span>{" "}
                          {item.custo !== null && item.custo !== undefined
                            ? `R$ ${item.custo}`
                            : "-"}
                        </p>
                      )}
                      {isAdmin && (
                        <p className="sm:col-span-2">
                          👥{" "}
                          <span className="font-semibold">
                            Podem visualizar/resolver:
                          </span>{" "}
                          {(item.funcionariosPermitidos || [])
                            .map((f) => f.nome)
                            .join(", ") || "-"}
                        </p>
                      )}
                      {isAdmin && item.status === "CONCLUIDA" && (
                        <>
                          <p>
                            ✅{" "}
                            <span className="font-semibold">
                              Concluído por:
                            </span>{" "}
                            {item.resolvidoPor?.nome || "-"}
                          </p>
                          <p>
                            🕒{" "}
                            <span className="font-semibold">
                              Concluído em:
                            </span>{" "}
                            {formatarDataHora(item.resolvidoEm)}
                          </p>
                        </>
                      )}
                    </div>

                    {podeAtualizar && (
                      <div className="mt-3 flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-700">
                          🔄 Atualizar status:
                        </label>
                        <select
                          value={item.status}
                          onChange={(e) =>
                            handleAtualizarStatus(item.id, e.target.value)
                          }
                          className="select-field w-auto py-1.5 text-sm"
                        >
                          {STATUS_OPCOES.map((opcao) => (
                            <option key={opcao.value} value={opcao.value}>
                              {opcao.emoji} {opcao.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="mt-3 border-t border-gray-200/70 pt-3">
                      <p className="text-xs font-bold text-gray-700">
                        🔩 Peças usadas
                      </p>
                      {(item.pecasUsadas || []).length === 0 ? (
                        <p className="text-xs text-gray-500">
                          Nenhuma peça registrada.
                        </p>
                      ) : (
                        <ul className="mt-1 space-y-1 text-xs text-gray-600">
                          {item.pecasUsadas.map((uso) => (
                            <li key={uso.id}>
                              {uso.quantidade} {uso.peca?.unidade || ""}{" "}
                              {uso.peca?.nome} — usado por{" "}
                              {uso.usuario?.nome || "-"} em{" "}
                              {formatarDataHora(uso.dataUso)}
                            </li>
                          ))}
                        </ul>
                      )}

                      {podePermitido && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => abrirUsoPeca(item.id)}
                            className="btn-secondary text-xs"
                          >
                            {usoPecaAbertoId === item.id
                              ? "Cancelar"
                              : "🔧 Registrar uso de peça"}
                          </button>
                        </div>
                      )}

                      {usoPecaAbertoId === item.id && (
                        <form
                          onSubmit={(e) => handleRegistrarUsoPeca(e, item.id)}
                          className="mt-2 grid grid-cols-1 gap-2 rounded-lg bg-white/80 p-3 md:grid-cols-3"
                        >
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-700">
                              Peça
                            </label>
                            <select
                              value={formUsoPeca.pecaId}
                              onChange={(e) =>
                                setFormUsoPeca((prev) => ({
                                  ...prev,
                                  pecaId: e.target.value,
                                }))
                              }
                              className="select-field py-1.5 text-sm"
                            >
                              <option value="">Selecione...</option>
                              {pecas.map((peca) => (
                                <option key={peca.id} value={peca.id}>
                                  {peca.nome}
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
                              value={formUsoPeca.quantidade}
                              onChange={(e) =>
                                setFormUsoPeca((prev) => ({
                                  ...prev,
                                  quantidade: e.target.value,
                                }))
                              }
                              className="input-field py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-700">
                              Observação
                            </label>
                            <input
                              value={formUsoPeca.observacao}
                              onChange={(e) =>
                                setFormUsoPeca((prev) => ({
                                  ...prev,
                                  observacao: e.target.value,
                                }))
                              }
                              className="input-field py-1.5 text-sm"
                            />
                          </div>
                          <div className="md:col-span-3 flex justify-end">
                            <button
                              type="submit"
                              disabled={submitting}
                              className="btn-primary text-sm disabled:opacity-60"
                            >
                              {submitting ? "Salvando..." : "Confirmar uso"}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
