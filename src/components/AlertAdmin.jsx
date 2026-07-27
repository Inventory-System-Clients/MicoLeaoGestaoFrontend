import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { AlertBox } from "./UIComponents";

const formatarDataHora = (valor) => {
  if (!valor) return "-";

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";

  return `${data.toLocaleDateString("pt-BR")} às ${data.toLocaleTimeString(
    "pt-BR",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  )}`;
};

const obterValorPorChaves = (objeto, chaves) => {
  for (const chave of chaves) {
    const valor = objeto?.[chave];
    if (valor !== undefined && valor !== null && valor !== "") {
      return valor;
    }
  }

  return "";
};

const extrairNomeUsuario = (valor) => {
  if (!valor) return "";
  if (typeof valor === "string") return valor;

  return (
    valor?.nome ||
    valor?.name ||
    valor?.usuario?.nome ||
    valor?.responsavel?.nome ||
    valor?.createdBy?.nome ||
    ""
  );
};

const obterNomeUsuario = (registro, sufixo = "") => {
  const campos = [
    `usuario${sufixo}`,
    `usuarioAtual${sufixo}`,
    `usuarioMovimentacao${sufixo}`,
    `responsavel${sufixo}`,
    `responsavelAtual${sufixo}`,
    `criadoPor${sufixo}`,
    `createdBy${sufixo}`,
  ];

  const usuario = obterValorPorChaves(registro, campos);
  const nomeDireto = extrairNomeUsuario(usuario);
  if (nomeDireto) return nomeDireto;

  const nomesAlternativos = [
    `usuarioNome${sufixo}`,
    `nomeUsuario${sufixo}`,
    `createdByNome${sufixo}`,
    `responsavelNome${sufixo}`,
    `usuarioAtualNome${sufixo}`,
    `usuarioMovimentacaoNome${sufixo}`,
    `movimentacaoAtualUsuarioNome${sufixo}`,
    `movimentacaoAnteriorUsuarioNome${sufixo}`,
  ];

  for (const chave of nomesAlternativos) {
    const nome = extrairNomeUsuario(registro?.[chave]);
    if (nome) return nome;
  }

  return "-";
};

const obterDataMovimentacao = (registro, sufixo = "") =>
  obterValorPorChaves(registro, [
    `dataMovimentacao${sufixo}`,
    `dataMovimentacaoAtual${sufixo}`,
    `dataMovimentacaoAnterior${sufixo}`,
    `dataColeta${sufixo}`,
    `createdAt${sufixo}`,
    `data${sufixo}`,
    `dataHora${sufixo}`,
    `createdAtAtual${sufixo}`,
    `createdAtAnterior${sufixo}`,
  ]);

const obterEstoqueAtual = (maquina, estoqueResposta) => {
  const estoqueMaquina =
    maquina?.estoqueAtual ??
    maquina?.estoque_atual ??
    maquina?.totalPos ??
    maquina?.total_pos ??
    maquina?.totalpos ??
    maquina?.estoque ??
    maquina?.estoque_atualizado;

  if (
    estoqueMaquina !== undefined &&
    estoqueMaquina !== null &&
    estoqueMaquina !== ""
  ) {
    return estoqueMaquina;
  }

  if (typeof estoqueResposta === "number") {
    return estoqueResposta;
  }

  return (
    estoqueResposta?.estoqueAtual ??
    estoqueResposta?.estoque_atual ??
    estoqueResposta?.totalPos ??
    estoqueResposta?.total_pos ??
    estoqueResposta?.totalpos ??
    estoqueResposta?.quantidade ??
    estoqueResposta?.estoque ??
    null
  );
};

const obterEstoqueDaMovimentacao = (movimentacao) =>
  obterValorPorChaves(movimentacao, [
    "estoqueAtual",
    "estoque_atual",
    "totalPos",
    "total_pos",
    "totalpos",
    "totalAtual",
    "total_atual",
    "total",
    "estoque",
  ]);

const renderizarInfoMovimentacao = (
  registro,
  sufixo = "",
  titulo = "Movimentação",
) => {
  const dataMovimentacao = obterDataMovimentacao(registro, sufixo);
  const usuario = obterNomeUsuario(registro, sufixo);

  return (
    <div className="rounded-xl border border-yellow-200 bg-white/80 p-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-700">
        {titulo}
      </p>
      <p className="mt-1 text-sm font-semibold text-yellow-900">
        {formatarDataHora(dataMovimentacao)}
      </p>
      <p className="mt-1 text-xs text-yellow-700">
        Usuário: <strong>{usuario}</strong>
      </p>
    </div>
  );
};

const filtrarAlertas = (
  alertas,
  tipoFiltro,
  dataInicio,
  dataFim,
  lojaId,
  usuarioId,
) =>
  alertas.filter((alerta) => {
    let passaTipoFiltro = true;
    if (tipoFiltro === "OUT") {
      passaTipoFiltro =
        alerta.tipo === "movimentacao_out" ||
        (alerta.contador_out != null && alerta.contador_in == null);
    } else if (tipoFiltro === "IN") {
      passaTipoFiltro =
        alerta.tipo === "movimentacao_in" ||
        (alerta.contador_in != null && alerta.contador_out == null);
    } else if (tipoFiltro === "PADRAO") {
      passaTipoFiltro =
        alerta.tipo === "abastecimento_incompleto" ||
        alerta.foraPadrao === true;
    }

    if (!passaTipoFiltro) return false;

    if (dataInicio) {
      const dataMovimento = new Date(
        obterDataMovimentacao(alerta) || alerta.dataColeta || alerta.createdAt,
      );
      const dataInf = new Date(dataInicio);
      if (dataMovimento < dataInf) return false;
    }

    if (dataFim) {
      const dataMovimento = new Date(
        obterDataMovimentacao(alerta) || alerta.dataColeta || alerta.createdAt,
      );
      const dataSup = new Date(dataFim);
      dataSup.setHours(23, 59, 59, 999);
      if (dataMovimento > dataSup) return false;
    }

    if (lojaId) {
      const alertaLojaName = String(
        alerta.lojaNome ?? alerta.loja?.nome ?? alerta.loja ?? "",
      );
      if (alertaLojaName !== String(lojaId)) return false;
    }

    if (usuarioId) {
      const usuarioAlerta = obterNomeUsuario(alerta) || "";
      if (usuarioAlerta !== usuarioId) return false;
    }

    return true;
  });

const ordenarEFiltrarUltimoAlertaPorMaquina = (alertas) => {
  const ordenados = [...alertas].sort((a, b) => {
    const dataA = new Date(
      obterDataMovimentacao(a) || a.dataColeta || a.createdAt || 0,
    ).getTime();
    const dataB = new Date(
      obterDataMovimentacao(b) || b.dataColeta || b.createdAt || 0,
    ).getTime();

    return dataB - dataA;
  });

  const vistos = new Set();

  return ordenados.filter((alerta) => {
    const chaveMaquina = String(alerta.maquinaId ?? alerta.maquina?.id ?? "");
    const chaveUnica = `${chaveMaquina}:${alerta.tipo || ""}`;

    if (vistos.has(chaveUnica)) {
      return false;
    }

    vistos.add(chaveUnica);
    return true;
  });
};

const alertaEValido = (alerta, estoqueAtualMaquina) => {
  if (!alerta) return false;

  if (typeof estoqueAtualMaquina !== "number") {
    return true;
  }

  const totalDepois = alerta.totalDepois ?? alerta.total_depois;
  const totalAntes = alerta.totalAntes ?? alerta.total_antes;

  if (totalDepois != null && estoqueAtualMaquina !== totalDepois) {
    return false;
  }

  if (totalAntes != null && alerta.abastecido != null) {
    const esperadoDepois = totalAntes + alerta.abastecido;
    if (esperadoDepois !== estoqueAtualMaquina) {
      return false;
    }
  }

  return true;
};

export default function AlertAdmin() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertaSelecionado, setAlertaSelecionado] = useState(null);
  const [maquinaSelecionada, setMaquinaSelecionada] = useState(null);
  const [movimentacoesMaquina, setMovimentacoesMaquina] = useState([]);
  const [carregandoMaquina, setCarregandoMaquina] = useState(false);
  const [erroMaquina, setErroMaquina] = useState("");
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("OUT");
  const [estoqueMaquinas, setEstoqueMaquinas] = useState({});
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [lojaId, setLojaId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [lojas, setLojas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loadingLojas, setLoadingLojas] = useState(false);
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  useEffect(() => {
    if (usuario?.role === "ADMIN") {
      carregarAlertas();
      carregarLojasEUsuarios();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario, tipoFiltro]);

  const carregarLojasEUsuarios = async () => {
    setLoadingLojas(true);
    setLoadingUsuarios(true);
    try {
      const [lojasRes, usuariosRes] = await Promise.all([
        api.get("/lojas").catch(() => ({ data: [] })),
        api.get("/usuarios").catch(() => ({ data: [] })),
      ]);
      setLojas(lojasRes.data || []);
      setUsuarios(usuariosRes.data || []);
    } catch (e) {
      console.error("Erro ao carregar lojas e usuários:", e);
    } finally {
      setLoadingLojas(false);
      setLoadingUsuarios(false);
    }
  };

  const carregarAlertas = async () => {
    setLoading(true);
    setErro("");

    try {
      let listaAlertas = [];

      if (tipoFiltro === "OUT") {
        const res = await api.get("/relatorios/alertas-movimentacao-out");
        listaAlertas = res.data?.alertas || [];
      } else if (tipoFiltro === "IN") {
        const res = await api.get("/relatorios/alertas-movimentacao-in");
        listaAlertas = res.data?.alertas || [];
      } else if (tipoFiltro === "PADRAO") {
        const res = await api.get(
          "/relatorios/alertas-abastecimento-incompleto",
        );
        listaAlertas = res.data?.alertas || [];
      }

      const maquinaIds = [
        ...new Set(
          listaAlertas.map((a) => a.maquinaId ?? a.maquina?.id).filter(Boolean),
        ),
      ];

      const novoEstoque = {};
      if (maquinaIds.length > 0) {
        try {
          await Promise.all(
            maquinaIds.map(async (maquinaId) => {
              try {
                const movRes = await api.get(
                  `/movimentacoes?maquinaId=${maquinaId}`,
                );
                const movimentacoes = movRes.data || [];
                if (movimentacoes.length > 0) {
                  const ultimaMov = movimentacoes[0];
                  novoEstoque[maquinaId] =
                    obterEstoqueDaMovimentacao(ultimaMov);
                }
              } catch (e) {
                console.error(
                  `Erro ao buscar estoque da máquina ${maquinaId}:`,
                  e,
                );
              }
            }),
          );
        } catch (e) {
          console.error("Erro ao carregar estoques:", e);
        }
      }
      setEstoqueMaquinas(novoEstoque);

      setAlertas(listaAlertas);
    } catch (error) {
      console.error("Erro ao buscar alertas:", error);
      setErro("Erro ao buscar alertas.");
      setAlertas([]);
    } finally {
      setLoading(false);
    }
  };

  const corrigirAlerta = async (alertaId, maquinaId) => {
    setRemovendo(true);
    setErro("");

    try {
      await api.delete(
        `/relatorios/alertas-movimentacao-inconsistente/${alertaId}`,
        { data: { maquinaId } },
      );
      await carregarAlertas();
    } catch (error) {
      console.error("Erro ao remover alerta:", error);
      setErro("Erro ao remover alerta. Tente novamente.");
    } finally {
      setRemovendo(false);
    }
  };

  const carregarDetalhesMaquina = async (maquinaId) => {
    if (!maquinaId) return;

    setCarregandoMaquina(true);
    setErroMaquina("");

    try {
      const [maquinaRes, estoqueRes, movimentacoesRes] = await Promise.all([
        api.get(`/maquinas/${maquinaId}`),
        api.get(`/maquinas/${maquinaId}/estoque`),
        api.get(`/movimentacoes?maquinaId=${maquinaId}`),
      ]);

      const maquinaData = maquinaRes.data || null;
      const estoqueData = estoqueRes?.data;
      const movimentacoes = movimentacoesRes.data || [];
      const ultimaMovimentacao = movimentacoes[0] || null;
      const estoqueMovimentacao =
        obterEstoqueDaMovimentacao(ultimaMovimentacao);
      const estoqueAtual =
        obterEstoqueAtual(maquinaData, estoqueData) ?? estoqueMovimentacao;

      setMaquinaSelecionada(
        maquinaData
          ? {
              ...maquinaData,
              estoqueAtual,
            }
          : null,
      );
      setMovimentacoesMaquina(movimentacoes);
    } catch (error) {
      console.error("Erro ao carregar detalhes da máquina:", error);
      setErroMaquina("Erro ao carregar os detalhes da máquina.");
      setMaquinaSelecionada(null);
      setMovimentacoesMaquina([]);
    } finally {
      setCarregandoMaquina(false);
    }
  };

  const abrirDetalhesAlerta = (alerta) => {
    setAlertaSelecionado(alerta);
    carregarDetalhesMaquina(alerta.maquinaId);
  };

  const irParaMaquina = (maquinaId) => {
    navigate(`/maquinas/${maquinaId}`);
  };

  const renderPainelDetalhesMaquina = () => {
    if (!alertaSelecionado) {
      return (
        <div className="rounded-2xl border border-dashed border-yellow-200 bg-white/70 p-6 text-sm text-slate-600 shadow-sm">
          Clique em um alerta para ver os detalhes da máquina aqui.
        </div>
      );
    }

    if (carregandoMaquina) {
      return (
        <div className="rounded-2xl border border-yellow-200 bg-white/80 p-6 text-sm text-slate-600 shadow-sm">
          Carregando detalhes da máquina...
        </div>
      );
    }

    if (erroMaquina) {
      return <AlertBox type="error" message={erroMaquina} />;
    }

    if (!maquinaSelecionada) {
      return (
        <div className="rounded-2xl border border-yellow-200 bg-white/70 p-6 text-sm text-slate-600 shadow-sm">
          Nenhum detalhe de máquina disponível para este alerta.
        </div>
      );
    }

    const movimentacoesRecentes = movimentacoesMaquina.slice(0, 2);

    return (
      <div className="space-y-5 rounded-2xl border border-yellow-200 bg-linear-to-br from-yellow-50 to-amber-50 p-4 shadow-sm lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-700">
            Detalhes da Máquina
          </p>
          <h3 className="mt-1 text-xl font-extrabold text-slate-900">
            {maquinaSelecionada.codigo || "-"} -{" "}
            {maquinaSelecionada.nome || "-"}
          </h3>
          <p className="text-sm text-slate-600">
            {maquinaSelecionada.lojaNome ||
              maquinaSelecionada.loja?.nome ||
              "-"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/70 bg-white/80 p-3 shadow-sm">
            <p className="text-xs text-slate-500">Código</p>
            <p className="text-sm font-semibold text-slate-900">
              {maquinaSelecionada.codigo || "-"}
            </p>
          </div>
          <div className="rounded-xl border border-white/70 bg-white/80 p-3 shadow-sm">
            <p className="text-xs text-slate-500">Nome</p>
            <p className="text-sm font-semibold text-slate-900">
              {maquinaSelecionada.nome || "-"}
            </p>
          </div>
          <div className="rounded-xl border border-white/70 bg-white/80 p-3 shadow-sm">
            <p className="text-xs text-slate-500">Tipo</p>
            <p className="text-sm font-semibold text-slate-900">
              {maquinaSelecionada.ultimoProduto ? (
                <span className="flex items-center gap-2">
                  <span>{maquinaSelecionada.ultimoProduto.emoji || "🧸"}</span>
                  <span>{maquinaSelecionada.ultimoProduto.nome}</span>
                </span>
              ) : (
                maquinaSelecionada.tipo || "-"
              )}
            </p>
          </div>
          <div className="rounded-xl border border-white/70 bg-white/80 p-3 shadow-sm">
            <p className="text-xs text-slate-500">Capacidade</p>
            <p className="text-sm font-semibold text-slate-900">
              {maquinaSelecionada.capacidadePadrao ||
                maquinaSelecionada.capacidade ||
                "-"}
            </p>
          </div>
          <div className="rounded-xl border border-white/70 bg-white/80 p-3 shadow-sm">
            <p className="text-xs text-slate-500">Estoque Atual</p>
            <p className="text-sm font-semibold text-slate-900">
              {maquinaSelecionada.estoqueAtual ?? "-"}
            </p>
          </div>
          <div className="rounded-xl border border-white/70 bg-white/80 p-3 shadow-sm">
            <p className="text-xs text-slate-500">Valor da Ficha</p>
            <p className="text-sm font-semibold text-slate-900">
              {maquinaSelecionada.valorFicha
                ? `R$ ${Number(maquinaSelecionada.valorFicha).toFixed(2)}`
                : "-"}
            </p>
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-base font-bold text-slate-900">
            Últimas 2 Movimentações
          </h4>
          {movimentacoesRecentes.length === 0 ? (
            <div className="rounded-xl border border-white/70 bg-white/80 p-4 text-sm text-slate-600 shadow-sm">
              Nenhuma movimentação encontrada.
            </div>
          ) : (
            <div className="space-y-3">
              {movimentacoesRecentes.map((mov) => {
                const dataMov =
                  obterDataMovimentacao(mov) || mov.dataColeta || mov.createdAt;

                return (
                  <div
                    key={mov.id}
                    className="rounded-xl border border-white/70 bg-white/80 p-4 shadow-sm"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
                        {mov.tipo === "saida" || mov.tipo === "movimentacao_out"
                          ? "Saída"
                          : mov.tipo === "entrada" ||
                              mov.tipo === "movimentacao_in"
                            ? "Entrada"
                            : "Movimentação"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatarDataHora(dataMov)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <p>
                        <span className="block text-xs text-slate-500">
                          Contador IN
                        </span>
                        <strong>{mov.contadorIn ?? "-"}</strong>
                      </p>
                      <p>
                        <span className="block text-xs text-slate-500">
                          Contador OUT
                        </span>
                        <strong>{mov.contadorOut ?? "-"}</strong>
                      </p>
                      <p>
                        <span className="block text-xs text-slate-500">
                          Fichas
                        </span>
                        <strong>{mov.fichas ?? "-"}</strong>
                      </p>
                      <p>
                        <span className="block text-xs text-slate-500">
                          Saída
                        </span>
                        <strong>{mov.sairam ?? "-"}</strong>
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      Usuário: <strong>{obterNomeUsuario(mov) || "-"}</strong>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando alertas...</div>;
  }

  if (usuario?.role !== "ADMIN") {
    return null;
  }

  const alertasFiltrados = filtrarAlertas(
    alertas,
    tipoFiltro,
    dataInicio,
    dataFim,
    lojaId,
    usuarioId,
  );
  const alertasValidos = alertasFiltrados.filter((alerta) =>
    alertaEValido(
      alerta,
      estoqueMaquinas[alerta.maquinaId ?? alerta.maquina?.id],
    ),
  );
  const alertasExibidos = ordenarEFiltrarUltimoAlertaPorMaquina(alertasValidos);

  return (
    <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="text-2xl text-yellow-500">⚠️</span>
        <h2 className="text-2xl font-bold text-slate-900">
          Alertas de Movimentação Inconsistente
        </h2>
      </div>

      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            className={`rounded border border-yellow-400 bg-yellow-100 px-4 py-2 font-bold text-yellow-800 shadow transition-colors hover:bg-yellow-200 ${tipoFiltro === "OUT" ? "ring-2 ring-yellow-500" : ""}`}
            onClick={() => setTipoFiltro("OUT")}
          >
            OUT
          </button>
          <button
            className={`rounded border border-yellow-400 bg-yellow-100 px-4 py-2 font-bold text-yellow-800 shadow transition-colors hover:bg-yellow-200 ${tipoFiltro === "IN" ? "ring-2 ring-yellow-500" : ""}`}
            onClick={() => setTipoFiltro("IN")}
          >
            IN
          </button>
          <button
            className={`rounded border border-yellow-400 bg-yellow-100 px-4 py-2 font-bold text-yellow-800 shadow transition-colors hover:bg-yellow-200 ${tipoFiltro === "PADRAO" ? "ring-2 ring-yellow-500" : ""}`}
            onClick={() => setTipoFiltro("PADRAO")}
          >
            Fora de Padrão
          </button>
        </div>

        <div className="rounded-2xl border border-yellow-200 bg-linear-to-br from-yellow-50 to-amber-50 p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="group">
              <label className="mb-2 flex items-center gap-2 text-sm font-bold text-yellow-900">
                <span>📅</span>
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full rounded-lg border-2 border-yellow-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition-all placeholder-slate-400 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-200"
              />
            </div>

            <div className="group">
              <label className="mb-2 flex items-center gap-2 text-sm font-bold text-yellow-900">
                <span>📅</span>
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full rounded-lg border-2 border-yellow-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition-all placeholder-slate-400 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-200"
              />
            </div>

            <div className="group">
              <label className="mb-2 flex items-center gap-2 text-sm font-bold text-yellow-900">
                <span>🏪</span>
                Loja
              </label>
              <select
                value={lojaId}
                onChange={(e) => setLojaId(e.target.value)}
                className="w-full rounded-lg border-2 border-yellow-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition-all focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-200 disabled:opacity-50"
                disabled={loadingLojas}
              >
                <option value="">Todas as lojas</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.nome}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="group">
              <label className="mb-2 flex items-center gap-2 text-sm font-bold text-yellow-900">
                <span>👤</span>
                Usuário
              </label>
              <select
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value)}
                className="w-full rounded-lg border-2 border-yellow-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm transition-all focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-200 disabled:opacity-50"
                disabled={loadingUsuarios}
              >
                <option value="">Todos os usuários</option>
                {usuarios.map((usr) => (
                  <option key={usr.id} value={usr.nome}>
                    {usr.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {erro && <AlertBox type="error" message={erro} />}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="space-y-4">
          {alertasExibidos.length === 0 ? (
            <AlertBox
              type="success"
              message="Nenhum alerta encontrado para o filtro selecionado!"
            />
          ) : (
            alertasExibidos.map((alerta) => {
              const dataAtual = obterDataMovimentacao(alerta);
              const dataAnterior = obterDataMovimentacao(alerta, "Anterior");
              const usuarioAtual = obterNomeUsuario(alerta);
              const usuarioAnterior = obterNomeUsuario(alerta, "Anterior");
              const selecionado = alertaSelecionado?.id === alerta.id;

              return (
                <div
                  key={alerta.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => abrirDetalhesAlerta(alerta)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      abrirDetalhesAlerta(alerta);
                    }
                  }}
                  className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition-all ${selecionado ? "border-yellow-400 bg-linear-to-br from-yellow-50 to-amber-50 ring-2 ring-yellow-300" : "border-yellow-200 bg-linear-to-br from-yellow-50 to-amber-50 hover:-translate-y-0.5 hover:shadow-md"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 text-2xl text-yellow-600">⚠️</span>
                    <div className="flex-1">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-yellow-800">
                            Máquina:{" "}
                            <button
                              className="underline hover:text-yellow-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                irParaMaquina(alerta.maquinaId);
                              }}
                            >
                              {alerta.maquinaNome || alerta.maquinaId}
                            </button>
                          </p>
                          <p className="text-xs text-yellow-700">
                            Loja:{" "}
                            {alerta.lojaNome ||
                              alerta.loja?.nome ||
                              alerta.loja ||
                              "-"}
                          </p>
                        </div>
                        <button
                          className="rounded bg-red-600 px-3 py-1 text-xs text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                          disabled={removendo}
                          onClick={(event) => {
                            event.stopPropagation();
                            corrigirAlerta(alerta.id, alerta.maquinaId);
                          }}
                          title="Marcar este alerta como corrigido"
                        >
                          {removendo ? "..." : "Corrigido"}
                        </button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-3">
                          {renderizarInfoMovimentacao(
                            {
                              dataMovimentacao: dataAtual,
                              usuario: usuarioAtual,
                              usuarioNome: usuarioAtual,
                            },
                            "",
                            "Movimentação Atual (Usuário)",
                          )}
                          {renderizarInfoMovimentacao(
                            {
                              dataMovimentacao: dataAnterior,
                              usuario: usuarioAnterior,
                              usuarioNome: usuarioAnterior,
                            },
                            "",
                            "Movimentação Anterior",
                          )}
                        </div>

                        <div className="rounded-xl border border-yellow-200 bg-white/80 p-3 shadow-sm">
                          {alerta.tipo === "movimentacao_out" ? (
                            <>
                              <p className="mb-2 text-xs font-bold text-yellow-800">
                                Alerta de Saída (OUT)
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Contador OUT anterior:{" "}
                                <strong>
                                  {alerta.contador_out_anterior ?? "-"}
                                </strong>
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Contador OUT atual:{" "}
                                <strong>{alerta.contador_out ?? "-"}</strong>
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Saída registrada:{" "}
                                <strong>{alerta.sairam ?? "-"}</strong>
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Diferença:{" "}
                                <strong>
                                  {typeof alerta.contador_out === "number" &&
                                  typeof alerta.contador_out_anterior ===
                                    "number" &&
                                  typeof alerta.sairam === "number"
                                    ? alerta.contador_out -
                                      alerta.contador_out_anterior -
                                      alerta.sairam
                                    : "-"}
                                </strong>
                              </p>
                              <p className="mt-2 text-lg font-semibold text-purple-800">
                                {typeof alerta.contador_out === "number" &&
                                typeof alerta.contador_out_anterior ===
                                  "number" &&
                                typeof alerta.sairam === "number"
                                  ? `Era para ter saído ${alerta.contador_out - alerta.contador_out_anterior} mas saiu ${alerta.sairam}`
                                  : "-"}
                              </p>
                            </>
                          ) : alerta.tipo === "movimentacao_in" ? (
                            <>
                              <p className="mb-2 text-xs font-bold text-yellow-800">
                                Alerta de Entrada (IN)
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Contador IN anterior:{" "}
                                <strong>
                                  {alerta.contador_in_anterior ?? "-"}
                                </strong>
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Contador IN atual:{" "}
                                <strong>{alerta.contador_in ?? "-"}</strong>
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Fichas registradas:{" "}
                                <strong>{alerta.fichas ?? "-"}</strong>
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Diferença:{" "}
                                <strong>
                                  {typeof alerta.contador_in === "number" &&
                                  typeof alerta.contador_in_anterior ===
                                    "number" &&
                                  typeof alerta.fichas === "number"
                                    ? alerta.contador_in -
                                      alerta.contador_in_anterior -
                                      alerta.fichas
                                    : "-"}
                                </strong>
                              </p>
                              <p className="mt-2 text-lg font-semibold text-purple-800">
                                {typeof alerta.contador_in === "number" &&
                                typeof alerta.contador_in_anterior ===
                                  "number" &&
                                typeof alerta.fichas === "number"
                                  ? `Era para ter entrado ${alerta.contador_in - alerta.contador_in_anterior} mas entrou ${alerta.fichas}`
                                  : "-"}
                              </p>
                            </>
                          ) : alerta.tipo === "abastecimento_incompleto" ||
                            alerta.foraPadrao === true ? (
                            <>
                              <p className="mb-2 text-xs font-bold text-yellow-800">
                                Alerta de Abastecimento Incompleto
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Capacidade padrão:{" "}
                                <strong>
                                  {alerta.capacidadePadrao ||
                                    alerta.padrao ||
                                    "-"}
                                </strong>{" "}
                                unidades
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Total antes:{" "}
                                <strong>
                                  {alerta.totalAntes || alerta.anterior || "-"}
                                </strong>{" "}
                                → Abasteceu:{" "}
                                <strong>{alerta.abastecido ?? "-"}</strong> →
                                Ficou com:{" "}
                                <strong>{alerta.totalDepois ?? "-"}</strong>
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Observação:{" "}
                                <strong>
                                  {alerta.observacao || "Não informada"}
                                </strong>
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="mb-2 text-xs font-bold text-yellow-800">
                                ⚠️ Inconsistência Detectada
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Contador OUT:{" "}
                                <strong>{alerta.contador_out ?? "-"}</strong> |
                                Contador IN:{" "}
                                <strong>{alerta.contador_in ?? "-"}</strong>
                              </p>
                              <p className="mt-1 text-xs text-yellow-700">
                                Fichas registradas:{" "}
                                <strong>{alerta.fichas ?? "-"}</strong> | Saída
                                registrada:{" "}
                                <strong>{alerta.sairam ?? "-"}</strong>
                              </p>
                            </>
                          )}

                          <p className="mt-3 text-xs font-semibold text-yellow-600">
                            👉 Clique no alerta para abrir os detalhes da
                            máquina.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div>{renderPainelDetalhesMaquina()}</div>
      </div>
    </div>
  );
}
