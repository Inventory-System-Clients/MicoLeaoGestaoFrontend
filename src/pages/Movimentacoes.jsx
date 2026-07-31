import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, Badge, AlertBox } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { filtrarLojasOperacionais } from "../utils/lojas";
import TabelaMovimentacoesEstoqueDeLoja from "../components/TabelaMovimentacoesEstoqueDeLoja";

const formatarDataHora = (dataIso) => {
  if (!dataIso) return "-";
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR");
};

const paraDataISO = (data) => {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

const filtrosFichasPadrao = () => {
  const hoje = new Date();
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(hoje.getDate() - 6);
  return {
    lojaId: "",
    maquinaId: "",
    usuarioId: "",
    tipo: "todos",
    dataInicio: paraDataISO(seteDiasAtras),
    dataFim: paraDataISO(hoje),
  };
};

const filtrosEstoquePadrao = () => {
  const hoje = new Date();
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(hoje.getDate() - 6);
  return {
    lojaId: "",
    usuarioId: "",
    dataInicio: paraDataISO(seteDiasAtras),
    dataFim: paraDataISO(hoje),
  };
};

export function Movimentacoes() {
  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [abaAtiva, setAbaAtiva] = useState("fichas");

  // --- Fichas de máquina ---
  const [filtrosFichas, setFiltrosFichas] = useState(filtrosFichasPadrao);
  const [filtrosFichasAplicados, setFiltrosFichasAplicados] = useState(
    filtrosFichasPadrao,
  );
  const [fichas, setFichas] = useState([]);
  const [carregandoFichas, setCarregandoFichas] = useState(false);
  const [editandoMovimentacao, setEditandoMovimentacao] = useState(null);
  const [formEdicao, setFormEdicao] = useState({
    fichas: "",
    abastecidas: "",
    quantidade_notas_entrada: "",
    valor_entrada_maquininha_pix: "",
  });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // --- Estoque de loja ---
  const [filtrosEstoque, setFiltrosEstoque] = useState(filtrosEstoquePadrao);
  const [filtrosEstoqueAplicados, setFiltrosEstoqueAplicados] = useState(
    filtrosEstoquePadrao,
  );
  const [estoqueMovs, setEstoqueMovs] = useState([]);
  const [carregandoEstoque, setCarregandoEstoque] = useState(false);
  const [editandoEstoqueLoja, setEditandoEstoqueLoja] = useState(null);
  const [salvandoEdicaoEstoque, setSalvandoEdicaoEstoque] = useState(false);

  useEffect(() => {
    const carregarBase = async () => {
      try {
        setLoadingBase(true);
        const [lojasRes, maquinasRes, produtosRes] = await Promise.all([
          api.get("/lojas"),
          api.get("/maquinas"),
          api.get("/produtos"),
        ]);
        setLojas(filtrarLojasOperacionais(lojasRes.data || []));
        setMaquinas(maquinasRes.data || []);
        setProdutos(produtosRes.data || []);
      } catch (err) {
        console.error("Erro ao carregar dados iniciais:", err);
        setError("Erro ao carregar dados iniciais.");
      } finally {
        setLoadingBase(false);
      }
    };
    carregarBase();
  }, []);

  const carregarFichas = useCallback(async (filtros) => {
    try {
      setCarregandoFichas(true);
      setError("");
      const params = { limite: 300 };
      if (filtros.lojaId) params.lojaId = filtros.lojaId;
      if (filtros.maquinaId) params.maquinaId = filtros.maquinaId;
      if (filtros.usuarioId) params.usuarioId = filtros.usuarioId;
      if (filtros.dataInicio) {
        params.dataInicio = `${filtros.dataInicio}T00:00:00.000-03:00`;
      }
      if (filtros.dataFim) {
        params.dataFim = `${filtros.dataFim}T23:59:59.999-03:00`;
      }
      const response = await api.get("/movimentacoes", { params });
      setFichas(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Erro ao carregar histórico de fichas:", err);
      setError("Erro ao carregar histórico de fichas de máquina.");
    } finally {
      setCarregandoFichas(false);
    }
  }, []);

  const carregarEstoque = useCallback(async (filtros) => {
    try {
      setCarregandoEstoque(true);
      setError("");
      const params = { limite: 300 };
      if (filtros.lojaId) params.lojaId = filtros.lojaId;
      if (filtros.usuarioId) params.usuarioId = filtros.usuarioId;
      if (filtros.dataInicio) params.dataInicio = filtros.dataInicio;
      if (filtros.dataFim) params.dataFim = filtros.dataFim;
      const response = await api.get("/movimentacao-estoque-loja", { params });
      setEstoqueMovs(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Erro ao carregar histórico de estoque de loja:", err);
      setError("Erro ao carregar histórico de estoque de loja.");
    } finally {
      setCarregandoEstoque(false);
    }
  }, []);

  useEffect(() => {
    if (abaAtiva === "fichas") carregarFichas(filtrosFichasAplicados);
  }, [abaAtiva, filtrosFichasAplicados, carregarFichas]);

  useEffect(() => {
    if (abaAtiva === "estoque") carregarEstoque(filtrosEstoqueAplicados);
  }, [abaAtiva, filtrosEstoqueAplicados, carregarEstoque]);

  const aplicarFiltrosFichas = (event) => {
    event.preventDefault();
    setFiltrosFichasAplicados({ ...filtrosFichas });
  };

  const limparFiltrosFichas = () => {
    const padrao = filtrosFichasPadrao();
    setFiltrosFichas(padrao);
    setFiltrosFichasAplicados(padrao);
  };

  const aplicarFiltrosEstoque = (event) => {
    event.preventDefault();
    setFiltrosEstoqueAplicados({ ...filtrosEstoque });
  };

  const limparFiltrosEstoque = () => {
    const padrao = filtrosEstoquePadrao();
    setFiltrosEstoque(padrao);
    setFiltrosEstoqueAplicados(padrao);
  };

  const maquinasDaLojaFiltro = useMemo(() => {
    if (!filtrosFichas.lojaId) return maquinas;
    return maquinas.filter((m) => m.lojaId === filtrosFichas.lojaId);
  }, [filtrosFichas.lojaId, maquinas]);

  const opcoesUsuarioFichas = useMemo(() => {
    const mapa = new Map();
    fichas.forEach((mov) => {
      if (mov.usuario?.id) mapa.set(mov.usuario.id, mov.usuario.nome);
    });
    return Array.from(mapa.entries());
  }, [fichas]);

  const opcoesUsuarioEstoque = useMemo(() => {
    const mapa = new Map();
    estoqueMovs.forEach((mov) => {
      if (mov.usuario?.id) mapa.set(mov.usuario.id, mov.usuario.nome);
    });
    return Array.from(mapa.entries());
  }, [estoqueMovs]);

  const fichasFiltradas = useMemo(() => {
    if (filtrosFichasAplicados.tipo === "todos") return fichas;
    return fichas.filter((mov) => {
      const isEntrada = Number(mov.abastecidas || 0) > 0;
      return filtrosFichasAplicados.tipo === "entrada" ? isEntrada : !isEntrada;
    });
  }, [fichas, filtrosFichasAplicados.tipo]);

  const resumoFichas = useMemo(
    () =>
      fichasFiltradas.reduce(
        (acc, mov) => {
          acc.entradas += Number(mov.abastecidas || 0);
          acc.saidas += Number(mov.sairam || 0);
          acc.fichas += Number(mov.fichas || 0);
          return acc;
        },
        { entradas: 0, saidas: 0, fichas: 0 },
      ),
    [fichasFiltradas],
  );

  const iniciarEdicao = (movimentacao) => {
    setEditandoMovimentacao(movimentacao);
    setFormEdicao({
      fichas: movimentacao.fichas || 0,
      abastecidas: movimentacao.abastecidas || 0,
      quantidade_notas_entrada: movimentacao.quantidade_notas_entrada || "",
      valor_entrada_maquininha_pix:
        movimentacao.valor_entrada_maquininha_pix || "",
    });
  };

  const cancelarEdicao = () => {
    setEditandoMovimentacao(null);
  };

  const salvarEdicao = async () => {
    try {
      setSalvandoEdicao(true);
      setError("");
      await api.put(`/movimentacoes/${editandoMovimentacao.id}`, {
        fichas: parseInt(formEdicao.fichas, 10) || 0,
        abastecidas: parseInt(formEdicao.abastecidas, 10) || 0,
        quantidade_notas_entrada:
          formEdicao.quantidade_notas_entrada !== ""
            ? parseFloat(formEdicao.quantidade_notas_entrada)
            : null,
        valor_entrada_maquininha_pix:
          formEdicao.valor_entrada_maquininha_pix !== ""
            ? parseFloat(formEdicao.valor_entrada_maquininha_pix)
            : null,
      });
      setSuccess("Movimentação atualizada com sucesso!");
      cancelarEdicao();
      await carregarFichas(filtrosFichasAplicados);
    } catch (err) {
      console.error("Erro ao atualizar:", err);
      setError("Erro ao atualizar movimentação.");
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const salvarEdicaoLoja = async (event) => {
    event.preventDefault();
    if (!editandoEstoqueLoja) return;

    try {
      setSalvandoEdicaoEstoque(true);
      setError("");
      await api.put(`/movimentacao-estoque-loja/${editandoEstoqueLoja.id}`, {
        lojaId: editandoEstoqueLoja.loja?.id || editandoEstoqueLoja.lojaId,
        usuarioId: editandoEstoqueLoja.usuario?.id || editandoEstoqueLoja.usuarioId,
        produtos: editandoEstoqueLoja.produtosEnviados.map((p) => ({
          produtoId: p.produto?.id || p.produtoId,
          quantidade: Number(p.quantidade),
          tipoMovimentacao: p.tipoMovimentacao || "saida",
        })),
      });
      setSuccess("Movimentação de loja atualizada!");
      setEditandoEstoqueLoja(null);
      await carregarEstoque(filtrosEstoqueAplicados);
    } catch (err) {
      console.error("Erro ao editar:", err);
      setError("Erro ao atualizar movimentação de loja.");
    } finally {
      setSalvandoEdicaoEstoque(false);
    }
  };

  if (loadingBase) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Histórico de Movimentações"
          subtitle="Consulte fichas de máquina e estoque de loja com filtros"
          icon="🔄"
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

        <div className="card">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              {
                key: "fichas",
                title: "Fichas de Máquina",
                subtitle: "Entradas e saídas registradas em cada máquina.",
              },
              {
                key: "estoque",
                title: "Estoque de Loja",
                subtitle: "Produtos enviados/devolvidos entre depósito e lojas.",
              },
            ].map((opcao) => {
              const ativo = abaAtiva === opcao.key;
              return (
                <button
                  key={opcao.key}
                  type="button"
                  onClick={() => setAbaAtiva(opcao.key)}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    ativo
                      ? "border-primary bg-primary text-white shadow-md"
                      : "border-slate-200 bg-white text-gray-900 hover:border-primary/50 hover:bg-orange-50"
                  }`}
                >
                  <span className="block text-sm font-bold">{opcao.title}</span>
                  <span
                    className={`mt-1 block text-xs ${
                      ativo ? "text-white/85" : "text-gray-500"
                    }`}
                  >
                    {opcao.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {abaAtiva === "fichas" && (
          <>
            <section className="card">
              <form
                onSubmit={aplicarFiltrosFichas}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      Loja
                    </label>
                    <select
                      value={filtrosFichas.lojaId}
                      onChange={(e) =>
                        setFiltrosFichas((prev) => ({
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
                      Máquina
                    </label>
                    <select
                      value={filtrosFichas.maquinaId}
                      onChange={(e) =>
                        setFiltrosFichas((prev) => ({
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
                      Usuário
                    </label>
                    <select
                      value={filtrosFichas.usuarioId}
                      onChange={(e) =>
                        setFiltrosFichas((prev) => ({
                          ...prev,
                          usuarioId: e.target.value,
                        }))
                      }
                      className="select-field"
                    >
                      <option value="">Todos</option>
                      {opcoesUsuarioFichas.map(([id, nome]) => (
                        <option key={id} value={id}>
                          {nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      Tipo
                    </label>
                    <select
                      value={filtrosFichas.tipo}
                      onChange={(e) =>
                        setFiltrosFichas((prev) => ({
                          ...prev,
                          tipo: e.target.value,
                        }))
                      }
                      className="select-field"
                    >
                      <option value="todos">Todos</option>
                      <option value="entrada">Entrada</option>
                      <option value="saida">Saída</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      Data início
                    </label>
                    <input
                      type="date"
                      value={filtrosFichas.dataInicio}
                      onChange={(e) =>
                        setFiltrosFichas((prev) => ({
                          ...prev,
                          dataInicio: e.target.value,
                        }))
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                      Data fim
                    </label>
                    <input
                      type="date"
                      value={filtrosFichas.dataFim}
                      onChange={(e) =>
                        setFiltrosFichas((prev) => ({
                          ...prev,
                          dataFim: e.target.value,
                        }))
                      }
                      className="input-field"
                    />
                  </div>
                  <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
                    <button type="submit" className="btn-primary flex-1">
                      Aplicar filtros
                    </button>
                    <button
                      type="button"
                      onClick={limparFiltrosFichas}
                      className="btn-secondary"
                    >
                      Últimos 7 dias
                    </button>
                  </div>
                </div>
              </form>

              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">Registros</p>
                  <p className="text-xl font-bold text-gray-900">
                    {fichasFiltradas.length}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">Entradas</p>
                  <p className="text-xl font-bold text-emerald-600">
                    +{resumoFichas.entradas}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">Saídas</p>
                  <p className="text-xl font-bold text-red-600">
                    -{resumoFichas.saidas}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">Fichas</p>
                  <p className="text-xl font-bold text-blue-600">
                    {resumoFichas.fichas}
                  </p>
                </div>
              </div>
            </section>

            <section className="card">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-gray-900">
                  Fichas de máquina
                </h2>
                {carregandoFichas && (
                  <span className="text-xs text-gray-500">Carregando...</span>
                )}
              </div>

              {fichasFiltradas.length === 0 ? (
                <div className="rounded-lg border border-dashed border-orange-200 p-8 text-center text-sm text-gray-600">
                  {carregandoFichas
                    ? "Carregando movimentações..."
                    : "Nenhuma movimentação encontrada com estes filtros."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th>Data/Hora</th>
                        <th>Usuário</th>
                        <th>Tipo</th>
                        <th>Produto</th>
                        <th>Máquina</th>
                        <th>Saída</th>
                        <th>Entrada</th>
                        <th>Fichas</th>
                        <th>Observação</th>
                        <th className="text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fichasFiltradas.map((mov) => {
                        const isEntrada = Number(mov.abastecidas || 0) > 0;
                        const produtoId = mov.detalhesProdutos?.[0]?.produtoId;
                        const produto = produtos.find((p) => p.id === produtoId);
                        const maquina =
                          mov.maquina || maquinas.find((m) => m.id === mov.maquinaId);
                        const loja = lojas.find((l) => l.id === maquina?.lojaId);

                        return (
                          <tr key={mov.id}>
                            <td>{formatarDataHora(mov.dataColeta || mov.createdAt)}</td>
                            <td>{mov.usuario?.nome || "-"}</td>
                            <td>
                              <Badge variant={isEntrada ? "success" : "danger"} size="sm">
                                {isEntrada ? "Entrada" : "Saída"}
                              </Badge>
                            </td>
                            <td>
                              {produto
                                ? `${produto.emoji ? `${produto.emoji} ` : ""}${produto.nome}`
                                : "-"}
                            </td>
                            <td>
                              {maquina ? (
                                <div>
                                  <p className="font-bold text-gray-900">
                                    {maquina.codigo}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {loja?.nome || "-"}
                                  </p>
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="font-bold text-red-600">
                              {mov.sairam > 0 ? `-${mov.sairam}` : "-"}
                            </td>
                            <td className="font-bold text-emerald-600">
                              {mov.abastecidas > 0 ? `+${mov.abastecidas}` : "-"}
                            </td>
                            <td className="font-bold text-blue-600">
                              {mov.fichas || 0}
                            </td>
                            <td className="text-sm text-gray-600">
                              {mov.observacoes || "-"}
                            </td>
                            <td>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  className="btn-secondary px-3 py-2 text-xs whitespace-nowrap"
                                  onClick={() => iniciarEdicao(mov)}
                                >
                                  Editar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {abaAtiva === "estoque" && (
          <section className="card">
            <form
              onSubmit={aplicarFiltrosEstoque}
              className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Loja
                  </label>
                  <select
                    value={filtrosEstoque.lojaId}
                    onChange={(e) =>
                      setFiltrosEstoque((prev) => ({
                        ...prev,
                        lojaId: e.target.value,
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
                    Responsável
                  </label>
                  <select
                    value={filtrosEstoque.usuarioId}
                    onChange={(e) =>
                      setFiltrosEstoque((prev) => ({
                        ...prev,
                        usuarioId: e.target.value,
                      }))
                    }
                    className="select-field"
                  >
                    <option value="">Todos</option>
                    {opcoesUsuarioEstoque.map(([id, nome]) => (
                      <option key={id} value={id}>
                        {nome}
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
                    value={filtrosEstoque.dataInicio}
                    onChange={(e) =>
                      setFiltrosEstoque((prev) => ({
                        ...prev,
                        dataInicio: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Data fim
                  </label>
                  <input
                    type="date"
                    value={filtrosEstoque.dataFim}
                    onChange={(e) =>
                      setFiltrosEstoque((prev) => ({
                        ...prev,
                        dataFim: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>
                <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                  <button type="submit" className="btn-primary flex-1 sm:flex-none">
                    Aplicar filtros
                  </button>
                  <button
                    type="button"
                    onClick={limparFiltrosEstoque}
                    className="btn-secondary"
                  >
                    Últimos 7 dias
                  </button>
                </div>
              </div>
            </form>

            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                Estoque de loja
              </h2>
              {carregandoEstoque && (
                <span className="text-xs text-gray-500">Carregando...</span>
              )}
            </div>

            <TabelaMovimentacoesEstoqueDeLoja
              movimentacoesEstoqueLoja={estoqueMovs}
              produtos={produtos}
              setEditandoEstoqueLoja={setEditandoEstoqueLoja}
              onChangeEstoqueLoja={() => carregarEstoque(filtrosEstoqueAplicados)}
            />
          </section>
        )}

        {/* Modal de edição de fichas */}
        {editandoMovimentacao && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
              <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900">
                ✏️ Editar Movimentação
              </h3>

              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm text-gray-600">
                    <strong>Data:</strong>{" "}
                    {formatarDataHora(
                      editandoMovimentacao.dataColeta ||
                        editandoMovimentacao.createdAt,
                    )}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    <strong>Máquina:</strong>{" "}
                    {maquinas.find((m) => m.id === editandoMovimentacao.maquinaId)
                      ?.codigo || "N/A"}
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    🎫 Quantidade de Fichas
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formEdicao.fichas}
                    onChange={(e) =>
                      setFormEdicao((prev) => ({
                        ...prev,
                        fichas: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    📦 Quantidade Abastecida
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formEdicao.abastecidas}
                    onChange={(e) =>
                      setFormEdicao((prev) => ({
                        ...prev,
                        abastecidas: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    💵 Quantidade de Notas
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formEdicao.quantidade_notas_entrada}
                    onChange={(e) =>
                      setFormEdicao((prev) => ({
                        ...prev,
                        quantidade_notas_entrada: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    💳 Valor Digital (Pix/Maquininha) (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formEdicao.valor_entrada_maquininha_pix}
                    onChange={(e) =>
                      setFormEdicao((prev) => ({
                        ...prev,
                        valor_entrada_maquininha_pix: e.target.value,
                      }))
                    }
                    className="input-field"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={cancelarEdicao}
                    className="btn-secondary flex-1"
                    disabled={salvandoEdicao}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarEdicao}
                    className="btn-primary flex-1 disabled:opacity-60"
                    disabled={salvandoEdicao}
                  >
                    {salvandoEdicao ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de edição de estoque de loja */}
        {editandoEstoqueLoja && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
              <h3 className="mb-4 text-xl font-bold text-gray-900">
                ✏️ Editar Produtos Enviados
              </h3>
              <form onSubmit={salvarEdicaoLoja}>
                <div className="mb-4 rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">
                    Data: {formatarDataHora(editandoEstoqueLoja.dataMovimentacao)}
                  </p>
                </div>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Produtos Enviados
                  </label>
                  {editandoEstoqueLoja.produtosEnviados &&
                  editandoEstoqueLoja.produtosEnviados.length > 0 ? (
                    <div className="space-y-2">
                      {editandoEstoqueLoja.produtosEnviados.map((prod, idx) => (
                        <Fragment key={prod.id || idx}>
                          <div className="flex items-center gap-2">
                            <span className="min-w-30 text-sm">
                              {prod.produto?.nome || prod.produtoId}
                            </span>
                            <input
                              type="number"
                              min="0"
                              value={prod.quantidade}
                              onChange={(e) => {
                                const novaLista =
                                  editandoEstoqueLoja.produtosEnviados.map((p, i) =>
                                    i === idx
                                      ? { ...p, quantidade: e.target.value }
                                      : p,
                                  );
                                setEditandoEstoqueLoja({
                                  ...editandoEstoqueLoja,
                                  produtosEnviados: novaLista,
                                });
                              }}
                              className="input-field w-24"
                            />
                            <select
                              value={prod.tipoMovimentacao}
                              onChange={(e) => {
                                const novaLista =
                                  editandoEstoqueLoja.produtosEnviados.map((p, i) =>
                                    i === idx
                                      ? { ...p, tipoMovimentacao: e.target.value }
                                      : p,
                                  );
                                setEditandoEstoqueLoja({
                                  ...editandoEstoqueLoja,
                                  produtosEnviados: novaLista,
                                });
                              }}
                              className="select-field w-28"
                            >
                              <option value="entrada">Entrada</option>
                              <option value="saida">Saída</option>
                            </select>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-500">Nenhum produto enviado</span>
                  )}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditandoEstoqueLoja(null)}
                    className="btn-secondary"
                    disabled={salvandoEdicaoEstoque}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary disabled:opacity-60"
                    disabled={salvandoEdicaoEstoque}
                  >
                    {salvandoEdicaoEstoque ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default Movimentacoes;
