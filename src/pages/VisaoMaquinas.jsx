import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { Navbar } from "../components/Navbar";
import { AlertBox, Modal } from "../components/UIComponents";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import { filtrarLojasOperacionais } from "../utils/lojas";
import { confirmar } from "../utils/alerts";
import { pode } from "../utils/perfis";

const statusMaquina = {
  EM_OPERACAO: {
    label: "Em operação",
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-800 border-emerald-200",
    card: "border-emerald-200 bg-emerald-50",
  },
  EM_MANUTENCAO: {
    label: "Em manutenção",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-800 border-amber-200",
    card: "border-amber-200 bg-amber-50",
  },
  PRONTA_PARA_SAIDA: {
    label: "Pronta para saída",
    dot: "bg-blue-500",
    chip: "bg-blue-100 text-blue-800 border-blue-200",
    card: "border-blue-200 bg-blue-50",
  },
  PARADA: {
    label: "Parada",
    dot: "bg-red-500",
    chip: "bg-red-100 text-red-800 border-red-200",
    card: "border-red-200 bg-red-50",
  },
  SEM_LOJA: {
    label: "Depósito",
    dot: "bg-slate-500",
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    card: "border-slate-200 bg-slate-50",
  },
  INATIVA: {
    label: "Inativa",
    dot: "bg-zinc-400",
    chip: "bg-zinc-100 text-zinc-700 border-zinc-200",
    card: "border-zinc-200 bg-zinc-50",
  },
};

const ordemStatus = [
  "EM_OPERACAO",
  "EM_MANUTENCAO",
  "PRONTA_PARA_SAIDA",
  "PARADA",
  "SEM_LOJA",
  "INATIVA",
];

const numero = (valor) => Number(valor || 0);

const formatarData = (valor) => {
  if (!valor) return "Sem movimentação";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Sem movimentação";
  return data.toLocaleDateString("pt-BR");
};

const obterStatusCodigo = (maquina) => {
  if (maquina.ativo === false) return "INATIVA";
  if (!maquina.lojaId) return "SEM_LOJA";
  const status = maquina.statusOperacao || maquina.status_operacao || "EM_OPERACAO";
  return status === "EM_TRANSPORTE" ? "PARADA" : status;
};

// Página de máquinas do sistema (substituiu a antiga lista /maquinas, que agora
// redireciona pra cá). Cadastrar tipo e desativar/excluir vieram de lá.
export function VisaoMaquinas() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  // Acessos (permissoes): sem ajuste vale a regra de perfil de antes
  const regraCadastroMaquinas = ["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_CADASTRO"].includes(
    usuario?.role,
  );
  const podeCriarMaquina = pode(usuario, "maquinas.criar", regraCadastroMaquinas);
  const podeEditarMaquina = pode(usuario, "maquinas.editar", regraCadastroMaquinas);
  const podeExcluirMaquina = pode(usuario, "maquinas.excluir", regraCadastroMaquinas);
  const podeCriarTipoMaquina = pode(usuario, "tiposMaquina.criar", regraCadastroMaquinas);
  const podeVerTransferencias = pode(
    usuario,
    "maquinas.relatorioTransferencias",
    regraCadastroMaquinas,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recarregar, setRecarregar] = useState(0);
  const [modalTipoMaquinaAberto, setModalTipoMaquinaAberto] = useState(false);
  const [formTipoMaquina, setFormTipoMaquina] = useState({
    nome: "",
    capacidadePadrao: "100",
  });
  const [salvandoTipoMaquina, setSalvandoTipoMaquina] = useState(false);
  const [erroTipoMaquina, setErroTipoMaquina] = useState("");
  const [maquinasResumo, setMaquinasResumo] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroLoja, setFiltroLoja] = useState("todas");

  useEffect(() => {
    const carregar = async () => {
      try {
        setLoading(true);
        setError("");
        const [maquinasRes, lojasRes, manutencoesRes] = await Promise.all([
          api.get("/maquinas?incluirInativas=true"),
          api.get("/lojas"),
          api.get("/manutencoes").catch(() => ({ data: [] })),
        ]);

        const maquinas = maquinasRes.data || [];
        const manutencoes = manutencoesRes.data || [];
        setLojas(filtrarLojasOperacionais(lojasRes.data || []));

        const resumos = await Promise.all(
          maquinas.map(async (maquina) => {
            const [estoqueRes, movimentacoesRes] = await Promise.all([
              api.get(`/maquinas/${maquina.id}/estoque`).catch(() => ({ data: null })),
              api
                .get(`/movimentacoes?maquinaId=${maquina.id}&limite=1`)
                .catch(() => ({ data: [] })),
            ]);

            const manutencoesAbertas = manutencoes.filter(
              (item) =>
                String(item.maquinaId) === String(maquina.id) &&
                item.status !== "CONCLUIDA",
            );
            const estoque = estoqueRes.data || {};
            const ultimaMovimentacao = movimentacoesRes.data?.[0] || null;
            const statusCodigo = obterStatusCodigo(maquina);
            const status = statusMaquina[statusCodigo] || statusMaquina.PARADA;

            return {
              maquina,
              statusCodigo,
              status,
              estoqueAtual: numero(estoque.estoqueAtual),
              estoqueMinimo: numero(estoque.estoqueMinimo),
              percentualEstoque: numero(estoque.percentualEstoque),
              alertaEstoqueBaixo: Boolean(estoque.alertaEstoqueBaixo),
              ultimaMovimentacao,
              manutencoesAbertas,
            };
          }),
        );

        setMaquinasResumo(resumos);
      } catch (err) {
        console.error("Erro ao carregar visão das máquinas:", err);
        setError("Não foi possível carregar a visão das máquinas.");
      } finally {
        setLoading(false);
      }
    };

    carregar();
  }, [recarregar]);

  // 1º clique desativa; numa máquina já inativa, exclui de vez (backend decide)
  const handleExcluirMaquina = async (maquina) => {
    const inativa = maquina.ativo === false;
    const confirmado = await confirmar({
      title: inativa ? "Excluir máquina de vez?" : "Desativar máquina?",
      text: inativa
        ? `${maquina.codigo || ""} ${maquina.nome || ""} será excluída permanentemente.`
        : `${maquina.codigo || ""} ${maquina.nome || ""} fica inativa. Para excluir de vez, use o botão de novo depois.`,
      confirmButtonText: inativa ? "Excluir de vez" : "Desativar",
    });
    if (!confirmado) return;

    try {
      const response = await api.delete(`/maquinas/${maquina.id}`);
      setSuccess(
        response.data?.permanentDelete
          ? "✅ Máquina excluída permanentemente."
          : "⚠️ Máquina desativada.",
      );
      setRecarregar((n) => n + 1);
    } catch (err) {
      setError(
        "Erro ao excluir máquina: " + (err.response?.data?.error || err.message),
      );
    }
  };

  const handleChangeTipoMaquina = (e) => {
    const { name, value } = e.target;
    setFormTipoMaquina((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitTipoMaquina = async (e) => {
    e.preventDefault();
    setErroTipoMaquina("");

    if (!formTipoMaquina.nome.trim()) {
      setErroTipoMaquina("Informe o nome do tipo de máquina.");
      return;
    }

    setSalvandoTipoMaquina(true);
    try {
      await api.post("/tipos-maquina", {
        nome: formTipoMaquina.nome.trim(),
        capacidadePadrao: Number(formTipoMaquina.capacidadePadrao) || 100,
      });
      setSuccess("Tipo de máquina cadastrado com sucesso!");
      setModalTipoMaquinaAberto(false);
      setFormTipoMaquina({ nome: "", capacidadePadrao: "100" });
    } catch (err) {
      setErroTipoMaquina(
        err.response?.data?.error || "Erro ao cadastrar tipo de máquina.",
      );
    } finally {
      setSalvandoTipoMaquina(false);
    }
  };

  const totais = useMemo(
    () =>
      maquinasResumo.reduce(
        (acc, item) => {
          acc.total += 1;
          acc[item.statusCodigo] = (acc[item.statusCodigo] || 0) + 1;
          if (item.alertaEstoqueBaixo) acc.alertas += 1;
          acc.manutencoes += item.manutencoesAbertas.length;
          return acc;
        },
        { total: 0, alertas: 0, manutencoes: 0 },
      ),
    [maquinasResumo],
  );

  // Mesmo cálculo da antiga página de máquinas: soma da capacidade padrão
  // das máquinas ativas
  const capacidadeTotal = useMemo(
    () =>
      maquinasResumo
        .filter((item) => item.maquina.ativo !== false)
        .reduce((soma, item) => soma + numero(item.maquina.capacidadePadrao), 0),
    [maquinasResumo],
  );

  const maquinasFiltradas = useMemo(() => {
    const texto = busca.trim().toLowerCase();
    return maquinasResumo.filter((item) => {
      const lojaNome = item.maquina.loja?.nome || "";
      const bateBusca =
        !texto ||
        [item.maquina.codigo, item.maquina.nome, item.maquina.tipo, lojaNome]
          .join(" ")
          .toLowerCase()
          .includes(texto);
      const bateStatus =
        filtroStatus === "todos" || item.statusCodigo === filtroStatus;
      const bateLoja =
        filtroLoja === "todas" ||
        (filtroLoja === "sem-loja" && !item.maquina.lojaId) ||
        String(item.maquina.lojaId) === String(filtroLoja);

      return bateBusca && bateStatus && bateLoja;
    });
  }, [maquinasResumo, busca, filtroStatus, filtroLoja]);

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Visão das Máquinas</h1>
            <p className="mt-2 text-gray-600">
              Situação operacional, estoque, loja atual e pontos de atenção.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {podeVerTransferencias && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate("/relatorios/transferencias-maquinas")}
              >
                🔁 Transferências
              </button>
            )}
            {podeCriarTipoMaquina && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setModalTipoMaquinaAberto(true)}
              >
                Cadastrar tipo de máquina
              </button>
            )}
            {podeCriarMaquina && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigate("/maquinas/nova")}
              >
                Nova máquina
              </button>
            )}
          </div>
        </div>

        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}
        {success && (
          <AlertBox type="success" message={success} onClose={() => setSuccess("")} />
        )}

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg bg-linear-to-br from-zinc-800 to-zinc-950 p-5 text-white shadow-md">
            <p className="text-sm font-semibold opacity-80">Total</p>
            <p className="mt-2 text-3xl font-bold">{totais.total}</p>
            <p className="mt-1 text-xs opacity-75">máquinas cadastradas</p>
          </div>
          <div className="rounded-lg bg-linear-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-md">
            <p className="text-sm font-semibold opacity-80">Em operação</p>
            <p className="mt-2 text-3xl font-bold">{totais.EM_OPERACAO || 0}</p>
            <p className="mt-1 text-xs opacity-75">rodando em loja</p>
          </div>
          <div className="rounded-lg bg-linear-to-br from-amber-500 to-red-600 p-5 text-white shadow-md">
            <p className="text-sm font-semibold opacity-80">Atenção</p>
            <p className="mt-2 text-3xl font-bold">
              {(totais.EM_MANUTENCAO || 0) + (totais.PARADA || 0)}
            </p>
            <p className="mt-1 text-xs opacity-75">manutenção ou parada</p>
          </div>
          <div className="rounded-lg bg-linear-to-br from-blue-500 to-purple-700 p-5 text-white shadow-md">
            <p className="text-sm font-semibold opacity-80">Preparação</p>
            <p className="mt-2 text-3xl font-bold">
              {(totais.PRONTA_PARA_SAIDA || 0) +
                (totais.SEM_LOJA || 0)}
            </p>
            <p className="mt-1 text-xs opacity-75">saída ou no depósito</p>
          </div>
          <div className="rounded-lg bg-linear-to-br from-blue-500 to-blue-700 p-5 text-white shadow-md">
            <p className="text-sm font-semibold opacity-80">Capacidade Total</p>
            <p className="mt-2 text-3xl font-bold">{capacidadeTotal}</p>
            <p className="mt-1 text-xs opacity-75">pelúcias nas máquinas ativas</p>
          </div>
        </section>

        <section className="mb-6 rounded-lg border border-orange-100 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Buscar
              </label>
              <input
                className="input-field"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Código, nome, modelo ou loja..."
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Situação
              </label>
              <select
                className="select-field"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
              >
                <option value="todos">Todas</option>
                {ordemStatus.map((status) => (
                  <option key={status} value={status}>
                    {statusMaquina[status].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Loja
              </label>
              <select
                className="select-field"
                value={filtroLoja}
                onChange={(e) => setFiltroLoja(e.target.value)}
              >
                <option value="todas">Todas</option>
                <option value="sem-loja">Depósito</option>
                {lojas.map((loja) => (
                  <option key={loja.id} value={loja.id}>
                    {loja.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {ordemStatus.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFiltroStatus(status)}
                className={`rounded-full border px-3 py-1 text-sm font-bold ${
                  statusMaquina[status].chip
                }`}
              >
                <span
                  className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${statusMaquina[status].dot}`}
                />
                {statusMaquina[status].label}: {totais[status] || 0}
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {maquinasFiltradas.map((item) => (
            <article
              key={item.maquina.id}
              className={`relative rounded-lg border p-5 shadow-sm ${item.status.card}`}
            >
              <span
                className={`absolute right-4 top-4 h-4 w-4 rounded-full ring-4 ring-white ${item.status.dot}`}
                title={item.status.label}
              />
              <div className="pr-8">
                <p className="text-xs font-bold uppercase text-gray-500">
                  {item.maquina.codigo}
                </p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">
                  {item.maquina.nome || "Máquina sem nome"}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {item.maquina.loja?.nome || "Depósito"}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${item.status.chip}`}>
                  {item.status.label}
                </span>
                {item.manutencoesAbertas.length > 0 && (
                  <span className="rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                    {item.manutencoesAbertas.length} manutenção aberta
                  </span>
                )}
                {item.alertaEstoqueBaixo && (
                  <span className="rounded-full border border-orange-200 bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800">
                    estoque baixo
                  </span>
                )}
              </div>

              {item.statusCodigo === "PARADA" && item.maquina.motivoParada && (
                <p className="mt-2 rounded-lg border border-red-200 bg-red-100 px-3 py-2 text-xs font-semibold text-red-800">
                  ⚠️ {item.maquina.motivoParada}
                </p>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-white/80 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">Estoque</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {item.estoqueAtual} / {item.maquina.capacidadePadrao || 0}
                  </p>
                  <p className="text-xs text-gray-500">
                    mínimo {Math.round(item.estoqueMinimo || 0)}
                  </p>
                </div>
                <div className="rounded-lg bg-white/80 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">Última mov.</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {formatarData(
                      item.ultimaMovimentacao?.dataColeta ||
                        item.ultimaMovimentacao?.createdAt,
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    saiu {numero(item.ultimaMovimentacao?.sairam)}
                  </p>
                </div>
                <div className="rounded-lg bg-white/80 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">Modelo</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {item.maquina.tipo || "-"}
                  </p>
                </div>
                <div className="rounded-lg bg-white/80 p-3">
                  <p className="text-xs font-bold uppercase text-gray-500">Valor ficha</p>
                  <p className="mt-1 font-bold text-gray-900">
                    R$ {Number(item.maquina.valorFicha || 0).toFixed(2)}
                  </p>
                </div>
                {item.maquina.custoAquisicao !== null &&
                  item.maquina.custoAquisicao !== undefined && (
                    <div className="rounded-lg bg-white/80 p-3">
                      <p className="text-xs font-bold uppercase text-gray-500">
                        Custo de aquisição
                      </p>
                      <p className="mt-1 font-bold text-gray-900">
                        R$ {Number(item.maquina.custoAquisicao).toFixed(2)}
                      </p>
                    </div>
                  )}
              </div>

              {item.maquina.localizacao && (
                <p className="mt-4 rounded-lg bg-white/80 p-3 text-sm text-gray-700">
                  {item.maquina.localizacao}
                </p>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => navigate(`/maquinas/${item.maquina.id}`)}
                >
                  Ver histórico
                </button>
                {podeExcluirMaquina && (
                  <button
                    type="button"
                    className="btn-secondary text-sm text-red-600"
                    onClick={() => handleExcluirMaquina(item.maquina)}
                  >
                    {item.maquina.ativo === false ? "Excluir de vez" : "Desativar"}
                  </button>
                )}
                {podeEditarMaquina && (
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    onClick={() => navigate(`/maquinas/${item.maquina.id}/editar`)}
                  >
                    Editar
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>

        {maquinasFiltradas.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-gray-600">
            Nenhuma máquina encontrada com estes filtros.
          </div>
        )}
      </main>

      <Modal
        isOpen={modalTipoMaquinaAberto}
        onClose={() => setModalTipoMaquinaAberto(false)}
        title="🎰 Cadastrar tipo de máquina"
        size="sm"
      >
        <form onSubmit={handleSubmitTipoMaquina} className="space-y-4">
          {erroTipoMaquina && <AlertBox type="error" message={erroTipoMaquina} />}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nome do tipo *
            </label>
            <input
              type="text"
              name="nome"
              value={formTipoMaquina.nome}
              onChange={handleChangeTipoMaquina}
              className="input-field"
              placeholder="Ex: Garra, Poltrona, Takeball..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Capacidade padrão *
            </label>
            <input
              type="number"
              name="capacidadePadrao"
              value={formTipoMaquina.capacidadePadrao}
              onChange={handleChangeTipoMaquina}
              className="input-field"
              min="0"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Vai preencher automaticamente a Capacidade Padrão quando esse
              tipo for escolhido no cadastro/edição de máquina (ainda dá pra
              ajustar depois, por máquina).
            </p>
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setModalTipoMaquinaAberto(false)}
              className="btn-secondary"
              disabled={salvandoTipoMaquina}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={salvandoTipoMaquina}>
              {salvandoTipoMaquina ? "Salvando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </Modal>

      <Footer />
    </div>
  );
}
