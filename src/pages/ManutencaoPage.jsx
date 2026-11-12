import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { PageHeader, Modal } from "../components/UIComponents";
import { SelectBusca } from "../components/SelectBusca";
import { useAuth } from "../contexts/AuthContext";
import { obterPerfil, pode } from "../utils/perfis";
import {
  STATUS_MANUTENCAO,
  ORDEM_STATUS,
  TIPOS_PROBLEMA,
  ACOES_HISTORICO,
  ehParaMim,
} from "../utils/manutencao";

// Manutenção: qualquer um solicita; Cadastro/admin autoriza mandando para um
// setor (perfil) ou uma pessoa (quando eles mesmos abrem, já vai). Quem aceitar fica com
// ela (some pros outros). Quem aceitou conclui, pede serviço de terceiro ou
// diz que não consegue (vai pro admin reenviar). O admin finaliza lançando o
// gasto (obrigatório, pode ser R$ 0).

const FORM_VAZIO = {
  lojaId: "",
  maquinaId: "",
  titulo: "",
  descricao: "",
  tipoProblema: "",
  prazo: "",
  destinoTipo: "setor",
  setor: "",
  destinatarioId: "",
};

const mensagemDeErro = (erro, padrao) => erro?.response?.data?.error || padrao;
const dataHora = (valor) =>
  valor ? new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-";
const reais = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function EscolhaDestino({ valor, aoMudar, destinos }) {
  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-xl bg-gray-100 p-1">
        {[
          ["setor", "👥 Setor"],
          ["pessoa", "👤 Pessoa"],
        ].map(([tipo, rotulo]) => (
          <button
            key={tipo}
            type="button"
            onClick={() => aoMudar({ ...valor, destinoTipo: tipo })}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold ${
              valor.destinoTipo === tipo ? "bg-white text-gray-900 shadow" : "text-gray-500"
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>
      {valor.destinoTipo === "setor" ? (
        <div className="flex flex-wrap gap-2">
          {(destinos.setores || []).map((setor) => (
            <button
              key={setor.valor}
              type="button"
              onClick={() => aoMudar({ ...valor, setor: setor.valor })}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                valor.setor === setor.valor
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
              }`}
            >
              {setor.nome} <span className="opacity-60">({setor.pessoas})</span>
            </button>
          ))}
        </div>
      ) : (
        <SelectBusca
          opcoes={(destinos.pessoas || []).map((p) => ({ valor: p.id, rotulo: p.nome, detalhe: obterPerfil(p.role).curto }))}
          valor={valor.destinatarioId}
          aoMudar={(destinatarioId) => aoMudar({ ...valor, destinatarioId })}
          placeholder="Buscar pessoa"
        />
      )}
      <p className="text-xs text-gray-500">
        {valor.destinoTipo === "setor"
          ? "Todos do setor veem; quem aceitar primeiro fica com ela."
          : "Só essa pessoa vê e decide se aceita."}
      </p>
    </div>
  );
}

const destinoTexto = (m) => {
  if (m.destinatario) return `👤 ${m.destinatario.nome}`;
  if (m.setor) return `👥 ${obterPerfil(m.setor).nome}`;
  const lista = m.funcionariosPermitidos || [];
  return lista.length ? `👥 ${lista.map((p) => p.nome).join(", ")}` : "—";
};

export default function ManutencaoPage() {
  const {
    usuario,
    loading: authLoading,
    atualizarMinhasManutencoesPendentesCount,
    atualizarAlertasManutencaoCount,
  } = useAuth();
  const [manutencoes, setManutencoes] = useState([]);
  const [destinos, setDestinos] = useState({ setores: [], pessoas: [], lojas: [], maquinas: [] });
  const [meuEstoque, setMeuEstoque] = useState([]);
  const [pecas, setPecas] = useState([]);
  const [alertasMovimentacao, setAlertasMovimentacao] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const [abrindo, setAbrindo] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [enviando, setEnviando] = useState(false);

  const [aba, setAba] = useState("ABERTAS");
  const [busca, setBusca] = useState("");
  const [filtroLoja, setFiltroLoja] = useState("");
  const [detalhesAbertos, setDetalhesAbertos] = useState({});
  const [modal, setModal] = useState(null);
  const [erroModal, setErroModal] = useState("");

  const regraGestao = ["ADMIN", "FUNCIONARIO_CADASTRO"].includes(usuario?.role);
  const veTodas = pode(usuario, "manutencao.gerenciarTodas", regraGestao);
  const ehAdmin = pode(usuario, "manutencao.administrar");
  // Autoriza solicitações (e já manda direto quando abre): Admin e Cadastro
  const podeAutorizar = pode(usuario, "manutencao.autorizar", regraGestao);
  const podeAbrir = pode(usuario, "manutencao.criar", true);
  const veAlertasMovimentacao = pode(usuario, "alertas.ver", regraGestao);

  const carregar = useCallback(async () => {
    const semAcesso = () => ({ data: [] });
    try {
      const [lista, destinosRes, estoqueRes, pecasRes, alertasRes] = await Promise.all([
        api.get("/manutencoes"),
        api.get("/manutencoes/destinos").catch(() => ({ data: {} })),
        api.get("/pecas/estoque-funcionario").catch(semAcesso),
        api.get("/pecas").catch(semAcesso),
        veAlertasMovimentacao ? api.get("/alertas-movimentacao").catch(semAcesso) : semAcesso(),
      ]);
      setManutencoes(Array.isArray(lista.data) ? lista.data : []);
      setDestinos({ setores: [], pessoas: [], lojas: [], maquinas: [], ...destinosRes.data });
      setMeuEstoque((Array.isArray(estoqueRes.data) ? estoqueRes.data : []).filter((i) => i.quantidade > 0));
      setPecas(Array.isArray(pecasRes.data) ? pecasRes.data : []);
      setAlertasMovimentacao(Array.isArray(alertasRes.data) ? alertasRes.data : []);
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao carregar as manutenções"));
    } finally {
      setCarregando(false);
    }
  }, [veAlertasMovimentacao]);

  useEffect(() => {
    if (!authLoading) carregar();
  }, [authLoading, carregar]);

  const atualizarTudo = async () => {
    await carregar();
    atualizarMinhasManutencoesPendentesCount?.();
  };

  // Abas: admin/gestão por status; quem trabalha vê o que é dele
  const abas = useMemo(() => {
    const conta = (filtro) => manutencoes.filter(filtro).length;
    if (veTodas) {
      return [
        { chave: "ABERTAS", rotulo: "Em aberto", filtro: (m) => !["FINALIZADA", "RECUSADA"].includes(m.status) },
        ...ORDEM_STATUS.map((status) => ({
          chave: status,
          rotulo:
            status === "SOLICITADA"
              ? "📥 Solicitações"
              : `${STATUS_MANUTENCAO[status].icone} ${STATUS_MANUTENCAO[status].rotulo}${status === "CONCLUIDA" ? " (a finalizar)" : ""}`,
          filtro: (m) => m.status === status,
          destaque: ["SOLICITADA", "AGUARDANDO", "CONCLUIDA"].includes(status),
        })),
      ].map((a) => ({ ...a, total: conta(a.filtro) }));
    }
    return [
      { chave: "ABERTAS", rotulo: "Todas", filtro: () => true },
      { chave: "PARA_MIM", rotulo: "🕐 Para mim", filtro: (m) => m.status === "PENDENTE" && ehParaMim(m, usuario), destaque: true },
      { chave: "COMIGO", rotulo: "🔧 Comigo", filtro: (m) => m.aceitaPorId === usuario?.id && m.status !== "CONCLUIDA" },
      { chave: "ABERTAS_POR_MIM", rotulo: "📝 Pedidas por mim", filtro: (m) => m.criadoPorId === usuario?.id },
    ].map((a) => ({ ...a, total: conta(a.filtro) }));
  }, [manutencoes, veTodas, usuario]);

  // Gestão: se tem solicitação esperando, abre direto nessa aba
  useEffect(() => {
    if (podeAutorizar && manutencoes.some((m) => m.status === "SOLICITADA")) setAba((a) => (a === "ABERTAS" ? "SOLICITADA" : a));
  }, [podeAutorizar, manutencoes]);

  const abaAtual = abas.find((a) => a.chave === aba) || abas[0];
  const termo = busca.trim().toLowerCase();
  const visiveis = manutencoes
    .filter(abaAtual.filtro)
    .filter((m) => !filtroLoja || m.lojaId === filtroLoja)
    .filter(
      (m) =>
        !termo ||
        [m.titulo, m.descricao, m.loja?.nome, m.maquina?.codigo, m.maquina?.nome, m.aceitaPor?.nome]
          .filter(Boolean)
          .some((t) => String(t).toLowerCase().includes(termo)),
    )
    .sort((a, b) => ORDEM_STATUS.indexOf(a.status) - ORDEM_STATUS.indexOf(b.status) || new Date(b.createdAt) - new Date(a.createdAt));

  const maquinasDaLoja = (destinos.maquinas || []).filter((m) => m.lojaId === form.lojaId);

  const abrirManutencao = async (evento) => {
    evento.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const { data } = await api.post("/manutencoes", {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        lojaId: form.lojaId || null,
        maquinaId: form.maquinaId || null,
        tipoProblema: form.tipoProblema || null,
        prazo: form.prazo || null,
        setor: podeAutorizar && form.destinoTipo === "setor" ? form.setor : null,
        destinatarioId: podeAutorizar && form.destinoTipo === "pessoa" ? form.destinatarioId : null,
      });
      setForm(FORM_VAZIO);
      setAbrindo(false);
      setAviso(
        data?.recorrente
          ? `Manutenção aberta. ⚠️ Máquina com manutenção repetida: ${(data.recorrenciaMotivos || []).join(" ")}`
          : data?.status === "SOLICITADA"
            ? "Solicitação enviada! ✅ O Cadastro/admin vai autorizar e mandar para quem vai fazer."
            : "Manutenção aberta! ✅",
      );
      await atualizarTudo();
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao abrir a manutenção"));
    } finally {
      setEnviando(false);
    }
  };

  const acao = async (manutencao, caminho, corpo = {}, mensagem) => {
    setErroModal("");
    setEnviando(true);
    try {
      await api.post(`/manutencoes/${manutencao.id}/${caminho}`, corpo);
      setModal(null);
      if (mensagem) setAviso(mensagem);
      await atualizarTudo();
    } catch (e) {
      const texto = mensagemDeErro(e, "Não foi possível concluir a ação");
      if (modal) setErroModal(texto);
      else setErro(texto);
      if (e?.response?.status === 409) await atualizarTudo();
    } finally {
      setEnviando(false);
    }
  };

  const registrarPeca = async (manutencao, tipo, dados) => {
    setErroModal("");
    setEnviando(true);
    try {
      await api.post(`/manutencoes/${manutencao.id}/${tipo === "usada" ? "pecas" : "pecas-quebradas"}`, {
        pecaId: dados.pecaId,
        quantidade: Number(dados.quantidade),
        observacao: dados.observacao || null,
      });
      setModal(null);
      setAviso(tipo === "usada" ? "Peça usada registrada." : "Peça quebrada registrada.");
      await atualizarTudo();
    } catch (e) {
      setErroModal(mensagemDeErro(e, "Erro ao registrar a peça"));
    } finally {
      setEnviando(false);
    }
  };

  const resolverAlerta = async (id) => {
    try {
      await api.patch(`/alertas-movimentacao/${id}/resolver`);
      await carregar();
      atualizarAlertasManutencaoCount?.();
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao resolver alerta"));
    }
  };

  if (carregando || authLoading) return <PageLoader />;

  const abrirModal = (tipo, manutencao, inicial = {}) => {
    setErroModal("");
    setModal({ tipo, manutencao, dados: inicial });
  };
  const mudarModal = (campo, valor) => setModal((m) => ({ ...m, dados: { ...m.dados, [campo]: valor } }));

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Manutenção"
          subtitle="Solicite, acompanhe e resolva: do pedido até o gasto lançado"
          icon="🛠️"
          action={
            podeAbrir ? (
              <button type="button" onClick={() => setAbrindo((a) => !a)} className="btn-primary">
                {abrindo ? "Fechar" : podeAutorizar ? "➕ Abrir manutenção" : "➕ Solicitar manutenção"}
              </button>
            ) : null
          }
        />

        {erro && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{erro}</div>}
        {aviso && (
          <div className="flex justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            <span>{aviso}</span>
            <button type="button" onClick={() => setAviso("")}>✕</button>
          </div>
        )}

        {/* Abrir manutenção */}
        {abrindo && (
          <form onSubmit={abrirManutencao} className="card space-y-5">
            <h2 className="text-xl font-black text-gray-900">🛠️ {podeAutorizar ? "Abrir manutenção" : "Solicitar manutenção"}</h2>

            <section className="space-y-2">
              <p className="text-sm font-black text-gray-700">1. Onde é o problema?</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <SelectBusca
                  opcoes={(destinos.lojas || []).map((l) => ({ valor: l.id, rotulo: l.nome }))}
                  valor={form.lojaId}
                  aoMudar={(lojaId) => setForm((f) => ({ ...f, lojaId, maquinaId: "" }))}
                  placeholder="🏪 Loja"
                  required
                />
                <SelectBusca
                  opcoes={maquinasDaLoja.map((m) => ({ valor: m.id, rotulo: `${m.codigo}${m.tipo ? ` – ${m.tipo}` : ""}`, detalhe: m.nome || undefined }))}
                  valor={form.maquinaId}
                  aoMudar={(maquinaId) => setForm((f) => ({ ...f, maquinaId }))}
                  opcaoVazia="Problema na loja (não numa máquina)"
                  placeholder={form.lojaId ? "🎰 Máquina (opcional)" : "Escolha a loja primeiro"}
                  disabled={!form.lojaId}
                />
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-sm font-black text-gray-700">2. O que aconteceu?</p>
              <div className="flex flex-wrap gap-2">
                {TIPOS_PROBLEMA.map((t) => (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tipoProblema: f.tipoProblema === t.valor ? "" : t.valor }))}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                      form.tipoProblema === t.valor ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {t.icone} {t.rotulo}
                  </button>
                ))}
              </div>
              <input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                placeholder="Resumo (ex.: garra não segura)"
                maxLength={150}
                className="input-field w-full"
                required
              />
              <textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Conte os detalhes: o que acontece, desde quando, o que já tentou..."
                rows={3}
                className="input-field w-full"
                required
              />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                Prazo (opcional)
                <input type="date" value={form.prazo} onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))} className="input-field w-auto" />
              </label>
            </section>

            {podeAutorizar ? (
              <section className="space-y-2">
                <p className="text-sm font-black text-gray-700">3. Para quem vai?</p>
                <EscolhaDestino valor={form} aoMudar={setForm} destinos={destinos} />
              </section>
            ) : (
              <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-800">
                📥 Sua solicitação vai para o Cadastro/admin autorizar e escolher quem vai fazer. Você acompanha em "Pedidas por mim".
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAbrindo(false)} className="btn-secondary">Cancelar</button>
              <button
                type="submit"
                disabled={enviando || (podeAutorizar && (form.destinoTipo === "setor" ? !form.setor : !form.destinatarioId))}
                className="btn-primary disabled:opacity-50"
              >
                {enviando ? "Enviando..." : podeAutorizar ? "Abrir manutenção" : "Enviar solicitação"}
              </button>
            </div>
          </form>
        )}

        {/* Alertas de movimentação (gestão) */}
        {veAlertasMovimentacao && alertasMovimentacao.length > 0 && (
          <details className="card border-l-4 border-amber-500">
            <summary className="cursor-pointer text-lg font-bold text-gray-900">
              ⚠️ Alertas de movimentação ({alertasMovimentacao.length})
            </summary>
            <div className="mt-3 space-y-2">
              {alertasMovimentacao.map((alerta) => (
                <div key={alerta.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div>
                    <p className="font-semibold">
                      {alerta.loja?.nome || "-"} · {alerta.maquina ? `${alerta.maquina.codigo || ""} ${alerta.maquina.nome || ""}` : "-"}
                    </p>
                    <p className="text-gray-700">{alerta.observacao}</p>
                    <p className="text-xs text-gray-500">{alerta.usuario?.nome || "-"} · {dataHora(alerta.createdAt)}</p>
                  </div>
                  <button type="button" onClick={() => resolverAlerta(alerta.id)} className="btn-primary px-3 py-1.5 text-sm">Corrigido</button>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Meu carrinho de peças */}
        {meuEstoque.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 text-sm shadow-sm">
            <span className="font-bold text-gray-700">🔩 Minhas peças:</span>
            {meuEstoque.map((item) => (
              <span key={item.id} className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">
                {item.peca?.nome}: {item.quantidade}
              </span>
            ))}
          </div>
        )}

        {/* Abas e filtros */}
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
          {abas.map((a) => (
            <button
              key={a.chave}
              type="button"
              onClick={() => setAba(a.chave)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold ${
                abaAtual.chave === a.chave ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {a.rotulo}
              <span
                className={`rounded-full px-1.5 text-xs ${
                  a.destaque && a.total > 0 && abaAtual.chave !== a.chave ? "bg-rose-500 text-white" : "bg-black/10"
                }`}
              >
                {a.total}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔍 Buscar por problema, loja, máquina, pessoa"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          {veTodas && (
            <div className="w-full sm:w-72">
              <SelectBusca
                opcoes={(destinos.lojas || []).map((l) => ({ valor: l.id, rotulo: l.nome }))}
                valor={filtroLoja}
                aoMudar={setFiltroLoja}
                opcaoVazia="Todas as lojas"
                placeholder="Todas as lojas"
                className="text-sm"
              />
            </div>
          )}
        </div>

        {/* Lista */}
        {visiveis.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 p-8 text-center text-sm text-gray-500">
            Nenhuma manutenção aqui.
          </div>
        )}
        <div className="space-y-3">
          {visiveis.map((m) => {
            const info = STATUS_MANUTENCAO[m.status] || STATUS_MANUTENCAO.PENDENTE;
            const tipo = TIPOS_PROBLEMA.find((t) => t.valor === m.tipoProblema);
            const minha = m.aceitaPorId === usuario?.id;
            const podeTrabalhar = minha || (veTodas && m.status === "ACEITA");
            const podeAceitar = m.status === "PENDENTE" && !ehAdmin && (ehParaMim(m, usuario) || veTodas);
            const aberto = Boolean(detalhesAbertos[m.id]);
            const atrasada = m.prazo && !["CONCLUIDA", "FINALIZADA"].includes(m.status) && m.prazo < new Date().toISOString().slice(0, 10);
            return (
              <div key={m.id} className={`rounded-2xl border border-l-4 border-gray-100 bg-white p-4 shadow-sm ${info.borda}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-black ${info.classe}`}>
                        {info.icone} {info.rotulo}
                      </span>
                      {tipo && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{tipo.icone} {tipo.rotulo}</span>}
                      {atrasada && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">Atrasada</span>}
                      {m.servicoExterno && m.status === "ACEITA" && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800">🛠️ {m.servicoExterno} solicitado</span>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-gray-900">{m.titulo}</h3>
                    <p className="text-sm text-gray-600">
                      🏪 {m.loja?.nome || "—"}
                      {m.maquina && ` · 🎰 ${m.maquina.codigo}${m.maquina.tipo ? ` (${m.maquina.tipo})` : ""}`}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>Aberta por <b>{m.criadoPor?.nome || "-"}</b></p>
                    <p>{dataHora(m.createdAt)}</p>
                    {m.prazo && <p>Prazo {m.prazo.split("-").reverse().join("/")}</p>}
                  </div>
                </div>

                <p className="mt-2 whitespace-pre-line text-sm text-gray-800">{m.descricao}</p>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {!["SOLICITADA", "RECUSADA"].includes(m.status) && (
                    <span className="text-gray-600">Para: <b className="text-gray-900">{destinoTexto(m)}</b></span>
                  )}
                  {m.aceitaPor && !["PENDENTE"].includes(m.status) && (
                    <span className="text-gray-600">Com: <b className="text-gray-900">{m.aceitaPor.nome}</b>{m.aceitaEm && ` desde ${dataHora(m.aceitaEm)}`}</span>
                  )}
                </div>

                {m.status === "SOLICITADA" && (
                  <p className="mt-2 rounded-lg bg-violet-50 p-2 text-sm text-violet-800">
                    📥 Aguardando autorização do Cadastro/admin.
                  </p>
                )}
                {m.status === "RECUSADA" && (
                  <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm text-gray-700">
                    ✖️ Recusada{m.autorizadaPor ? ` por ${m.autorizadaPor.nome}` : ""}: {m.motivoRecusa}
                  </p>
                )}
                {m.status === "AGUARDANDO" && m.motivoAguardando && (
                  <p className="mt-2 rounded-lg bg-rose-50 p-2 text-sm text-rose-800">
                    ⏸️ <b>{m.aceitaPor?.nome || "Quem aceitou"} não conseguiu fazer:</b> {m.motivoAguardando}
                  </p>
                )}
                {m.status === "CONCLUIDA" && (
                  <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">
                    ✅ Concluída por <b>{m.resolvidoPor?.nome || m.aceitaPor?.nome || "-"}</b> em {dataHora(m.resolvidoEm)}
                    {ehAdmin ? " — falta finalizar com o gasto." : " — aguardando o admin finalizar."}
                  </p>
                )}
                {m.status === "FINALIZADA" && (
                  <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm text-gray-700">
                    🏁 Finalizada{m.finalizadaPor ? ` por ${m.finalizadaPor.nome}` : ""} · gasto <b>{reais(m.custo)}</b>
                    {m.gastoDescricao && ` — ${m.gastoDescricao}`}
                  </p>
                )}

                {/* Ações */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {podeAutorizar && m.status === "SOLICITADA" && (
                    <>
                      <button type="button" onClick={() => abrirModal("autorizar", m, { destinoTipo: "setor", setor: "", destinatarioId: "", prazo: m.prazo || "" })} className="btn-primary px-4 py-2 text-sm">
                        👍 Autorizar e enviar
                      </button>
                      <button type="button" onClick={() => abrirModal("recusar", m)} className="btn-secondary px-3 py-2 text-sm">✖️ Recusar</button>
                    </>
                  )}
                  {podeAceitar && (
                    <button type="button" disabled={enviando} onClick={() => acao(m, "aceitar", {}, "Manutenção aceita: agora ela é sua.")} className="btn-primary px-4 py-2 text-sm">
                      ✋ Aceitar
                    </button>
                  )}
                  {m.status === "ACEITA" && podeTrabalhar && (
                    <>
                      <button type="button" onClick={() => abrirModal("concluir", m)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">✅ Concluir</button>
                      <button type="button" onClick={() => abrirModal("servico", m, { servico: m.servicoExterno || "" })} className="btn-secondary px-3 py-2 text-sm">🛠️ Pedir serviço</button>
                      <button type="button" onClick={() => abrirModal("aguardar", m)} className="btn-secondary px-3 py-2 text-sm">⏸️ Não consigo fazer</button>
                      {meuEstoque.length > 0 && minha && (
                        <button type="button" onClick={() => abrirModal("pecaUsada", m, { quantidade: "1" })} className="btn-secondary px-3 py-2 text-sm">🔩 Peça usada</button>
                      )}
                      {pecas.length > 0 && (
                        <button type="button" onClick={() => abrirModal("pecaQuebrada", m, { quantidade: "1" })} className="btn-secondary px-3 py-2 text-sm">💥 Peça quebrada</button>
                      )}
                    </>
                  )}
                  {ehAdmin && ["PENDENTE", "ACEITA", "AGUARDANDO"].includes(m.status) && (
                    <button
                      type="button"
                      onClick={() => abrirModal("reenviar", m, { destinoTipo: m.destinatarioId ? "pessoa" : "setor", setor: m.setor || "", destinatarioId: m.destinatarioId || m.aceitaPorId || "" })}
                      className={`${m.status === "AGUARDANDO" ? "btn-primary" : "btn-secondary"} px-3 py-2 text-sm`}
                    >
                      ↪️ Reenviar
                    </button>
                  )}
                  {ehAdmin && m.status === "CONCLUIDA" && (
                    <button type="button" onClick={() => abrirModal("finalizar", m, { custo: "", gastoDescricao: "" })} className="btn-primary px-4 py-2 text-sm">🏁 Finalizar (lançar gasto)</button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetalhesAbertos((d) => ({ ...d, [m.id]: !d[m.id] }))}
                    className="ml-auto px-2 py-2 text-sm font-semibold text-gray-500 hover:text-gray-800"
                  >
                    {aberto ? "Esconder detalhes ▲" : "Detalhes ▼"}
                  </button>
                </div>

                {aberto && (
                  <div className="mt-3 grid grid-cols-1 gap-4 border-t border-gray-100 pt-3 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-black uppercase text-gray-500">Linha do tempo</p>
                      <ol className="space-y-2 border-l-2 border-gray-200 pl-3">
                        {(m.historico || []).length === 0 && <li className="text-sm text-gray-500">Sem registro de etapas (manutenção antiga).</li>}
                        {(m.historico || []).map((h, i) => (
                          <li key={i} className="text-sm">
                            <p className="font-semibold text-gray-800">{ACOES_HISTORICO[h.acao] || h.acao}</p>
                            <p className="text-xs text-gray-500">{h.usuarioNome || "-"} · {dataHora(h.em)}</p>
                            {h.detalhe && <p className="text-xs text-gray-700">{h.detalhe}</p>}
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-xs font-black uppercase text-gray-500">Peças</p>
                      {(m.pecasUsadas || []).length === 0 && (m.pecasQuebradas || []).length === 0 && <p className="text-gray-500">Nenhuma peça registrada.</p>}
                      {(m.pecasUsadas || []).map((p) => (
                        <p key={p.id}>🔩 {p.quantidade}× {p.peca?.nome} <span className="text-xs text-gray-500">({p.usuario?.nome})</span></p>
                      ))}
                      {(m.pecasQuebradas || []).map((p) => (
                        <p key={p.id}>💥 {p.quantidade}× {p.peca?.nome} quebrada <span className="text-xs text-gray-500">({p.funcionario?.nome})</span></p>
                      ))}
                      {m.servicoExterno && <p>🛠️ Serviço: {m.servicoExterno} ({dataHora(m.servicoSolicitadoEm)})</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modais das ações */}
      <Modal
        isOpen={Boolean(modal)}
        onClose={() => !enviando && setModal(null)}
        title={
          modal
            ? {
                autorizar: "👍 Autorizar e enviar",
                recusar: "✖️ Recusar solicitação",
                concluir: "✅ Concluir manutenção",
                servico: "🛠️ Pedir serviço de terceiro",
                aguardar: "⏸️ Não consigo fazer",
                reenviar: "↪️ Reenviar manutenção",
                finalizar: "🏁 Finalizar manutenção",
                pecaUsada: "🔩 Peça usada",
                pecaQuebrada: "💥 Peça quebrada",
              }[modal.tipo]
            : ""
        }
        size="sm"
      >
        {modal && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const { tipo, manutencao: m, dados } = modal;
              if (tipo === "autorizar")
                acao(m, "autorizar", {
                  setor: dados.destinoTipo === "setor" ? dados.setor : null,
                  destinatarioId: dados.destinoTipo === "pessoa" ? dados.destinatarioId : null,
                  prazo: dados.prazo || null,
                }, "Autorizada e enviada. 👍");
              if (tipo === "recusar") acao(m, "recusar", { motivo: dados.motivo }, "Solicitação recusada.");
              if (tipo === "concluir") acao(m, "concluir", { observacao: dados.observacao }, "Manutenção concluída! O admin vai finalizar.");
              if (tipo === "servico") acao(m, "servico", { servico: dados.servico }, `Serviço "${dados.servico}" anotado.`);
              if (tipo === "aguardar") acao(m, "aguardar", { motivo: dados.motivo }, "Avisado: a manutenção voltou para o admin.");
              if (tipo === "reenviar")
                acao(m, "reenviar", {
                  setor: dados.destinoTipo === "setor" ? dados.setor : null,
                  destinatarioId: dados.destinoTipo === "pessoa" ? dados.destinatarioId : null,
                  observacao: dados.observacao,
                }, "Manutenção reenviada.");
              if (tipo === "finalizar") acao(m, "finalizar", { custo: dados.custo, gastoDescricao: dados.gastoDescricao }, "Manutenção finalizada. 🏁");
              if (tipo === "pecaUsada" || tipo === "pecaQuebrada") registrarPeca(m, tipo === "pecaUsada" ? "usada" : "quebrada", dados);
            }}
          >
            <p className="text-sm text-gray-600">
              <b>{modal.manutencao.titulo}</b> · {modal.manutencao.loja?.nome || ""}
              {modal.manutencao.maquina ? ` · ${modal.manutencao.maquina.codigo}` : ""}
            </p>

            {modal.tipo === "autorizar" && (
              <>
                <p className="text-sm whitespace-pre-line text-gray-700">{modal.manutencao.descricao}</p>
                <p className="text-sm font-black text-gray-700">Para quem vai?</p>
                <EscolhaDestino valor={modal.dados} aoMudar={(d) => setModal((mm) => ({ ...mm, dados: d }))} destinos={destinos} />
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  Prazo (opcional)
                  <input type="date" value={modal.dados.prazo || ""} onChange={(e) => mudarModal("prazo", e.target.value)} className="input-field w-auto" />
                </label>
              </>
            )}
            {modal.tipo === "recusar" && (
              <textarea value={modal.dados.motivo || ""} onChange={(e) => mudarModal("motivo", e.target.value)} rows={3} placeholder="Por que não vai ser feita? (quem pediu vai ver)" className="input-field w-full" required minLength={3} />
            )}
            {modal.tipo === "concluir" && (
              <textarea value={modal.dados.observacao || ""} onChange={(e) => mudarModal("observacao", e.target.value)} rows={3} placeholder="O que foi feito? (opcional)" className="input-field w-full" />
            )}
            {modal.tipo === "servico" && (
              <>
                <input value={modal.dados.servico || ""} onChange={(e) => mudarModal("servico", e.target.value)} placeholder="Qual serviço? Ex.: serralheiro, eletricista" className="input-field w-full" required minLength={3} />
                <p className="text-xs text-gray-500">A manutenção continua com você. Quando o serviço for feito, toque em Concluir.</p>
              </>
            )}
            {modal.tipo === "aguardar" && (
              <>
                <textarea value={modal.dados.motivo || ""} onChange={(e) => mudarModal("motivo", e.target.value)} rows={3} placeholder="Por que não deu? Ex.: faltou a peça X" className="input-field w-full" required minLength={3} />
                <p className="text-xs text-gray-500">Ela volta para o admin, que reenvia para você ou para outra pessoa.</p>
              </>
            )}
            {modal.tipo === "reenviar" && (
              <>
                <EscolhaDestino valor={modal.dados} aoMudar={(d) => setModal((mm) => ({ ...mm, dados: d }))} destinos={destinos} />
                <input value={modal.dados.observacao || ""} onChange={(e) => mudarModal("observacao", e.target.value)} placeholder="Recado (opcional). Ex.: a peça chegou" className="input-field w-full" />
              </>
            )}
            {modal.tipo === "finalizar" && (
              <>
                <label className="block text-sm font-semibold text-gray-700">
                  Valor gasto (R$) *
                  <input type="number" step="0.01" min="0" inputMode="decimal" value={modal.dados.custo} onChange={(e) => mudarModal("custo", e.target.value)} placeholder="0,00" className="input-field mt-1 w-full" required />
                </label>
                <textarea value={modal.dados.gastoDescricao} onChange={(e) => mudarModal("gastoDescricao", e.target.value)} rows={2} placeholder="O que foi gasto? Ex.: mola + serralheiro (ou: sem gasto, só ajuste)" className="input-field w-full" required minLength={3} />
                <p className="text-xs text-gray-500">Obrigatório. Pode ser R$ 0. Se for maior que zero, entra em Gasto Variável da loja.</p>
              </>
            )}
            {(modal.tipo === "pecaUsada" || modal.tipo === "pecaQuebrada") && (
              <>
                <SelectBusca
                  opcoes={
                    modal.tipo === "pecaUsada"
                      ? meuEstoque.map((i) => ({ valor: i.pecaId || i.peca?.id, rotulo: i.peca?.nome || "Peça", detalhe: `${i.quantidade} comigo` }))
                      : pecas.map((p) => ({ valor: p.id, rotulo: p.nome, detalhe: p.codigo || undefined }))
                  }
                  valor={modal.dados.pecaId || ""}
                  aoMudar={(pecaId) => mudarModal("pecaId", pecaId)}
                  placeholder="Buscar peça"
                  required
                />
                <input type="number" min="1" value={modal.dados.quantidade} onChange={(e) => mudarModal("quantidade", e.target.value)} className="input-field w-full" required />
                <input value={modal.dados.observacao || ""} onChange={(e) => mudarModal("observacao", e.target.value)} placeholder="Observação (opcional)" className="input-field w-full" />
              </>
            )}

            {erroModal && <p className="text-sm text-rose-600">{erroModal}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setModal(null)} disabled={enviando} className="btn-secondary">Cancelar</button>
              <button
                type="submit"
                disabled={
                  enviando ||
                  (["reenviar", "autorizar"].includes(modal.tipo) &&
                    (modal.dados.destinoTipo === "setor" ? !modal.dados.setor : !modal.dados.destinatarioId))
                }
                className="btn-primary disabled:opacity-50"
              >
                {enviando ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </form>
        )}
      </Modal>
      <Footer />
    </div>
  );
}
