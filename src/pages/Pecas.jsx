import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { AlertBox, Badge, PageHeader } from "../components/UIComponents";
import { confirmar } from "../utils/alerts";

const formPecaInicial = {
  codigo: "",
  nome: "",
  descricao: "",
  unidade: "un",
  quantidadeEstoque: "",
  estoqueMinimo: "",
  custoUnitario: "",
};

const formatarDataHora = (dataIso) => {
  if (!dataIso) return "-";
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR");
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const normalizarTexto = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

export default function Pecas() {
  const { usuario, loading: authLoading } = useAuth();
  const isAdmin = ["ADMIN", "DESENVOLVEDOR"].includes(usuario?.role);
  const isFuncionario = usuario?.role === "FUNCIONARIO";

  const [pecas, setPecas] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [envios, setEnvios] = useState([]);
  const [estoquesFuncionarios, setEstoquesFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [formPeca, setFormPeca] = useState(formPecaInicial);
  const [editandoPeca, setEditandoPeca] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState(isFuncionario ? "carrinhos" : "estoque");
  const [filtros, setFiltros] = useState({
    busca: "",
    status: "ativas",
    ordenacao: "nome",
  });

  const [acaoAbertaId, setAcaoAbertaId] = useState(null);
  const [formQuantidade, setFormQuantidade] = useState({ quantidade: "" });
  const [formEnvio, setFormEnvio] = useState({
    funcionarioId: "",
    quantidade: "",
    observacao: "",
  });
  const [formDevolucao, setFormDevolucao] = useState({
    quantidade: "",
    observacao: "",
  });

  const carregarDados = useCallback(async () => {
    try {
      setError("");
      const requisicoesAdmin = isAdmin
        ? [
            api.get("/pecas", { params: { incluirInativas: true } }),
            api.get("/manutencoes/funcionarios"),
            api.get("/pecas/envios"),
            api.get("/pecas/estoque-funcionario"),
          ]
        : [api.get("/pecas/estoque-funcionario")];

      const respostas = await Promise.all(requisicoesAdmin);

      if (!isAdmin) {
        setPecas([]);
        setFuncionarios([]);
        setEnvios([]);
        setEstoquesFuncionarios(Array.isArray(respostas[0].data) ? respostas[0].data : []);
        return;
      }

      const [pecasRes, funcionariosRes, enviosRes, estoquesRes] = respostas;

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
  }, [isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    carregarDados();
  }, [authLoading, carregarDados]);

  useEffect(() => {
    if (isFuncionario) {
      setAbaAtiva("carrinhos");
    }
  }, [isFuncionario]);

  const pecasFiltradas = useMemo(() => {
    const busca = normalizarTexto(filtros.busca);
    const lista = pecas.filter((peca) => {
      const texto = normalizarTexto(
        [peca.codigo, peca.nome, peca.descricao, peca.unidade].join(" "),
      );
      const estoqueBaixo =
        peca.estoqueMinimo !== null &&
        peca.estoqueMinimo !== undefined &&
        Number(peca.quantidadeEstoque || 0) < Number(peca.estoqueMinimo || 0);

      if (filtros.status === "ativas" && peca.ativo === false) return false;
      if (filtros.status === "inativas" && peca.ativo !== false) return false;
      if (filtros.status === "baixo" && !estoqueBaixo) return false;
      if (busca && !texto.includes(busca)) return false;
      return true;
    });

    return [...lista].sort((a, b) => {
      if (filtros.ordenacao === "estoque") {
        return Number(a.quantidadeEstoque || 0) - Number(b.quantidadeEstoque || 0);
      }
      if (filtros.ordenacao === "recentes") {
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      }
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });
  }, [filtros, pecas]);

  const resumo = useMemo(() => {
    const ativas = pecas.filter((peca) => peca.ativo !== false);
    const baixoEstoque = ativas.filter(
      (peca) =>
        peca.estoqueMinimo !== null &&
        peca.estoqueMinimo !== undefined &&
        Number(peca.quantidadeEstoque || 0) < Number(peca.estoqueMinimo || 0),
    );
    const totalCentral = ativas.reduce(
      (acc, peca) => acc + Number(peca.quantidadeEstoque || 0),
      0,
    );
    const totalCarrinhos = estoquesFuncionarios
      .filter((item) => Number(item.quantidade || 0) > 0)
      .reduce((acc, item) => acc + Number(item.quantidade || 0), 0);

    return {
      total: pecas.length,
      ativas: ativas.length,
      baixoEstoque: baixoEstoque.length,
      totalCentral,
      totalCarrinhos,
    };
  }, [estoquesFuncionarios, pecas]);

  const abrirNovaPeca = () => {
    setEditandoPeca(null);
    setFormPeca(formPecaInicial);
    setMostrarFormulario(true);
  };

  const abrirEdicao = (peca) => {
    setEditandoPeca(peca);
    setFormPeca({
      codigo: peca.codigo || "",
      nome: peca.nome || "",
      descricao: peca.descricao || "",
      unidade: peca.unidade || "un",
      quantidadeEstoque: peca.quantidadeEstoque ?? "",
      estoqueMinimo: peca.estoqueMinimo ?? "",
      custoUnitario: peca.custoUnitario ?? "",
    });
    setMostrarFormulario(true);
  };

  const fecharFormulario = () => {
    setEditandoPeca(null);
    setFormPeca(formPecaInicial);
    setMostrarFormulario(false);
  };

  const handleSalvarPeca = async (event) => {
    event.preventDefault();
    if (!formPeca.nome.trim()) {
      setError("Informe o nome da peca.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const payload = {
        codigo: formPeca.codigo.trim() || null,
        nome: formPeca.nome.trim(),
        descricao: formPeca.descricao.trim() || null,
        unidade: "un",
        quantidadeEstoque: Number(formPeca.quantidadeEstoque || 0),
        estoqueMinimo: Number(formPeca.estoqueMinimo || 0),
        custoUnitario: formPeca.custoUnitario || null,
      };

      if (editandoPeca) {
        await api.put(`/pecas/${editandoPeca.id}`, payload);
        setSuccess("Peca atualizada com sucesso.");
      } else {
        await api.post("/pecas", payload);
        setSuccess("Peca cadastrada com sucesso.");
      }

      fecharFormulario();
      await carregarDados();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          (editandoPeca ? "Erro ao atualizar peca" : "Erro ao criar peca"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcluirPeca = async (peca) => {
    const confirmado = await confirmar({
      title: peca.ativo === false ? "Excluir peca definitivamente?" : "Desativar peca?",
      text:
        peca.ativo === false
          ? "Essa peca ja esta inativa e sera removida permanentemente."
          : "A peca fica inativa e pode ser removida definitivamente depois.",
      confirmButtonText: peca.ativo === false ? "Excluir" : "Desativar",
    });

    if (!confirmado) return;

    try {
      setError("");
      setSuccess("");
      const response = await api.delete(`/pecas/${peca.id}`);
      setSuccess(response.data?.message || "Peca removida com sucesso.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao excluir peca");
    }
  };

  const abrirAcao = (pecaId, tipo) => {
    const chave = `${tipo}:${pecaId}`;
    setAcaoAbertaId((atual) => (atual === chave ? null : chave));
    setFormQuantidade({ quantidade: "" });
    setFormEnvio({ funcionarioId: "", quantidade: "", observacao: "" });
    setFormDevolucao({ quantidade: "", observacao: "" });
  };

  const handleLancarQuantidade = async (event, pecaId) => {
    event.preventDefault();
    const quantidadeNumerica = Number(formQuantidade.quantidade);
    if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
      setError("Informe uma quantidade valida (inteiro maior que zero).");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");
      await api.post(`/pecas/${pecaId}/lancar-quantidade`, {
        quantidade: quantidadeNumerica,
      });
      setAcaoAbertaId(null);
      setSuccess("Quantidade adicionada ao estoque central.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao lancar quantidade");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnviarPeca = async (event, pecaId) => {
    event.preventDefault();
    const quantidadeNumerica = Number(formEnvio.quantidade);
    if (!formEnvio.funcionarioId) {
      setError("Selecione o funcionario.");
      return;
    }
    if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
      setError("Informe uma quantidade valida (inteiro maior que zero).");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");
      await api.post(`/pecas/${pecaId}/enviar`, {
        funcionarioId: formEnvio.funcionarioId,
        quantidade: quantidadeNumerica,
        observacao: formEnvio.observacao || null,
      });
      setAcaoAbertaId(null);
      setSuccess("Peca enviada para o carrinho do funcionario.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao enviar peca para funcionario");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDevolverPeca = async (event, item) => {
    event.preventDefault();
    const quantidadeNumerica = Number(formDevolucao.quantidade);
    if (!Number.isInteger(quantidadeNumerica) || quantidadeNumerica <= 0) {
      setError("Informe uma quantidade valida (inteiro maior que zero).");
      return;
    }
    if (quantidadeNumerica > Number(item.quantidade || 0)) {
      setError("Voce nao tem essa quantidade para devolver.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");
      await api.post(`/pecas/${item.peca?.id}/devolver`, {
        quantidade: quantidadeNumerica,
        observacao: formDevolucao.observacao || null,
      });
      setAcaoAbertaId(null);
      setSuccess("Peca devolvida para o estoque central.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao devolver peca");
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

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Pecas"
          subtitle={`Usuario: ${usuario?.nome || "-"} (${usuario?.role || "-"})`}
          icon="🧰"
          action={
            isAdmin
              ? {
                  label: "+ Nova Peca",
                  onClick: abrirNovaPeca,
                }
              : undefined
          }
        />

        {error && (
          <AlertBox type="error" message={error} onClose={() => setError("")} />
        )}
        {success && (
          <AlertBox type="success" message={success} onClose={() => setSuccess("")} />
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {(isAdmin
            ? [
                ["Pecas cadastradas", resumo.total],
                ["Ativas", resumo.ativas],
                ["Estoque baixo", resumo.baixoEstoque],
                ["No deposito", resumo.totalCentral],
                ["Com funcionarios", resumo.totalCarrinhos],
              ]
            : [
                [
                  "Tipos comigo",
                  estoquesFuncionarios.filter((item) => Number(item.quantidade || 0) > 0)
                    .length,
                ],
                ["Pecas comigo", resumo.totalCarrinhos],
                ["Devolver", "Livre"],
              ]
          ).map(([label, value], index) => (
            <div
              key={label}
              className={`rounded-lg border p-4 shadow-sm ${
                index === 2 && value > 0
                  ? "border-red-200 bg-red-50"
                  : "border-orange-100 bg-white"
              }`}
            >
              <p className="text-xs font-bold uppercase text-gray-500">{label}</p>
              <p className="mt-1 text-2xl font-black text-gray-900">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-orange-100 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {(isAdmin
              ? [
                  ["estoque", "Estoque de pecas", "Cadastrar, editar e enviar"],
                  ["carrinhos", "Carrinhos", "Pecas com funcionarios"],
                  ["envios", "Envios recentes", "Ultimas movimentacoes"],
                ]
              : [["carrinhos", "Meu estoque de pecas", "Pecas que estao comigo"]]
            ).map(([key, title, subtitle]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAbaAtiva(key)}
                className={`rounded-lg border p-4 text-left transition ${
                  abaAtiva === key
                    ? "border-orange-500 bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-md"
                    : "border-gray-200 bg-white text-gray-900 hover:border-orange-300 hover:bg-orange-50"
                }`}
              >
                <span className="block text-sm font-black">{title}</span>
                <span
                  className={`mt-1 block text-xs ${
                    abaAtiva === key ? "text-white/85" : "text-gray-500"
                  }`}
                >
                  {subtitle}
                </span>
              </button>
            ))}
          </div>
        </section>

        {isAdmin && mostrarFormulario && (
          <section className="card-gradient">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-gray-900">
                  {editandoPeca ? "Editar peca" : "Cadastrar nova peca"}
                </h2>
                <p className="text-sm text-gray-600">
                  Controle o cadastro base do estoque central de manutencao.
                </p>
              </div>
              <button type="button" onClick={fecharFormulario} className="btn-secondary">
                Fechar
              </button>
            </div>

            <form onSubmit={handleSalvarPeca} className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Codigo
                </label>
                <input
                  value={formPeca.codigo}
                  onChange={(e) =>
                    setFormPeca((prev) => ({ ...prev, codigo: e.target.value }))
                  }
                  className="input-field"
                  placeholder="PC-001"
                />
              </div>
              <div className="lg:col-span-4">
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Nome *
                </label>
                <input
                  value={formPeca.nome}
                  onChange={(e) =>
                    setFormPeca((prev) => ({ ...prev, nome: e.target.value }))
                  }
                  className="input-field"
                  placeholder="Ex: Bobina fina"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Unidade
                </label>
                <input
                  value="un"
                  disabled
                  className="input-field cursor-not-allowed bg-gray-100 text-gray-500"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Quantidade inicial
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formPeca.quantidadeEstoque}
                  onChange={(e) =>
                    setFormPeca((prev) => ({
                      ...prev,
                      quantidadeEstoque: e.target.value,
                    }))
                  }
                  className="input-field"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Estoque minimo
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formPeca.estoqueMinimo}
                  onChange={(e) =>
                    setFormPeca((prev) => ({
                      ...prev,
                      estoqueMinimo: e.target.value,
                    }))
                  }
                  className="input-field"
                />
              </div>
              <div className="lg:col-span-3">
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Custo unitario
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formPeca.custoUnitario}
                  onChange={(e) =>
                    setFormPeca((prev) => ({
                      ...prev,
                      custoUnitario: e.target.value,
                    }))
                  }
                  className="input-field"
                  placeholder="0,00"
                />
              </div>
              <div className="lg:col-span-9">
                <label className="mb-1 block text-sm font-bold text-gray-700">
                  Descricao
                </label>
                <input
                  value={formPeca.descricao}
                  onChange={(e) =>
                    setFormPeca((prev) => ({ ...prev, descricao: e.target.value }))
                  }
                  className="input-field"
                  placeholder="Ex: usada na garra, carrinho, fonte..."
                />
              </div>
              <div className="flex justify-end gap-3 lg:col-span-12">
                <button type="button" onClick={fecharFormulario} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
                  {submitting ? "Salvando..." : editandoPeca ? "Salvar alteracoes" : "Cadastrar peca"}
                </button>
              </div>
            </form>
          </section>
        )}

        {isAdmin && abaAtiva === "estoque" && (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="card">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-gray-900">
                    Estoque central
                  </h2>
                  <p className="text-sm text-gray-500">
                    Gerencie pecas, saldo do deposito e envio para funcionarios.
                  </p>
                </div>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                  {pecasFiltradas.length} resultados
                </span>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Buscar
                  </label>
                  <input
                    value={filtros.busca}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, busca: e.target.value }))
                    }
                    className="input-field"
                    placeholder="Nome, codigo ou descricao"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Status
                  </label>
                  <select
                    value={filtros.status}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, status: e.target.value }))
                    }
                    className="select-field"
                  >
                    <option value="ativas">Ativas</option>
                    <option value="baixo">Estoque baixo</option>
                    <option value="todos">Todas</option>
                    <option value="inativas">Inativas</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-gray-500">
                    Ordenar
                  </label>
                  <select
                    value={filtros.ordenacao}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, ordenacao: e.target.value }))
                    }
                    className="select-field"
                  >
                    <option value="nome">Nome</option>
                    <option value="estoque">Menor estoque</option>
                    <option value="recentes">Atualizadas</option>
                  </select>
                </div>
              </div>

              {pecasFiltradas.length === 0 ? (
                <div className="rounded-lg border border-dashed border-orange-200 p-8 text-center text-sm text-gray-600">
                  Nenhuma peca encontrada com estes filtros.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th>Peca</th>
                        <th>Estoque</th>
                        <th>Minimo</th>
                        <th>Custo</th>
                        <th className="text-right">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pecasFiltradas.map((peca) => {
                        const estoqueBaixo =
                          peca.estoqueMinimo !== null &&
                          peca.estoqueMinimo !== undefined &&
                          Number(peca.quantidadeEstoque || 0) <
                            Number(peca.estoqueMinimo || 0);
                        const chaveQuantidade = `quantidade:${peca.id}`;
                        const chaveEnvio = `envio:${peca.id}`;

                        const acaoAberta =
                          acaoAbertaId === chaveQuantidade
                            ? "quantidade"
                            : acaoAbertaId === chaveEnvio
                              ? "envio"
                              : null;

                        return (
                          <Fragment key={peca.id}>
                          <tr>
                            <td className="whitespace-normal">
                              <div className="min-w-40 max-w-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-black text-gray-900">
                                    {peca.nome}
                                  </p>
                                  {peca.ativo === false && (
                                    <Badge variant="danger" size="sm">
                                      Inativa
                                    </Badge>
                                  )}
                                  {estoqueBaixo && (
                                    <Badge variant="danger" size="sm">
                                      Baixo
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500">
                                  {peca.codigo || "Sem codigo"}
                                  {peca.descricao ? ` - ${peca.descricao}` : ""}
                                </p>
                              </div>
                            </td>
                            <td>
                              <span className="text-base font-black text-emerald-700">
                                {peca.quantidadeEstoque || 0}
                              </span>{" "}
                              <span className="text-xs text-gray-500">
                                {peca.unidade || "un"}
                              </span>
                            </td>
                            <td>{peca.estoqueMinimo ?? 0}</td>
                            <td>
                              {peca.custoUnitario
                                ? moeda.format(Number(peca.custoUnitario))
                                : "-"}
                            </td>
                            <td>
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  className="btn-secondary px-3 py-2 text-xs whitespace-nowrap"
                                  onClick={() => abrirAcao(peca.id, "quantidade")}
                                >
                                  {acaoAberta === "quantidade" ? "Cancelar" : "+ Estoque"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary px-3 py-2 text-xs whitespace-nowrap"
                                  onClick={() => abrirAcao(peca.id, "envio")}
                                  disabled={peca.ativo === false}
                                >
                                  {acaoAberta === "envio" ? "Cancelar" : "Carrinho"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary px-3 py-2 text-xs whitespace-nowrap"
                                  onClick={() => abrirEdicao(peca)}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="btn-danger px-3 py-2 text-xs whitespace-nowrap"
                                  onClick={() => handleExcluirPeca(peca)}
                                >
                                  Excluir
                                </button>
                              </div>
                            </td>
                          </tr>

                          {acaoAberta && (
                            <tr>
                              <td colSpan={5} className="bg-orange-50/60 p-0">
                                {acaoAberta === "quantidade" && (
                                  <form
                                    onSubmit={(e) => handleLancarQuantidade(e, peca.id)}
                                    className="flex flex-wrap items-end gap-3 p-4"
                                  >
                                    <div>
                                      <label className="mb-1 block text-xs font-bold text-gray-700">
                                        Adicionar ao deposito
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        autoFocus
                                        value={formQuantidade.quantidade}
                                        onChange={(e) =>
                                          setFormQuantidade({ quantidade: e.target.value })
                                        }
                                        className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                                      />
                                    </div>
                                    <button
                                      type="submit"
                                      disabled={submitting}
                                      className="btn-primary px-4 py-2 text-xs disabled:opacity-60"
                                    >
                                      Confirmar
                                    </button>
                                  </form>
                                )}

                                {acaoAberta === "envio" && (
                                  <form
                                    onSubmit={(e) => handleEnviarPeca(e, peca.id)}
                                    className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1fr_100px_1fr_auto]"
                                  >
                                    <select
                                      value={formEnvio.funcionarioId}
                                      onChange={(e) =>
                                        setFormEnvio((prev) => ({
                                          ...prev,
                                          funcionarioId: e.target.value,
                                        }))
                                      }
                                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                                    >
                                      <option value="">Funcionario...</option>
                                      {funcionarios.map((funcionario) => (
                                        <option key={funcionario.id} value={funcionario.id}>
                                          {funcionario.nome}
                                        </option>
                                      ))}
                                    </select>
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
                                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                                      placeholder="Qtd"
                                    />
                                    <input
                                      value={formEnvio.observacao}
                                      onChange={(e) =>
                                        setFormEnvio((prev) => ({
                                          ...prev,
                                          observacao: e.target.value,
                                        }))
                                      }
                                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                                      placeholder="Obs."
                                    />
                                    <button
                                      type="submit"
                                      disabled={submitting}
                                      className="btn-primary px-4 py-2 text-xs disabled:opacity-60"
                                    >
                                      Enviar
                                    </button>
                                  </form>
                                )}
                              </td>
                            </tr>
                          )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <aside className="space-y-5">
              <div className="card">
                <h2 className="mb-3 text-base font-black text-gray-900">
                  Atalhos do estoque
                </h2>
                <div className="space-y-2 text-sm">
                  <button
                    type="button"
                    className="w-full rounded-lg border border-orange-200 bg-orange-50 px-3 py-3 text-left font-bold text-orange-800"
                    onClick={() => setFiltros((prev) => ({ ...prev, status: "baixo" }))}
                  >
                    Ver pecas com estoque baixo
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-left font-bold text-slate-700"
                    onClick={() => setAbaAtiva("carrinhos")}
                  >
                    Conferir carrinhos dos funcionarios
                  </button>
                </div>
              </div>

              <div className="card">
                <h2 className="mb-3 text-base font-black text-gray-900">
                  Ultimas movimentacoes
                </h2>
                {envios.length === 0 ? (
                  <p className="text-sm text-gray-600">Nenhum envio registrado.</p>
                ) : (
                  <div className="space-y-3">
                    {envios.slice(0, 5).map((envio) => {
                      const devolucao = Number(envio.quantidade || 0) < 0;
                      return (
                      <div key={envio.id} className="rounded-lg border border-gray-100 p-3">
                        <span
                          className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                            devolucao
                              ? "bg-blue-50 text-blue-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {devolucao ? "Devolucao" : "Envio"}
                        </span>
                        <p className="text-sm font-bold text-gray-900">
                          {envio.peca?.nome || "-"}
                        </p>
                        <p className="text-xs text-gray-600">
                          {Math.abs(Number(envio.quantidade || 0))}{" "}
                          {envio.peca?.unidade || "un"}{" "}
                          {devolucao ? "devolvida por" : "para"}{" "}
                          {envio.funcionario?.nome || "-"}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {formatarDataHora(envio.dataEnvio)}
                        </p>
                      </div>
                    );
                    })}
                  </div>
                )}
              </div>
            </aside>
          </section>
        )}

        {abaAtiva === "carrinhos" && (
          <section className="card">
            <div className="mb-4">
              <h2 className="text-lg font-black text-gray-900">
                {isFuncionario ? "Meu estoque de pecas" : "Carrinhos dos funcionarios"}
              </h2>
              <p className="text-sm text-gray-500">
                {isFuncionario
                  ? "Pecas que estao com voce para usar nas manutencoes."
                  : "Pecas que sairam do deposito e estao com cada funcionario."}
              </p>
            </div>

            {estoquesFuncionarios.filter((item) => Number(item.quantidade || 0) > 0)
              .length === 0 ? (
              <div className="rounded-lg border border-dashed border-orange-200 p-8 text-center text-sm text-gray-600">
                Nenhum funcionario com pecas em estoque.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {estoquesFuncionarios
                  .filter((item) => Number(item.quantidade || 0) > 0)
                  .map((item) => (
                    <article
                      key={item.id}
                      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-gray-900">
                            {item.funcionario?.nome || "-"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.peca?.codigo || "Sem codigo"}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">
                          {item.quantidade} {item.peca?.unidade || "un"}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-800">
                        {item.peca?.nome}
                      </p>
                      {isFuncionario && (
                        <div className="mt-3">
                          <button
                            type="button"
                            className="btn-secondary px-4 py-2 text-xs"
                            onClick={() => abrirAcao(item.id, "devolver")}
                          >
                            {acaoAbertaId === `devolver:${item.id}`
                              ? "Cancelar"
                              : "Devolver peca"}
                          </button>

                          {acaoAbertaId === `devolver:${item.id}` && (
                            <form
                              onSubmit={(event) => handleDevolverPeca(event, item)}
                              className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-orange-100 bg-orange-50 p-3 sm:grid-cols-[120px_1fr_auto]"
                            >
                              <input
                                type="number"
                                min="1"
                                max={item.quantidade}
                                step="1"
                                value={formDevolucao.quantidade}
                                onChange={(e) =>
                                  setFormDevolucao((prev) => ({
                                    ...prev,
                                    quantidade: e.target.value,
                                  }))
                                }
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                                placeholder="Qtd"
                              />
                              <input
                                value={formDevolucao.observacao}
                                onChange={(e) =>
                                  setFormDevolucao((prev) => ({
                                    ...prev,
                                    observacao: e.target.value,
                                  }))
                                }
                                className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                                placeholder="Observacao"
                              />
                              <button
                                type="submit"
                                disabled={submitting}
                                className="btn-primary px-4 py-2 text-xs disabled:opacity-60"
                              >
                                Devolver
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
              </div>
            )}
          </section>
        )}

        {isAdmin && abaAtiva === "envios" && (
          <section className="card">
            <div className="mb-4">
              <h2 className="text-lg font-black text-gray-900">
                Historico de movimentacoes
              </h2>
              <p className="text-sm text-gray-500">
                Envios do deposito e devolucoes feitas pelos funcionarios.
              </p>
            </div>

            {envios.length === 0 ? (
              <div className="rounded-lg border border-dashed border-orange-200 p-8 text-center text-sm text-gray-600">
                Nenhum envio registrado.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Peca</th>
                      <th>Funcionario</th>
                      <th>Quantidade</th>
                      <th>Enviado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {envios.map((envio) => {
                      const devolucao = Number(envio.quantidade || 0) < 0;
                      return (
                        <tr key={envio.id}>
                          <td>{formatarDataHora(envio.dataEnvio)}</td>
                          <td>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-bold ${
                                devolucao
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {devolucao ? "Devolucao" : "Envio"}
                            </span>
                          </td>
                          <td>{envio.peca?.nome || "-"}</td>
                          <td>{envio.funcionario?.nome || "-"}</td>
                          <td>
                            {Math.abs(Number(envio.quantidade || 0))}{" "}
                            {envio.peca?.unidade || "un"}
                          </td>
                          <td>{envio.enviadoPor?.nome || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
