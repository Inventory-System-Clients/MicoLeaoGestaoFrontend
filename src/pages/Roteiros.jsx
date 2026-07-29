import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";
import { confirmar } from "../utils/alerts";
import { filtrarLojasOperacionais } from "../utils/lojas";
import { obterEntradaMaquinaConcluida } from "../utils/roteiroMaquinas";

const DIAS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const resetVazio = () => ({ diaSemana: 0, hora: "23:59" });

const formularioInicial = {
  nome: "",
  usuarioId: "",
  veiculoId: "",
  todosDias: true,
  diasSemana: [],
  resetsAgendados: [resetVazio()],
};

const textoResets = (roteiro) => {
  const resets = Array.isArray(roteiro.resetsAgendados)
    ? roteiro.resetsAgendados
    : [];
  if (!resets.length) return "Sem reset definido";
  return resets
    .map((reset) => {
      const label = DIAS.find(
        (dia) => dia.value === Number(reset.diaSemana ?? 0),
      )?.label;
      return `${label || "-"} ${reset.hora || "23:59"}`;
    })
    .join(", ");
};

const itemInicial = { tipo: "LOJA", lojaId: "", anotacao: "" };

const textoDias = (roteiro) => {
  if (roteiro.todosDias) return "Todos os dias";
  const dias = Array.isArray(roteiro.diasSemana) ? roteiro.diasSemana : [];
  if (!dias.length) return "Sem dias definidos";
  return dias
    .map((dia) => DIAS.find((item) => item.value === Number(dia))?.label)
    .filter(Boolean)
    .join(", ");
};

const ordenarRoteiro = (roteiro) => ({
  ...roteiro,
  itens: [...(roteiro.itens || [])].sort((a, b) => a.ordem - b.ordem),
});

const obterStatusRoteiro = (roteiro, maquinas = []) => {
  const itens = roteiro.itens || [];
  if (!itens.length) return "nao_iniciado";

  let totalTarefas = 0;
  let totalConcluidas = 0;

  itens.forEach((item) => {
    if (item.tipo === "ANOTACAO") {
      totalTarefas += 1;
      if (item.concluido) totalConcluidas += 1;
      return;
    }

    const maquinasDaLoja = maquinas.filter(
      (maquina) => String(maquina.lojaId) === String(item.lojaId),
    );
    if (!maquinasDaLoja.length) {
      totalTarefas += 1;
      if (item.concluido) totalConcluidas += 1;
      return;
    }

    totalTarefas += maquinasDaLoja.length;
    totalConcluidas += maquinasDaLoja.filter(
      (maquina) => obterEntradaMaquinaConcluida(item, maquina.id).concluida,
    ).length;
  });

  if (totalTarefas > 0 && totalConcluidas >= totalTarefas) return "finalizado";
  if (totalConcluidas > 0 || itens.some((item) => item.concluido)) {
    return "em_andamento";
  }
  return "nao_iniciado";
};

const textoBotaoRoteiro = {
  nao_iniciado: "Iniciar roteiro",
  em_andamento: "Continuar roteiro",
  finalizado: "Rever roteiro",
};

export function Roteiros() {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useAuth();
  const isAdmin = ["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [roteiros, setRoteiros] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [ultimasMovVeiculos, setUltimasMovVeiculos] = useState({});
  const [form, setForm] = useState(formularioInicial);
  const [mostrarFormularioCriacao, setMostrarFormularioCriacao] = useState(false);
  const [filtros, setFiltros] = useState({
    nome: "",
    usuarioId: "",
    veiculoId: "",
    diasSemana: [],
    lojaIds: [],
  });
  const [itensForm, setItensForm] = useState({});
  const [editando, setEditando] = useState(null);
  const [dragInfo, setDragInfo] = useState(null);
  const [roteiroEmExecucao, setRoteiroEmExecucao] = useState(null);
  const [lojaSelecionada, setLojaSelecionada] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [mostrarAuditoria, setMostrarAuditoria] = useState(false);
  const [salvandoAuditoria, setSalvandoAuditoria] = useState(false);
  const [auditoriaEscopo, setAuditoriaEscopo] = useState("maquinas");
  const [auditoriaMaquinasSelecionadas, setAuditoriaMaquinasSelecionadas] =
    useState([]);
  const [auditoriaLojaId, setAuditoriaLojaId] = useState("");
  const [auditoriaRoteiroId, setAuditoriaRoteiroId] = useState("");
  const [auditoriaModo, setAuditoriaModo] = useState("dia");
  const [auditoriaData, setAuditoriaData] = useState("");

  const funcionarios = useMemo(
    () => usuarios.filter((item) => item.role === "FUNCIONARIO" && item.ativo !== false),
    [usuarios],
  );

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError("");

      const [roteirosRes, lojasRes, maquinasRes, veiculosRes, ultimasVeiculosRes] =
        await Promise.all([
          api.get("/roteiros"),
          api.get("/lojas"),
          api.get("/maquinas"),
          api.get("/veiculos"),
          api.get("/movimentacao-veiculos/ultimas").catch(() => ({ data: {} })),
        ]);

      setRoteiros((roteirosRes.data || []).map(ordenarRoteiro));
      setLojas(
        filtrarLojasOperacionais(
          (lojasRes.data || []).filter((loja) => loja.ativo !== false),
        ),
      );
      setMaquinas(maquinasRes.data || []);
      setVeiculos(veiculosRes.data || []);
      setUltimasMovVeiculos(ultimasVeiculosRes.data || {});

      if (isAdmin) {
        const usuariosRes = await api.get("/usuarios");
        setUsuarios(usuariosRes.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar roteiros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (loading || !roteiros.length) return;

    const params = new URLSearchParams(location.search);
    const roteiroId =
      params.get("iniciarRoteiro") || params.get("executarRoteiro");
    if (!roteiroId) return;

    const roteiro = roteiros.find((item) => String(item.id) === String(roteiroId));
    if (!roteiro) return;

    setRoteiroEmExecucao(roteiro);
    setLojaSelecionada(params.get("lojaId") || null);
    navigate("/roteiros", { replace: true });
  }, [loading, location.search, navigate, roteiros]);

  const atualizarDias = (dia) => {
    setForm((prev) => {
      const atual = new Set(prev.diasSemana);
      if (atual.has(dia)) atual.delete(dia);
      else atual.add(dia);
      return { ...prev, diasSemana: [...atual].sort() };
    });
  };

  const adicionarReset = (setState) => {
    setState((prev) => ({
      ...prev,
      resetsAgendados: [...(prev.resetsAgendados || []), resetVazio()],
    }));
  };

  const removerReset = (setState, index) => {
    setState((prev) => ({
      ...prev,
      resetsAgendados: prev.resetsAgendados.filter((_, i) => i !== index),
    }));
  };

  const atualizarReset = (setState, index, campo, valor) => {
    setState((prev) => ({
      ...prev,
      resetsAgendados: prev.resetsAgendados.map((reset, i) =>
        i === index ? { ...reset, [campo]: valor } : reset,
      ),
    }));
  };

  const atualizarFiltroDia = (dia) => {
    setFiltros((prev) => {
      const atual = new Set(prev.diasSemana);
      if (atual.has(dia)) atual.delete(dia);
      else atual.add(dia);
      return { ...prev, diasSemana: [...atual].sort() };
    });
  };

  const adicionarFiltroLoja = (lojaId) => {
    if (!lojaId) return;
    setFiltros((prev) =>
      prev.lojaIds.includes(lojaId)
        ? prev
        : { ...prev, lojaIds: [...prev.lojaIds, lojaId] },
    );
  };

  const removerFiltroLoja = (lojaId) => {
    setFiltros((prev) => ({
      ...prev,
      lojaIds: prev.lojaIds.filter((id) => id !== lojaId),
    }));
  };

  const criarRoteiro = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setError("");
    setSuccess("");

    try {
      if (!form.nome.trim() || !form.usuarioId) {
        setError("Informe o nome do roteiro e o funcionário.");
        return;
      }

      await api.post("/roteiros", form);
      setForm(formularioInicial);
      setMostrarFormularioCriacao(false);
      setSuccess("Roteiro criado com sucesso.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao criar roteiro.");
    } finally {
      setSalvando(false);
    }
  };

  const atualizarRoteiro = async (roteiroId, dados) => {
    try {
      setError("");
      await api.put(`/roteiros/${roteiroId}`, dados);
      setEditando(null);
      setSuccess("Roteiro atualizado.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao atualizar roteiro.");
    }
  };

  const excluirRoteiro = async (roteiroId) => {
    const confirmado = await confirmar({
      title: "Excluir roteiro?",
      text: "Isso remove o roteiro e todos os itens dele.",
      confirmButtonText: "Excluir",
    });
    if (!confirmado) return;
    try {
      await api.delete(`/roteiros/${roteiroId}`);
      setSuccess("Roteiro removido.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao excluir roteiro.");
    }
  };

  const toggleMaquinaAuditoriaSelecionada = (maquinaId) => {
    setAuditoriaMaquinasSelecionadas((prev) =>
      prev.includes(maquinaId)
        ? prev.filter((id) => id !== maquinaId)
        : [...prev, maquinaId],
    );
  };

  const resolverMaquinasAlvoAuditoria = () => {
    if (auditoriaEscopo === "maquinas") {
      return maquinas.filter((m) =>
        auditoriaMaquinasSelecionadas.includes(m.id),
      );
    }
    if (auditoriaEscopo === "loja") {
      return maquinas.filter(
        (m) => String(m.lojaId) === String(auditoriaLojaId),
      );
    }
    if (auditoriaEscopo === "roteiro") {
      const roteiroAlvo = roteiros.find((r) => r.id === auditoriaRoteiroId);
      const lojaIds = new Set(
        (roteiroAlvo?.itens || [])
          .filter((item) => item.tipo === "LOJA")
          .map((item) => String(item.lojaId)),
      );
      return maquinas.filter((m) => lojaIds.has(String(m.lojaId)));
    }
    return maquinas;
  };

  const resolverDatasAlvoAuditoria = () => {
    if (!auditoriaData) return [];
    if (auditoriaModo === "dia") return [auditoriaData];

    const datas = [];
    const base = new Date(`${auditoriaData}T00:00:00`);
    for (let i = 0; i < 7; i += 1) {
      const data = new Date(base);
      data.setDate(base.getDate() + i);
      datas.push(data.toISOString().slice(0, 10));
    }
    return datas;
  };

  const agendarAuditoria = async () => {
    const maquinasAlvo = resolverMaquinasAlvoAuditoria();
    const datasAlvo = resolverDatasAlvoAuditoria();

    if (maquinasAlvo.length === 0) {
      setError("Selecione ao menos uma máquina, loja ou rota para a auditoria.");
      return;
    }
    if (datasAlvo.length === 0) {
      setError("Escolha a data da auditoria.");
      return;
    }

    setSalvandoAuditoria(true);
    setError("");
    try {
      await Promise.all(
        maquinasAlvo.map((maquina) => {
          const atuais = new Set(maquina.datasAuditoria || []);
          datasAlvo.forEach((data) => atuais.add(data));
          return api.put(`/maquinas/${maquina.id}`, {
            datasAuditoria: [...atuais].sort(),
          });
        }),
      );
      setSuccess(
        `Auditoria agendada para ${maquinasAlvo.length} máquina(s).`,
      );
      setAuditoriaMaquinasSelecionadas([]);
      setAuditoriaLojaId("");
      setAuditoriaRoteiroId("");
      setAuditoriaData("");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao agendar auditoria.");
    } finally {
      setSalvandoAuditoria(false);
    }
  };

  const removerDataAuditoriaMaquina = async (maquina, data) => {
    try {
      const novasDatas = (maquina.datasAuditoria || []).filter(
        (d) => d !== data,
      );
      await api.put(`/maquinas/${maquina.id}`, { datasAuditoria: novasDatas });
      await carregarDados();
    } catch (err) {
      setError(
        err.response?.data?.error || "Erro ao remover data de auditoria.",
      );
    }
  };

  const alterarItemForm = (roteiroId, patch) => {
    setItensForm((prev) => ({
      ...prev,
      [roteiroId]: { ...(prev[roteiroId] || itemInicial), ...patch },
    }));
  };

  const adicionarItem = async (roteiroId) => {
    const dados = itensForm[roteiroId] || itemInicial;

    try {
      setError("");
      await api.post(`/roteiros/${roteiroId}/itens`, dados);
      setItensForm((prev) => ({ ...prev, [roteiroId]: itemInicial }));
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao adicionar item.");
    }
  };

  const excluirItem = async (itemId) => {
    try {
      await api.delete(`/roteiros/itens/${itemId}`);
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao remover item.");
    }
  };

  const moverItem = async (destinoRoteiroId, indiceDestino) => {
    if (!dragInfo || !isAdmin) return;

    const proximos = roteiros.map((roteiro) => ({
      ...roteiro,
      itens: [...(roteiro.itens || [])],
    }));
    const origem = proximos.find((roteiro) => roteiro.id === dragInfo.roteiroId);
    const destino = proximos.find((roteiro) => roteiro.id === destinoRoteiroId);
    if (!origem || !destino) return;

    const itemIndex = origem.itens.findIndex((item) => item.id === dragInfo.itemId);
    if (itemIndex < 0) return;

    const [itemMovido] = origem.itens.splice(itemIndex, 1);
    const posicao = Math.max(0, Math.min(indiceDestino, destino.itens.length));
    destino.itens.splice(posicao, 0, { ...itemMovido, roteiroId: destinoRoteiroId });

    proximos.forEach((roteiro) => {
      roteiro.itens = roteiro.itens.map((item, index) => ({ ...item, ordem: index }));
    });

    setRoteiros(proximos);
    setDragInfo(null);

    try {
      const itensAlterados = proximos.flatMap((roteiro) =>
        roteiro.itens.map((item) => ({
          id: item.id,
          roteiroId: roteiro.id,
          ordem: item.ordem,
        })),
      );

      await Promise.all(
        itensAlterados.map((item) =>
          api.put(`/roteiros/itens/${item.id}`, {
            roteiroId: item.roteiroId,
            ordem: item.ordem,
          }),
        ),
      );
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao mover item.");
      await carregarDados();
    }
  };

  const funcionarioEstaComVeiculo = (roteiro) => {
    if (!roteiro.veiculoId) return true;
    const veiculo = veiculos.find((item) => item.id === roteiro.veiculoId);
    const ultimaMov = ultimasMovVeiculos[roteiro.veiculoId];

    return (
      veiculo?.emUso === true &&
      ultimaMov?.tipo === "retirada" &&
      String(ultimaMov?.usuarioId || ultimaMov?.usuario?.id) === String(usuario?.id)
    );
  };

  const iniciarRoteiro = (roteiro, statusRoteiro) => {
    // Ao rever um roteiro já finalizado não faz sentido travar por causa do
    // veículo — ele já deve ter sido devolvido nesse ponto.
    if (
      statusRoteiro !== "finalizado" &&
      roteiro.veiculoId &&
      !funcionarioEstaComVeiculo(roteiro)
    ) {
      navigate(`/veiculos?roteiroId=${roteiro.id}&veiculoId=${roteiro.veiculoId}`);
      return;
    }

    navigate(`/roteiros/${roteiro.id}/executar`);
  };

  const abrirMovimentacaoRoteiro = (item, maquinaId) => {
    const params = new URLSearchParams({
      abrirFormulario: "true",
      modo: "nova_movimentacao",
      lojaId: item.lojaId,
      maquinaId,
      roteiroId: item.roteiroId,
      roteiroItemId: item.id,
      origemRoteiro: "true",
      bloquearLojaMaquina: "true",
    });

    navigate(`/movimentacoes?${params}`);
  };

  const concluirItem = async (item, concluido = true) => {
    try {
      await api.patch(`/roteiros/itens/${item.id}/concluir`, { concluido });
      await carregarDados();
      setRoteiroEmExecucao((prev) => {
        if (!prev) return prev;
        return ordenarRoteiro({
          ...prev,
          itens: prev.itens.map((roteiroItem) =>
            roteiroItem.id === item.id
              ? {
                  ...roteiroItem,
                  concluido,
                  concluidoEm: concluido ? new Date().toISOString() : null,
                }
              : roteiroItem,
          ),
        });
      });
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao atualizar item do roteiro.");
    }
  };

  if (loading) return <PageLoader />;

  const roteiroExecucaoAtualizado = roteiroEmExecucao
    ? roteiros.find((roteiro) => roteiro.id === roteiroEmExecucao.id) ||
      roteiroEmExecucao
    : null;
  const lojasDoRoteiro = (roteiroExecucaoAtualizado?.itens || []).filter(
    (item) => item.tipo === "LOJA",
  );
  const itemLojaSelecionada = lojasDoRoteiro.find(
    (item) => String(item.lojaId) === String(lojaSelecionada),
  );
  const maquinasDaLojaSelecionada = lojaSelecionada
    ? maquinas.filter((maquina) => String(maquina.lojaId) === String(lojaSelecionada))
    : [];
  const roteirosFiltrados = roteiros.filter((roteiro) => {
    const nomeBusca = filtros.nome.trim().toLowerCase();
    if (nomeBusca && !String(roteiro.nome || "").toLowerCase().includes(nomeBusca)) {
      return false;
    }

    if (filtros.usuarioId === "__sem_funcionario__" && roteiro.usuarioId) {
      return false;
    }
    if (
      filtros.usuarioId &&
      filtros.usuarioId !== "__sem_funcionario__" &&
      String(roteiro.usuarioId) !== String(filtros.usuarioId)
    ) {
      return false;
    }

    if (filtros.veiculoId === "__sem_veiculo__" && roteiro.veiculoId) {
      return false;
    }
    if (
      filtros.veiculoId &&
      filtros.veiculoId !== "__sem_veiculo__" &&
      String(roteiro.veiculoId) !== String(filtros.veiculoId)
    ) {
      return false;
    }

    if (filtros.diasSemana.length) {
      const diasRoteiro = roteiro.todosDias
        ? DIAS.map((dia) => dia.value)
        : (roteiro.diasSemana || []).map(Number);
      if (!filtros.diasSemana.some((dia) => diasRoteiro.includes(Number(dia)))) {
        return false;
      }
    }

    if (filtros.lojaIds.length) {
      const lojasRoteiro = new Set(
        (roteiro.itens || [])
          .filter((item) => item.tipo === "LOJA")
          .map((item) => String(item.lojaId)),
      );
      if (!filtros.lojaIds.every((lojaId) => lojasRoteiro.has(String(lojaId)))) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Roteiros</h1>
          <p className="mt-2 text-gray-600">
            Organização diária de funcionários, veículos, lojas e tarefas.
          </p>
        </div>

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

        {isAdmin && (
          <section className="mb-6 rounded-lg border border-red-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setMostrarAuditoria((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <span className="text-xl">🔍</span>
                Auditoria de Máquinas
              </span>
              <span
                className={`text-sm transition-transform duration-200 ${mostrarAuditoria ? "rotate-90" : ""}`}
              >
                ▶
              </span>
            </button>

            {mostrarAuditoria && (
              <div className="border-t border-red-100 p-5">
                <p className="mb-4 text-sm text-gray-600">
                  Agende dias em que a máquina fica em modo auditoria: o
                  registro de movimentação fica 100% manual, sem sugerir
                  quanto tem, quanto abastecer ou fichas.
                </p>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-bold text-gray-700">
                    Onde aplicar
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "maquinas", label: "Máquina(s) específica(s)" },
                      { value: "loja", label: "Loja inteira" },
                      { value: "roteiro", label: "Rota específica" },
                      { value: "todas", label: "Todas as rotas" },
                    ].map((opcao) => (
                      <button
                        key={opcao.value}
                        type="button"
                        onClick={() => setAuditoriaEscopo(opcao.value)}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                          auditoriaEscopo === opcao.value
                            ? "bg-red-600 text-white"
                            : "bg-slate-100 text-gray-700 hover:bg-slate-200"
                        }`}
                      >
                        {opcao.label}
                      </button>
                    ))}
                  </div>
                </div>

                {auditoriaEscopo === "maquinas" && (
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-bold text-gray-700">
                      Selecione as máquinas
                    </label>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-3">
                      {lojas.map((loja) => {
                        const maquinasDaLoja = maquinas.filter(
                          (m) => String(m.lojaId) === String(loja.id),
                        );
                        if (maquinasDaLoja.length === 0) return null;
                        return (
                          <div key={loja.id} className="mb-2">
                            <p className="text-xs font-bold uppercase text-gray-500">
                              {loja.nome}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {maquinasDaLoja.map((maquina) => (
                                <label
                                  key={maquina.id}
                                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold cursor-pointer ${
                                    auditoriaMaquinasSelecionadas.includes(
                                      maquina.id,
                                    )
                                      ? "border-red-400 bg-red-50 text-red-700"
                                      : "border-gray-200 text-gray-700"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={auditoriaMaquinasSelecionadas.includes(
                                      maquina.id,
                                    )}
                                    onChange={() =>
                                      toggleMaquinaAuditoriaSelecionada(
                                        maquina.id,
                                      )
                                    }
                                  />
                                  {maquina.nome} - {maquina.codigo}
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {auditoriaEscopo === "loja" && (
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-bold text-gray-700">
                      Loja
                    </label>
                    <select
                      value={auditoriaLojaId}
                      onChange={(e) => setAuditoriaLojaId(e.target.value)}
                      className="select-field"
                    >
                      <option value="">Selecione...</option>
                      {lojas.map((loja) => (
                        <option key={loja.id} value={loja.id}>
                          {loja.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {auditoriaEscopo === "roteiro" && (
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-bold text-gray-700">
                      Rota
                    </label>
                    <select
                      value={auditoriaRoteiroId}
                      onChange={(e) => setAuditoriaRoteiroId(e.target.value)}
                      className="select-field"
                    >
                      <option value="">Selecione...</option>
                      {roteiros.map((roteiro) => (
                        <option key={roteiro.id} value={roteiro.id}>
                          {roteiro.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[200px_200px_auto] sm:items-end">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-700">
                      Período
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAuditoriaModo("dia")}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                          auditoriaModo === "dia"
                            ? "bg-red-600 text-white"
                            : "bg-slate-100 text-gray-700"
                        }`}
                      >
                        Um dia
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuditoriaModo("semana")}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
                          auditoriaModo === "semana"
                            ? "bg-red-600 text-white"
                            : "bg-slate-100 text-gray-700"
                        }`}
                      >
                        Semana inteira
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-700">
                      {auditoriaModo === "dia" ? "Data" : "Data inicial"}
                    </label>
                    <input
                      type="date"
                      value={auditoriaData}
                      onChange={(e) => setAuditoriaData(e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={agendarAuditoria}
                    disabled={salvandoAuditoria}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {salvandoAuditoria ? "Agendando..." : "Agendar auditoria"}
                  </button>
                </div>

                <div className="mt-5 border-t border-gray-100 pt-4">
                  <p className="mb-2 text-sm font-bold text-gray-700">
                    Auditorias já agendadas
                  </p>
                  <div className="space-y-2">
                    {maquinas
                      .filter((m) => (m.datasAuditoria || []).length > 0)
                      .map((maquina) => (
                        <div
                          key={maquina.id}
                          className="rounded-lg border border-gray-200 p-2 text-sm"
                        >
                          <span className="font-semibold text-gray-800">
                            {maquina.nome} - {maquina.codigo}
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {[...maquina.datasAuditoria].sort().map((data) => (
                              <span
                                key={data}
                                className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700"
                              >
                                {data}
                                <button
                                  type="button"
                                  onClick={() =>
                                    removerDataAuditoriaMaquina(maquina, data)
                                  }
                                  className="text-red-400 hover:text-red-700"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    {maquinas.every(
                      (m) => (m.datasAuditoria || []).length === 0,
                    ) && (
                      <p className="text-xs text-gray-400">
                        Nenhuma auditoria agendada.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {false && roteiroExecucaoAtualizado && (
          <section className="mb-6 rounded-lg border border-orange-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Executando: {roteiroExecucaoAtualizado.nome}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  Clique na loja, escolha a máquina e lance a movimentação.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setRoteiroEmExecucao(null);
                  setLojaSelecionada(null);
                }}
              >
                Fechar execução
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
              <div className="space-y-2">
                {(roteiroExecucaoAtualizado.itens || []).map((item, index) => {
                  const maquinasDaLojaItem =
                    item.tipo === "LOJA"
                      ? maquinas.filter(
                          (maquina) =>
                            String(maquina.lojaId) === String(item.lojaId),
                        )
                      : [];
                  const maquinasConcluidas = new Set(
                    (item.maquinasConcluidas || []).map(String),
                  );
                  const totalConcluidas = maquinasDaLojaItem.filter((maquina) =>
                    maquinasConcluidas.has(String(maquina.id)),
                  ).length;
                  const lojaConcluida =
                    item.concluido ||
                    (maquinasDaLojaItem.length > 0 &&
                      totalConcluidas === maquinasDaLojaItem.length);

                  return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() =>
                      item.tipo === "LOJA" && setLojaSelecionada(item.lojaId)
                    }
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      lojaConcluida
                        ? "border-emerald-300 bg-emerald-50"
                        : item.tipo === "ANOTACAO"
                          ? "border-blue-200 bg-blue-50"
                          : String(lojaSelecionada) === String(item.lojaId)
                            ? "border-orange-400 bg-orange-50"
                            : "border-slate-200 bg-slate-50 hover:border-orange-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-gray-700">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-gray-900">
                          {item.tipo === "ANOTACAO"
                            ? "Anotação"
                            : item.loja?.nome || "Loja"}
                        </span>
                        <span className="mt-1 block text-sm text-gray-600">
                          {item.tipo === "ANOTACAO"
                            ? item.anotacao
                            : lojaConcluida
                              ? "Concluída"
                              : "Abrir máquinas desta loja"}
                        </span>
                      </span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          concluirItem(item, !item.concluido);
                        }}
                        className={`rounded-lg px-3 py-1 text-xs font-bold ${
                          lojaConcluida
                            ? "bg-white text-emerald-700"
                            : "bg-white text-orange-700"
                        }`}
                      >
                        {lojaConcluida ? "Concluído" : "Concluir"}
                      </span>
                    </div>
                  </button>
                  );
                })}

                {lojasDoRoteiro.length === 0 && (
                  <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-gray-500">
                    Este roteiro ainda não tem lojas.
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                {lojaSelecionada ? (
                  <>
                    <h3 className="text-lg font-bold text-gray-900">
                      Máquinas da loja
                    </h3>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      {maquinasDaLojaSelecionada.map((maquina) => {
                        const maquinaConcluida = new Set(
                          (itemLojaSelecionada?.maquinasConcluidas || []).map(
                            String,
                          ),
                        ).has(String(maquina.id));

                        return (
                        <button
                          type="button"
                          key={maquina.id}
                          className={`rounded-lg border p-4 text-left ${
                            maquinaConcluida
                              ? "border-emerald-300 bg-emerald-50"
                              : "border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-orange-50"
                          }`}
                          onClick={() =>
                            itemLojaSelecionada &&
                            abrirMovimentacaoRoteiro(
                              itemLojaSelecionada,
                              maquina.id,
                            )
                          }
                        >
                          <p className="font-bold text-gray-900">
                            {maquina.nome || maquina.codigo}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            Código: {maquina.codigo}
                          </p>
                          {maquinaConcluida && (
                            <p className="mt-2 text-xs font-black uppercase text-emerald-700">
                              Concluido
                            </p>
                          )}
                        </button>
                        );
                      })}
                    </div>
                    {maquinasDaLojaSelecionada.length === 0 && (
                      <p className="mt-3 text-sm text-gray-500">
                        Nenhuma máquina cadastrada nesta loja.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-48 items-center justify-center text-center text-gray-500">
                    Selecione uma loja do roteiro para ver as máquinas.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {isAdmin && (
          <section className="mb-6 rounded-lg border border-orange-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Filtros</h2>
                <p className="text-sm text-gray-600">
                  Encontre roteiros por nome, funcionario, veiculo, dias e lojas.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setMostrarFormularioCriacao((prev) => !prev)}
              >
                {mostrarFormularioCriacao ? "Fechar" : "Criar roteiro"}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Nome do roteiro
                </label>
                <input
                  value={filtros.nome}
                  onChange={(e) => setFiltros({ ...filtros, nome: e.target.value })}
                  className="input-field"
                  placeholder="Buscar por nome..."
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Funcionario
                </label>
                <select
                  value={filtros.usuarioId}
                  onChange={(e) =>
                    setFiltros({ ...filtros, usuarioId: e.target.value })
                  }
                  className="select-field"
                >
                  <option value="">Todos</option>
                  <option value="__sem_funcionario__">Sem funcionario</option>
                  {funcionarios.map((funcionario) => (
                    <option key={funcionario.id} value={funcionario.id}>
                      {funcionario.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Veiculo
                </label>
                <select
                  value={filtros.veiculoId}
                  onChange={(e) =>
                    setFiltros({ ...filtros, veiculoId: e.target.value })
                  }
                  className="select-field"
                >
                  <option value="">Todos</option>
                  <option value="__sem_veiculo__">Sem veiculo</option>
                  {veiculos.map((veiculo) => (
                    <option key={veiculo.id} value={veiculo.id}>
                      {veiculo.emoji || ""} {veiculo.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Lojas
                </label>
                <select
                  value=""
                  onChange={(e) => adicionarFiltroLoja(e.target.value)}
                  className="select-field"
                >
                  <option value="">Adicionar loja...</option>
                  {lojas
                    .filter((loja) => !filtros.lojaIds.includes(loja.id))
                    .map((loja) => (
                      <option key={loja.id} value={loja.id}>
                        {loja.nome}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="mb-2 text-sm font-semibold text-gray-700">
                Dias da semana
              </p>
              <div className="flex flex-wrap gap-2">
                {DIAS.map((dia) => (
                  <button
                    type="button"
                    key={dia.value}
                    onClick={() => atualizarFiltroDia(dia.value)}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                      filtros.diasSemana.includes(dia.value)
                        ? "border-orange-500 bg-orange-100 text-orange-800"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {dia.label}
                  </button>
                ))}
              </div>
            </div>

            {filtros.lojaIds.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {filtros.lojaIds.map((lojaId) => {
                  const loja = lojas.find((item) => item.id === lojaId);
                  return (
                    <button
                      type="button"
                      key={lojaId}
                      onClick={() => removerFiltroLoja(lojaId)}
                      className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-800"
                    >
                      {loja?.nome || "Loja"} x
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {isAdmin && mostrarFormularioCriacao && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <form
              onSubmit={criarRoteiro}
              className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-orange-100 bg-white p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-gray-900">
                  Criar roteiro
                </h2>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  onClick={() => setMostrarFormularioCriacao(false)}
                >
                  Fechar
                </button>
              </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Nome do roteiro *
                </label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className="input-field"
                  placeholder="Ex: Rota Zona Leste"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Funcionário *
                </label>
                <select
                  value={form.usuarioId}
                  onChange={(e) => setForm({ ...form, usuarioId: e.target.value })}
                  className="select-field"
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
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Veículo
                </label>
                <select
                  value={form.veiculoId}
                  onChange={(e) => setForm({ ...form, veiculoId: e.target.value })}
                  className="select-field"
                >
                  <option value="">Sem veículo</option>
                  {veiculos.map((veiculo) => (
                    <option key={veiculo.id} value={veiculo.id}>
                      {veiculo.emoji || ""} {veiculo.nome} - {veiculo.modelo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-800">
                  Reset deste roteiro
                </p>
                <button
                  type="button"
                  onClick={() => adicionarReset(setForm)}
                  className="btn-secondary text-xs"
                >
                  + Adicionar dia/horário
                </button>
              </div>
              <div className="space-y-2">
                {form.resetsAgendados.map((reset, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                  >
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-700">
                        Dia do reset
                      </label>
                      <select
                        value={reset.diaSemana}
                        onChange={(e) =>
                          atualizarReset(
                            setForm,
                            index,
                            "diaSemana",
                            Number(e.target.value),
                          )
                        }
                        className="select-field"
                      >
                        {DIAS.map((dia) => (
                          <option key={dia.value} value={dia.value}>
                            {dia.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-700">
                        Horário do reset
                      </label>
                      <input
                        type="time"
                        value={reset.hora}
                        onChange={(e) =>
                          atualizarReset(setForm, index, "hora", e.target.value)
                        }
                        className="input-field"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removerReset(setForm, index)}
                      disabled={form.resetsAgendados.length === 1}
                      className="btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={form.todosDias}
                  onChange={(e) =>
                    setForm({ ...form, todosDias: e.target.checked, diasSemana: [] })
                  }
                />
                Todos os dias
              </label>
              {!form.todosDias && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {DIAS.map((dia) => (
                    <button
                      type="button"
                      key={dia.value}
                      onClick={() => atualizarDias(dia.value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-bold ${
                        form.diasSemana.includes(dia.value)
                          ? "border-orange-500 bg-orange-100 text-orange-800"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {dia.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMostrarFormularioCriacao(false)}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={salvando}
                >
                  {salvando ? "Salvando..." : "Criar roteiro"}
                </button>
              </div>
            </form>
          </div>
        )}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {roteirosFiltrados.map((roteiro) => {
            const itemForm = itensForm[roteiro.id] || itemInicial;
            const editandoEste = editando?.id === roteiro.id;
            const editDias = editandoEste
              ? Array.isArray(editando.diasSemana)
                ? editando.diasSemana
                : []
              : [];
            const statusRoteiro = obterStatusRoteiro(roteiro, maquinas);

            return (
              <article
                key={roteiro.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => moverItem(roteiro.id, roteiro.itens?.length || 0)}
                className="rounded-lg border border-orange-100 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {roteiro.nome}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {roteiro.funcionario?.nome || "Sem funcionário"} ·{" "}
                      {roteiro.veiculo
                        ? `${roteiro.veiculo.emoji || ""} ${roteiro.veiculo.nome}`
                        : "Sem veículo"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-orange-700">
                      {textoDias(roteiro)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-emerald-700">
                      Reset: {textoResets(roteiro)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isAdmin && (
                      <>
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() =>
                          setEditando(
                            editandoEste
                              ? null
                              : {
                                  id: roteiro.id,
                                  nome: roteiro.nome,
                                  usuarioId: roteiro.usuarioId,
                                  veiculoId: roteiro.veiculoId || "",
                                  todosDias: roteiro.todosDias,
                                  diasSemana: roteiro.diasSemana || [],
                                  resetsAgendados:
                                    Array.isArray(roteiro.resetsAgendados) &&
                                    roteiro.resetsAgendados.length > 0
                                      ? roteiro.resetsAgendados
                                      : [resetVazio()],
                                  ativo: roteiro.ativo,
                                },
                          )
                        }
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-danger text-sm"
                        onClick={() => excluirRoteiro(roteiro.id)}
                      >
                        Excluir
                      </button>
                      </>
                    )}
                  </div>
                </div>

                {editandoEste && (
                  <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <input
                        value={editando.nome}
                        onChange={(e) =>
                          setEditando({ ...editando, nome: e.target.value })
                        }
                        className="input-field"
                      />
                      <select
                        value={editando.usuarioId}
                        onChange={(e) =>
                          setEditando({ ...editando, usuarioId: e.target.value })
                        }
                        className="select-field"
                      >
                        {funcionarios.map((funcionario) => (
                          <option key={funcionario.id} value={funcionario.id}>
                            {funcionario.nome}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editando.veiculoId}
                        onChange={(e) =>
                          setEditando({ ...editando, veiculoId: e.target.value })
                        }
                        className="select-field"
                      >
                        <option value="">Sem veículo</option>
                        {veiculos.map((veiculo) => (
                          <option key={veiculo.id} value={veiculo.id}>
                            {veiculo.emoji || ""} {veiculo.nome}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={editando.todosDias}
                          onChange={(e) =>
                            setEditando({
                              ...editando,
                              todosDias: e.target.checked,
                              diasSemana: [],
                            })
                          }
                        />
                        Todos os dias
                      </label>
                    </div>
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-700">
                          Dias e horários de reset
                        </p>
                        <button
                          type="button"
                          onClick={() => adicionarReset(setEditando)}
                          className="btn-secondary text-xs"
                        >
                          + Adicionar
                        </button>
                      </div>
                      <div className="space-y-2">
                        {editando.resetsAgendados.map((reset, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                          >
                            <select
                              value={reset.diaSemana}
                              onChange={(e) =>
                                atualizarReset(
                                  setEditando,
                                  index,
                                  "diaSemana",
                                  Number(e.target.value),
                                )
                              }
                              className="select-field"
                            >
                              {DIAS.map((dia) => (
                                <option key={dia.value} value={dia.value}>
                                  {dia.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="time"
                              value={reset.hora}
                              onChange={(e) =>
                                atualizarReset(
                                  setEditando,
                                  index,
                                  "hora",
                                  e.target.value,
                                )
                              }
                              className="input-field"
                            />
                            <button
                              type="button"
                              onClick={() => removerReset(setEditando, index)}
                              disabled={editando.resetsAgendados.length === 1}
                              className="btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    {!editando.todosDias && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {DIAS.map((dia) => (
                          <button
                            type="button"
                            key={dia.value}
                            onClick={() => {
                              const atual = new Set(editDias);
                              if (atual.has(dia.value)) atual.delete(dia.value);
                              else atual.add(dia.value);
                              setEditando({
                                ...editando,
                                diasSemana: [...atual].sort(),
                              });
                            }}
                            className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                              editDias.includes(dia.value)
                                ? "border-orange-500 bg-orange-100 text-orange-800"
                                : "border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            {dia.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() => setEditando(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn-primary text-sm"
                        onClick={() => atualizarRoteiro(roteiro.id, editando)}
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                )}

                {isAdmin && (
                  <div className="mb-4 rounded-lg border border-slate-200 p-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[150px_1fr_auto]">
                      <select
                        value={itemForm.tipo}
                        onChange={(e) =>
                          alterarItemForm(roteiro.id, {
                            tipo: e.target.value,
                            lojaId: "",
                            anotacao: "",
                          })
                        }
                        className="select-field"
                      >
                        <option value="LOJA">Loja</option>
                        <option value="ANOTACAO">Anotação</option>
                      </select>
                      {itemForm.tipo === "LOJA" ? (
                        <select
                          value={itemForm.lojaId}
                          onChange={(e) =>
                            alterarItemForm(roteiro.id, { lojaId: e.target.value })
                          }
                          className="select-field"
                        >
                          <option value="">Selecione uma loja...</option>
                          {lojas.map((loja) => (
                            <option key={loja.id} value={loja.id}>
                              {loja.nome}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={itemForm.anotacao}
                          onChange={(e) =>
                            alterarItemForm(roteiro.id, { anotacao: e.target.value })
                          }
                          className="input-field"
                          placeholder="Ex: Conferir extintor, levar troco..."
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => adicionarItem(roteiro.id)}
                        className="btn-primary"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {(roteiro.itens || []).map((item, index) => (
                    <div
                      key={item.id}
                      draggable={isAdmin}
                      onDragStart={() =>
                        setDragInfo({ itemId: item.id, roteiroId: roteiro.id })
                      }
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => moverItem(roteiro.id, index)}
                      className={`flex items-start gap-3 rounded-lg border p-3 ${
                        item.tipo === "ANOTACAO"
                          ? "border-blue-200 bg-blue-50"
                          : "border-slate-200 bg-slate-50"
                      } ${isAdmin ? "cursor-move" : ""}`}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-gray-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900">
                          {item.tipo === "ANOTACAO"
                            ? "Anotação"
                            : item.loja?.nome || "Loja removida"}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                          {item.tipo === "ANOTACAO"
                            ? item.anotacao
                            : item.loja
                              ? [item.loja.endereco, item.loja.cidade, item.loja.estado]
                                  .filter(Boolean)
                                  .join(" · ")
                              : "Esta loja não está mais disponível"}
                        </p>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => excluirItem(item.id)}
                          className="text-sm font-bold text-red-600 hover:text-red-800"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}

                  {(!roteiro.itens || roteiro.itens.length === 0) && (
                    <div className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-gray-500">
                      Nenhuma loja ou anotação neste roteiro.
                    </div>
                  )}
                </div>

                <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    className={`px-5 py-3 text-sm font-bold shadow-sm ${
                      statusRoteiro === "finalizado"
                        ? "rounded-lg bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "btn-primary"
                    }`}
                    onClick={() => iniciarRoteiro(roteiro, statusRoteiro)}
                  >
                    {textoBotaoRoteiro[statusRoteiro]}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        {roteiros.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-gray-600">
            Nenhum roteiro criado ainda.
          </div>
        )}
        {roteiros.length > 0 && roteirosFiltrados.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-gray-600">
            Nenhum roteiro encontrado com estes filtros.
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
