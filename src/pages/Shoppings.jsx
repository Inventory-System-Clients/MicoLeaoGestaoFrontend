import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { AlertBox, Modal } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";
import { pode } from "../utils/perfis";
import { confirmar } from "../utils/alerts";

// Visão dos Shoppings (Cadastros > Shoppings), no mesmo jeito das Visões de
// Lojas e Máquinas: números no topo, busca e um cartão por shopping com as
// lojas e máquinas avulsas dele. A loja escolhe o shopping no cadastro dela;
// a máquina avulsa é um ponto (Loja tipo AVULSA) de uma máquina só.

const VAZIO = { nome: "", endereco: "", cidade: "", estado: "", observacoes: "" };
const ESTADOS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const erroDe = (error, padrao) => error?.response?.data?.error || padrao;
const normalizar = (texto) =>
  String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function FormShopping({ shopping, onFechar, onSalvo }) {
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setErro("");
    setForm(shopping?.id ? Object.fromEntries(Object.keys(VAZIO).map((c) => [c, shopping[c] || ""])) : VAZIO);
  }, [shopping]);

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const salvar = async (evento) => {
    evento.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      if (shopping?.id) await api.put(`/shoppings/${shopping.id}`, form);
      else await api.post("/shoppings", form);
      onSalvo(shopping?.id ? "Shopping atualizado." : "Shopping cadastrado.");
    } catch (error) {
      setErro(erroDe(error, "Erro ao salvar o shopping."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen={Boolean(shopping)} onClose={() => !salvando && onFechar()} title={shopping?.id ? "Editar shopping" : "Novo shopping"} size="md">
      <form onSubmit={salvar} className="space-y-4 text-left">
        <label className="block text-sm font-semibold text-gray-700">
          Nome *
          <input className="input-field mt-1" required maxLength={120} value={form.nome} onChange={(e) => mudar("nome", e.target.value)} placeholder="Ex.: Shopping Center Norte" />
        </label>
        <label className="block text-sm font-semibold text-gray-700">
          Endereço
          <input className="input-field mt-1" maxLength={255} value={form.endereco} onChange={(e) => mudar("endereco", e.target.value)} />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-2 block text-sm font-semibold text-gray-700">
            Cidade
            <input className="input-field mt-1" maxLength={100} value={form.cidade} onChange={(e) => mudar("cidade", e.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-gray-700">
            Estado
            <select className="select-field mt-1" value={form.estado} onChange={(e) => mudar("estado", e.target.value)}>
              <option value="">—</option>
              {ESTADOS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm font-semibold text-gray-700">
          Observações
          <textarea className="input-field mt-1" rows={2} value={form.observacoes} onChange={(e) => mudar("observacoes", e.target.value)} />
        </label>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}

// Resumo de um shopping a partir dos pontos (lojas e avulsas) dele
const resumir = (shopping) => {
  const pontos = (shopping.lojas || []).filter((loja) => loja.ativo !== false);
  const lojas = pontos.filter((loja) => loja.tipo !== "AVULSA");
  const avulsas = pontos.filter((loja) => loja.tipo === "AVULSA");
  const maquinasAtivas = (loja) => (loja.maquinas || []).filter((m) => m.ativo !== false);
  const maquinas = pontos.reduce((total, loja) => total + maquinasAtivas(loja).length, 0);
  const paradas = pontos.reduce(
    (total, loja) => total + maquinasAtivas(loja).filter((m) => m.statusOperacao && m.statusOperacao !== "EM_OPERACAO").length,
    0,
  );
  const avulsasSemMaquina = avulsas.filter((loja) => maquinasAtivas(loja).length === 0).length;
  const semEstoque = pontos.filter((loja) => loja.estoqueLojaId).length;
  return { pontos, lojas, avulsas, maquinas, paradas, avulsasSemMaquina, semEstoque, maquinasAtivas };
};

export function Shoppings() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const regraCadastro = ["ADMIN", "FUNCIONARIO_CADASTRO"].includes(usuario?.role);
  const podeGerenciar = pode(usuario, "shoppings.gerenciar", regraCadastro);
  const podeCriarLoja = pode(usuario, "lojas.criar", regraCadastro);

  const [shoppings, setShoppings] = useState(null);
  const [verInativos, setVerInativos] = useState(false);
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const carregar = () =>
    api
      .get("/shoppings", { params: verInativos ? { inativos: "true" } : {} })
      .then(({ data }) => setShoppings(Array.isArray(data) ? data : []))
      .catch((error) => {
        setErro(erroDe(error, "Erro ao carregar os shoppings."));
        setShoppings([]);
      });

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verInativos]);

  const resumos = useMemo(
    () => (shoppings || []).map((shopping) => ({ shopping, ...resumir(shopping) })),
    [shoppings],
  );

  const totais = useMemo(
    () =>
      resumos.reduce(
        (acc, item) => ({
          shoppings: acc.shoppings + (item.shopping.ativo ? 1 : 0),
          lojas: acc.lojas + item.lojas.length,
          avulsas: acc.avulsas + item.avulsas.length,
          maquinas: acc.maquinas + item.maquinas,
          atencao: acc.atencao + item.paradas + item.avulsasSemMaquina,
        }),
        { shoppings: 0, lojas: 0, avulsas: 0, maquinas: 0, atencao: 0 },
      ),
    [resumos],
  );

  // Busca pelo shopping, cidade, loja/avulsa ou código de máquina
  const filtrados = useMemo(() => {
    const texto = normalizar(busca.trim());
    if (!texto) return resumos;
    return resumos.filter(
      ({ shopping, pontos }) =>
        normalizar(shopping.nome).includes(texto) ||
        normalizar(shopping.cidade).includes(texto) ||
        pontos.some(
          (loja) =>
            normalizar(loja.nome).includes(texto) ||
            (loja.maquinas || []).some((m) => normalizar(m.codigo).includes(texto)),
        ),
    );
  }, [busca, resumos]);

  const excluir = async (shopping) => {
    const confirmado = await confirmar({
      title: shopping.ativo ? "Desativar shopping?" : "Excluir shopping de vez?",
      text: shopping.ativo
        ? `"${shopping.nome}" sai da lista. As lojas e máquinas dele não mudam.`
        : `"${shopping.nome}" será excluído. Só dá certo se não tiver mais lojas nem máquinas avulsas dentro.`,
      confirmButtonText: shopping.ativo ? "Desativar" : "Excluir de vez",
    });
    if (!confirmado) return;
    try {
      const { data } = await api.delete(`/shoppings/${shopping.id}`);
      setAviso(data?.message || "Pronto.");
      carregar();
    } catch (error) {
      setErro(erroDe(error, "Erro ao excluir o shopping."));
    }
  };

  const reativar = async (shopping) => {
    try {
      await api.put(`/shoppings/${shopping.id}`, { ativo: true });
      setAviso("Shopping reativado.");
      carregar();
    } catch (error) {
      setErro(erroDe(error, "Erro ao reativar o shopping."));
    }
  };

  if (shoppings === null) return <PageLoader message="Carregando shoppings..." />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Visão dos Shoppings</h1>
            <p className="mt-2 text-gray-600">Lojas e máquinas avulsas de cada shopping.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => navigate("/visao-lojas")}>
              🏪 Visão das Lojas
            </button>
            {podeGerenciar && (
              <button type="button" className="btn-primary" onClick={() => setEditando({})}>
                Novo shopping
              </button>
            )}
          </div>
        </div>

        {erro && <AlertBox type="error" message={erro} onClose={() => setErro("")} />}
        {aviso && <AlertBox type="success" message={aviso} onClose={() => setAviso("")} />}

        <section className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="rounded-lg bg-linear-to-br from-zinc-800 to-zinc-950 p-5 text-white shadow-md">
            <p className="text-sm font-semibold opacity-80">Shoppings</p>
            <p className="mt-2 text-3xl font-bold">{totais.shoppings}</p>
            <p className="mt-1 text-xs opacity-75">ativos</p>
          </div>
          <div className="rounded-lg bg-linear-to-br from-orange-500 to-red-600 p-5 text-white shadow-md">
            <p className="text-sm font-semibold opacity-80">Lojas</p>
            <p className="mt-2 text-3xl font-bold">{totais.lojas}</p>
            <p className="mt-1 text-xs opacity-75">dentro de shopping</p>
          </div>
          <div className="rounded-lg bg-linear-to-br from-blue-500 to-blue-700 p-5 text-white shadow-md">
            <p className="text-sm font-semibold opacity-80">Máquinas avulsas</p>
            <p className="mt-2 text-3xl font-bold">{totais.avulsas}</p>
            <p className="mt-1 text-xs opacity-75">soltas no shopping</p>
          </div>
          <div className="rounded-lg bg-linear-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-md">
            <p className="text-sm font-semibold opacity-80">Máquinas</p>
            <p className="mt-2 text-3xl font-bold">{totais.maquinas}</p>
            <p className="mt-1 text-xs opacity-75">nas lojas e avulsas</p>
          </div>
          <div className="col-span-2 rounded-lg bg-linear-to-br from-amber-500 to-red-600 p-5 text-white shadow-md lg:col-span-1">
            <p className="text-sm font-semibold opacity-80">Atenção</p>
            <p className="mt-2 text-3xl font-bold">{totais.atencao}</p>
            <p className="mt-1 text-xs opacity-75">máquina parada ou avulsa sem máquina</p>
          </div>
        </section>

        <section className="mb-6 rounded-lg border border-orange-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input
              className="input-field md:max-w-md"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar shopping, cidade, loja ou código de máquina..."
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} />
              Mostrar desativados
            </label>
          </div>
        </section>

        {filtrados.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-gray-600">
            {shoppings.length === 0 ? "Nenhum shopping cadastrado." : "Nenhum shopping encontrado."}
          </div>
        )}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {filtrados.map((item) => {
            const { shopping } = item;
            const atencao = item.paradas + item.avulsasSemMaquina;
            return (
              <article
                key={shopping.id}
                className={`rounded-lg border bg-white p-5 shadow-sm ${
                  !shopping.ativo ? "border-gray-200 opacity-70" : atencao ? "border-amber-300" : "border-emerald-200"
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-900">🏬 {shopping.nome}</h2>
                    <p className="text-sm text-gray-500">
                      {[shopping.endereco, [shopping.cidade, shopping.estado].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "Sem endereço"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${
                      !shopping.ativo
                        ? "border-slate-200 bg-slate-100 text-slate-700"
                        : atencao
                          ? "border-amber-200 bg-amber-100 text-amber-800"
                          : "border-emerald-200 bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {!shopping.ativo ? "Desativado" : atencao ? "Com atenção" : "Em ordem"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Lojas", item.lojas.length],
                    ["Avulsas", item.avulsas.length],
                    ["Máquinas", item.maquinas],
                    ["Sem estoque próprio", item.semEstoque],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-gray-500">{rotulo}</p>
                      <p className="text-2xl font-bold">{valor}</p>
                    </div>
                  ))}
                </div>

                {atencao > 0 && (
                  <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                    {item.paradas > 0 && <p>• {item.paradas} máquina(s) fora de operação</p>}
                    {item.avulsasSemMaquina > 0 && <p>• {item.avulsasSemMaquina} máquina(s) avulsa(s) sem máquina cadastrada</p>}
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-xs font-bold uppercase text-gray-500">🏪 Lojas</p>
                  {item.lojas.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhuma.</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {item.lojas.map((loja) => (
                        <button
                          key={loja.id}
                          type="button"
                          onClick={() => navigate(`/lojas/${loja.id}`)}
                          className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-800 hover:bg-orange-100"
                        >
                          {loja.nome} · {item.maquinasAtivas(loja).length} máq.
                          {loja.estoqueLojaId ? " · 📦" : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <p className="text-xs font-bold uppercase text-gray-500">🎮 Máquinas avulsas</p>
                  {item.avulsas.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhuma.</p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {item.avulsas.map((avulsa) => {
                        const maquina = item.maquinasAtivas(avulsa)[0];
                        const parada = maquina && maquina.statusOperacao && maquina.statusOperacao !== "EM_OPERACAO";
                        return (
                          <button
                            key={avulsa.id}
                            type="button"
                            onClick={() => navigate(`/lojas/${avulsa.id}`)}
                            className={`rounded-full px-3 py-1 text-sm font-semibold ${
                              !maquina || parada ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : "bg-blue-50 text-blue-800 hover:bg-blue-100"
                            }`}
                          >
                            🎮 {avulsa.nome} · {maquina ? maquina.codigo : "sem máquina"}
                            {parada ? " · parada" : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {shopping.observacoes && <p className="mt-3 whitespace-pre-line text-sm text-gray-600">{shopping.observacoes}</p>}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() => navigate(`/visao-lojas?shopping=${shopping.id}`)}
                  >
                    Ver na Visão das Lojas
                  </button>
                  {podeCriarLoja && shopping.ativo && (
                    <>
                      <button type="button" className="btn-secondary text-sm" onClick={() => navigate(`/lojas/nova?shoppingId=${shopping.id}`)}>
                        + Loja
                      </button>
                      <button type="button" className="btn-secondary text-sm" onClick={() => navigate(`/lojas/nova?tipo=AVULSA&shoppingId=${shopping.id}`)}>
                        + Máquina avulsa
                      </button>
                    </>
                  )}
                  {podeGerenciar && shopping.ativo && (
                    <button type="button" className="btn-secondary text-sm" onClick={() => setEditando(shopping)}>
                      ✏️ Editar
                    </button>
                  )}
                  {podeGerenciar && !shopping.ativo && (
                    <button type="button" className="btn-secondary text-sm" onClick={() => reativar(shopping)}>
                      Reativar
                    </button>
                  )}
                  {podeGerenciar && (
                    <button
                      type="button"
                      onClick={() => excluir(shopping)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                    >
                      {shopping.ativo ? "Desativar" : "Excluir de vez"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </main>
      <Footer />

      <FormShopping
        shopping={editando}
        onFechar={() => setEditando(null)}
        onSalvo={(mensagem) => {
          setEditando(null);
          setAviso(mensagem);
          carregar();
        }}
      />
    </div>
  );
}

export default Shoppings;
