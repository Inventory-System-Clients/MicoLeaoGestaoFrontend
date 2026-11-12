import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { PageHeader, Modal } from "../components/UIComponents";
import { SelectBusca } from "../components/SelectBusca";
import { PontoRapido } from "../components/PontoRapido";
import { useAuth } from "../contexts/AuthContext";
import { pode } from "../utils/perfis";

// Rotas do motorista (antigos roteiros): quem monta (Admin, Chefe de
// Expedição, Gerente de Vendas) escolhe motorista, veículo, data/hora de
// início e as paradas (lojas). Os envios entram pela tela de Envios. No
// horário a rota começa sozinha e o veículo fica em uso; o motorista marca
// as paradas entregues e finaliza (data fim automática, devolve o veículo).

const STATUS_ROTA = {
  AGENDADA: { rotulo: "Agendada", icone: "📅", classe: "bg-sky-100 text-sky-800", borda: "border-l-sky-500" },
  EM_ANDAMENTO: { rotulo: "Em andamento", icone: "🚚", classe: "bg-amber-100 text-amber-800", borda: "border-l-amber-500" },
  FINALIZADA: { rotulo: "Finalizada", icone: "🏁", classe: "bg-emerald-100 text-emerald-800", borda: "border-l-emerald-500" },
};

const COMBUSTIVEL = ["Reserva", "1/4", "1/2", "3/4", "Cheio"];

const mensagemDeErro = (erro, padrao) => erro?.response?.data?.error || padrao;
const dataHora = (valor) =>
  valor ? new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
// Date -> valor do <input type="datetime-local"> no horário do aparelho
const paraCampoDataHora = (valor) => {
  if (!valor) return "";
  const data = new Date(valor);
  return new Date(data.getTime() - data.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const situacaoDaRota = (rota) => (!rota.dataInicio && rota.status === "AGENDADA" ? "SEM_DATA" : rota.status);

const FORM_VAZIO = { nome: "", usuarioId: "", veiculoId: "", dataInicio: "", paradas: [] };

function Paradas({ rota, motorista, aoEntregar, enviando }) {
  const paradas = (rota.itens || []).filter((item) => item.tipo === "LOJA" || item.anotacao);
  if (paradas.length === 0) return <p className="text-sm text-gray-500">Nenhuma parada ainda.</p>;
  return (
    <ol className="space-y-2">
      {paradas.map((item, indice) => {
        const envios = (rota.envios || []).filter((envio) => envio.lojaDestinoId === item.lojaId);
        const lacres = envios.flatMap((envio) => envio.lacres || []);
        return (
          <li
            key={item.id}
            className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${item.concluido ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${item.concluido ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-600"}`}>
              {item.concluido ? "✓" : indice + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900">{item.loja?.nome || item.anotacao}</p>
              {item.loja && (item.loja.endereco || item.loja.cidade) && (
                <p className="truncate text-xs text-gray-500">{[item.loja.endereco, item.loja.cidade].filter(Boolean).join(" · ")}</p>
              )}
              {lacres.length > 0 && (
                <p className="mt-1 text-xs font-semibold text-violet-700">
                  📦 {envios.length} envio(s) · lacres {lacres.map((l) => l.numero).join(", ")}
                </p>
              )}
              {item.concluido && item.concluidoEm && <p className="text-xs text-emerald-700">Entregue às {dataHora(item.concluidoEm)}</p>}
            </div>
            {motorista && rota.status === "EM_ANDAMENTO" && item.tipo === "LOJA" && (
              <button
                type="button"
                disabled={enviando}
                onClick={() => aoEntregar(item)}
                className={item.concluido ? "text-xs font-semibold text-gray-500 underline" : "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"}
              >
                {item.concluido ? "Desfazer" : "✅ Entregue"}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Roteiros() {
  const { usuario } = useAuth();
  const ehGestor = pode(usuario, "roteiros.criar", ["ADMIN", "DESENVOLVEDOR", "FUNCIONARIO_ESTOQUE"].includes(usuario?.role));
  const podeExecutar = pode(usuario, "roteiros.executar", false);
  const ehMotorista = usuario?.role === "MOTORISTA" || (!ehGestor && podeExecutar);

  const [rotas, setRotas] = useState([]);
  const [opcoes, setOpcoes] = useState({ lojas: [], motoristas: [], veiculos: [], envios: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [aba, setAba] = useState("ATIVAS");
  const [form, setForm] = useState(null);
  const [erroForm, setErroForm] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [finalizando, setFinalizando] = useState(null);
  const [lojaParaAdicionar, setLojaParaAdicionar] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [lista, opcoesRes] = await Promise.all([
        api.get("/roteiros"),
        ehGestor ? api.get("/roteiros/opcoes").catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      ]);
      setRotas(Array.isArray(lista.data) ? lista.data : []);
      if (opcoesRes.data) setOpcoes(opcoesRes.data);
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao carregar as rotas"));
    } finally {
      setCarregando(false);
    }
  }, [ehGestor]);

  useEffect(() => {
    carregar();
    // Atualiza sozinho (a rota começa no horário)
    const timer = setInterval(carregar, 60000);
    return () => clearInterval(timer);
  }, [carregar]);

  const abas = useMemo(() => {
    const conta = (filtro) => rotas.filter(filtro).length;
    const lista = [
      { chave: "ATIVAS", rotulo: "Em andamento e agendadas", filtro: (r) => ["EM_ANDAMENTO", "AGENDADA"].includes(situacaoDaRota(r)) },
      { chave: "FINALIZADA", rotulo: "🏁 Finalizadas", filtro: (r) => r.status === "FINALIZADA" },
    ];
    if (ehGestor && rotas.some((r) => situacaoDaRota(r) === "SEM_DATA")) {
      lista.push({ chave: "SEM_DATA", rotulo: "🗂️ Sem data (antigos roteiros)", filtro: (r) => situacaoDaRota(r) === "SEM_DATA" });
    }
    return lista.map((a) => ({ ...a, total: conta(a.filtro) }));
  }, [rotas, ehGestor]);
  const abaAtual = abas.find((a) => a.chave === aba) || abas[0];
  const visiveis = rotas
    .filter(abaAtual.filtro)
    .sort((a, b) => {
      const ordem = { EM_ANDAMENTO: 0, AGENDADA: 1, FINALIZADA: 2 };
      return (ordem[a.status] ?? 3) - (ordem[b.status] ?? 3) || new Date(a.dataInicio || 0) - new Date(b.dataInicio || 0);
    });

  const abrirForm = (rota = null) => {
    setErroForm("");
    setLojaParaAdicionar("");
    setForm(
      rota
        ? {
            id: rota.id,
            status: rota.status,
            nome: rota.nome,
            usuarioId: rota.usuarioId,
            veiculoId: rota.veiculoId || "",
            dataInicio: paraCampoDataHora(rota.dataInicio),
            itens: rota.itens || [],
          }
        : { ...FORM_VAZIO },
    );
  };

  const salvar = async (evento) => {
    evento.preventDefault();
    setErroForm("");
    setEnviando(true);
    try {
      const corpo = {
        nome: form.nome,
        usuarioId: form.usuarioId,
        veiculoId: form.veiculoId || null,
        dataInicio: form.dataInicio ? new Date(form.dataInicio).toISOString() : null,
      };
      if (form.id) {
        await api.put(`/roteiros/${form.id}`, corpo);
        setAviso("Rota atualizada.");
      } else {
        await api.post("/roteiros", { ...corpo, paradas: form.paradas });
        setAviso("Rota criada! Os envios entram pela tela de Envios, escolhendo esta rota.");
      }
      setForm(null);
      await carregar();
    } catch (e) {
      setErroForm(mensagemDeErro(e, "Não foi possível salvar a rota"));
    } finally {
      setEnviando(false);
    }
  };

  // Paradas na edição: usam os itens da rota direto na API
  const adicionarParada = async (lojaId) => {
    if (!lojaId) return;
    if (!form.id) {
      setForm((f) => ({ ...f, paradas: f.paradas.includes(lojaId) ? f.paradas : [...f.paradas, lojaId] }));
      setLojaParaAdicionar("");
      return;
    }
    try {
      const { data } = await api.post(`/roteiros/${form.id}/itens`, { tipo: "LOJA", lojaId });
      setForm((f) => ({ ...f, itens: data.itens || f.itens }));
      setLojaParaAdicionar("");
      carregar();
    } catch (e) {
      setErroForm(mensagemDeErro(e, "Erro ao adicionar parada"));
    }
  };

  const removerParada = async (item) => {
    try {
      const { data } = await api.delete(`/roteiros/itens/${item.id}`);
      setForm((f) => ({ ...f, itens: data?.itens || f.itens.filter((i) => i.id !== item.id) }));
      carregar();
    } catch (e) {
      setErroForm(mensagemDeErro(e, "Erro ao remover parada"));
    }
  };

  const moverParada = async (indice, direcao) => {
    if (!form.id) {
      setForm((f) => {
        const lista = [...f.paradas];
        const destino = indice + direcao;
        if (destino < 0 || destino >= lista.length) return f;
        [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
        return { ...f, paradas: lista };
      });
      return;
    }
    const lista = [...form.itens].sort((a, b) => a.ordem - b.ordem);
    const destino = indice + direcao;
    if (destino < 0 || destino >= lista.length) return;
    try {
      await api.put(`/roteiros/itens/${lista[indice].id}`, { ordem: lista[destino].ordem });
      await api.put(`/roteiros/itens/${lista[destino].id}`, { ordem: lista[indice].ordem });
      const { data } = await api.get("/roteiros");
      const atualizada = (data || []).find((r) => r.id === form.id);
      if (atualizada) setForm((f) => ({ ...f, itens: atualizada.itens }));
      setRotas(Array.isArray(data) ? data : []);
    } catch (e) {
      setErroForm(mensagemDeErro(e, "Erro ao reordenar"));
    }
  };

  const excluir = async (rota) => {
    if (!window.confirm(`Excluir a rota "${rota.nome}"? Os envios dela ficam sem rota.`)) return;
    try {
      await api.delete(`/roteiros/${rota.id}`);
      setAviso("Rota excluída.");
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao excluir a rota"));
    }
  };

  const iniciar = async (rota) => {
    setEnviando(true);
    try {
      await api.post(`/roteiros/${rota.id}/iniciar`);
      setAviso("Rota iniciada. Boa viagem! 🚚");
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível iniciar a rota"));
    } finally {
      setEnviando(false);
    }
  };

  const marcarEntrega = async (item) => {
    setEnviando(true);
    try {
      await api.patch(`/roteiros/itens/${item.id}/concluir`, { concluido: !item.concluido });
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível marcar a entrega"));
    } finally {
      setEnviando(false);
    }
  };

  const finalizar = async (evento) => {
    evento.preventDefault();
    setErroForm("");
    setEnviando(true);
    try {
      await api.post(`/roteiros/${finalizando.rota.id}/finalizar`, {
        km: finalizando.km,
        combustivel: finalizando.combustivel || undefined,
        observacao: finalizando.observacao || undefined,
      });
      setFinalizando(null);
      setAviso("Rota finalizada e veículo devolvido. 🏁");
      await carregar();
    } catch (e) {
      setErroForm(mensagemDeErro(e, "Não foi possível finalizar"));
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) return <PageLoader />;

  const nomeLoja = (id) => opcoes.lojas.find((l) => l.id === id)?.nome || "Loja";
  const paradasDoForm = form
    ? form.id
      ? [...(form.itens || [])].sort((a, b) => a.ordem - b.ordem).map((i) => ({ id: i.id, nome: i.loja?.nome || i.anotacao, item: i }))
      : form.paradas.map((lojaId) => ({ id: lojaId, nome: nomeLoja(lojaId) }))
    : [];

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern pb-24">
      <Navbar />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        {ehMotorista && <PontoRapido />}
        <PageHeader
          title={ehMotorista && !ehGestor ? "Minhas rotas" : "Rotas"}
          subtitle={
            ehGestor
              ? "Monte a rota do motorista: veículo, início e paradas. No horário ela começa e o veículo fica em uso."
              : "Comece a rota, marque cada entrega e finalize para devolver o veículo."
          }
          icon="🚚"
          action={ehGestor ? <button type="button" onClick={() => abrirForm()} className="btn-primary">➕ Nova rota</button> : null}
        />

        {erro && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{erro}</div>}
        {aviso && (
          <div className="flex justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            <span>{aviso}</span>
            <button type="button" onClick={() => setAviso("")}>✕</button>
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
          {abas.map((a) => (
            <button
              key={a.chave}
              type="button"
              onClick={() => setAba(a.chave)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold ${abaAtual.chave === a.chave ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {a.rotulo} <span className="rounded-full bg-black/10 px-1.5 text-xs">{a.total}</span>
            </button>
          ))}
        </div>

        {visiveis.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 p-8 text-center text-sm text-gray-500">
            {ehMotorista && !ehGestor ? "Nenhuma rota para você agora." : "Nenhuma rota aqui."}
          </div>
        )}

        <div className="space-y-4">
          {visiveis.map((rota) => {
            const situacao = situacaoDaRota(rota);
            const info = STATUS_ROTA[rota.status] || STATUS_ROTA.AGENDADA;
            const paradasLoja = (rota.itens || []).filter((i) => i.tipo === "LOJA");
            const entregues = paradasLoja.filter((i) => i.concluido).length;
            const minha = rota.usuarioId === usuario?.id;
            return (
              <div key={rota.id} className={`rounded-2xl border border-l-4 border-gray-100 bg-white p-4 shadow-sm ${info.borda}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-black ${situacao === "SEM_DATA" ? "bg-gray-100 text-gray-600" : info.classe}`}>
                        {situacao === "SEM_DATA" ? "🗂️ Sem data" : `${info.icone} ${info.rotulo}`}
                      </span>
                      {paradasLoja.length > 0 && (
                        <span className="text-xs font-semibold text-gray-500">{entregues}/{paradasLoja.length} paradas entregues</span>
                      )}
                    </div>
                    <h3 className="text-xl font-black text-gray-900">{rota.nome}</h3>
                    <p className="text-sm text-gray-600">
                      👤 {rota.funcionario?.nome || "—"}
                      {rota.funcionario && rota.funcionario.role !== "MOTORISTA" && <span className="text-amber-700"> (não é motorista: edite a rota)</span>}
                      {" · "}
                      {rota.veiculo ? `${rota.veiculo.emoji || "🚗"} ${rota.veiculo.nome}${rota.veiculo.modelo ? ` (${rota.veiculo.modelo})` : ""}` : "sem veículo"}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>Início: <b className="text-gray-800">{dataHora(rota.dataInicio)}</b></p>
                    {rota.iniciadaEm && <p>Começou: {dataHora(rota.iniciadaEm)}</p>}
                    {rota.dataFim && <p>Fim: <b className="text-gray-800">{dataHora(rota.dataFim)}</b></p>}
                    {rota.kmFinal != null && rota.kmInicial != null && <p>{rota.kmFinal - rota.kmInicial} km rodados</p>}
                  </div>
                </div>

                {paradasLoja.length > 0 && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(entregues / paradasLoja.length) * 100}%` }} />
                  </div>
                )}

                <div className="mt-3">
                  <Paradas rota={rota} motorista={minha} aoEntregar={marcarEntrega} enviando={enviando} />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {minha && rota.status === "AGENDADA" && rota.dataInicio && (
                    <button type="button" disabled={enviando} onClick={() => iniciar(rota)} className="btn-primary px-4 py-2 text-sm">▶️ Iniciar agora</button>
                  )}
                  {(minha || ehGestor) && rota.status === "EM_ANDAMENTO" && (
                    <button
                      type="button"
                      onClick={() => {
                        setErroForm("");
                        setFinalizando({ rota, km: rota.veiculo?.km ?? "", combustivel: "", observacao: "" });
                      }}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-black"
                    >
                      🏁 Finalizar rota{rota.veiculo ? " e devolver o veículo" : ""}
                    </button>
                  )}
                  {ehGestor && rota.status !== "FINALIZADA" && (
                    <button type="button" onClick={() => abrirForm(rota)} className="btn-secondary px-3 py-2 text-sm">✏️ Editar</button>
                  )}
                  {ehGestor && rota.status !== "EM_ANDAMENTO" && (
                    <button type="button" onClick={() => excluir(rota)} className="px-3 py-2 text-sm font-semibold text-rose-600 hover:underline">Excluir</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Nova / editar rota */}
      <Modal isOpen={Boolean(form)} onClose={() => !enviando && setForm(null)} title={form?.id ? "✏️ Editar rota" : "🚚 Nova rota"} size="md">
        {form && (
          <form onSubmit={salvar} className="space-y-4">
            <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Nome (ex.: Zona Sul — sexta)" className="input-field w-full" required maxLength={120} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold text-gray-700">
                Motorista
                <div className="mt-1">
                  <SelectBusca
                    opcoes={opcoes.motoristas.map((m) => ({ valor: m.id, rotulo: m.nome }))}
                    valor={form.usuarioId}
                    aoMudar={(usuarioId) => setForm((f) => ({ ...f, usuarioId }))}
                    placeholder="Buscar motorista"
                    disabled={form.status === "EM_ANDAMENTO"}
                    required
                  />
                </div>
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Veículo
                <div className="mt-1">
                  <SelectBusca
                    opcoes={opcoes.veiculos.map((v) => ({
                      valor: v.id,
                      rotulo: `${v.emoji || "🚗"} ${v.nome}`,
                      detalhe: v.parada ? "parado" : v.emUso ? "em uso agora" : v.modelo || undefined,
                    }))}
                    valor={form.veiculoId}
                    aoMudar={(veiculoId) => setForm((f) => ({ ...f, veiculoId }))}
                    opcaoVazia="Sem veículo"
                    placeholder="Buscar veículo"
                    disabled={form.status === "EM_ANDAMENTO"}
                  />
                </div>
              </label>
            </div>
            <label className="block text-sm font-semibold text-gray-700">
              Início (data e hora)
              <input
                type="datetime-local"
                value={form.dataInicio}
                onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
                className="input-field mt-1 w-full"
                disabled={form.status === "EM_ANDAMENTO"}
                required
              />
              <span className="mt-1 block text-xs font-normal text-gray-500">No horário a rota começa sozinha e o veículo fica indisponível até o motorista finalizar.</span>
            </label>

            <div className="space-y-2">
              <p className="text-sm font-black text-gray-700">Paradas (em ordem)</p>
              {paradasDoForm.length === 0 && <p className="text-xs text-gray-500">Adicione as lojas. As lojas dos envios desta rota entram sozinhas.</p>}
              <ol className="space-y-1">
                {paradasDoForm.map((p, indice) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span className="w-5 font-black text-gray-400">{indice + 1}</span>
                    <span className="flex-1 font-semibold">{p.nome}</span>
                    <button type="button" onClick={() => moverParada(indice, -1)} className="px-1 text-gray-500" title="Subir">▲</button>
                    <button type="button" onClick={() => moverParada(indice, 1)} className="px-1 text-gray-500" title="Descer">▼</button>
                    <button
                      type="button"
                      onClick={() => (form.id ? removerParada(p.item) : setForm((f) => ({ ...f, paradas: f.paradas.filter((id) => id !== p.id) })))}
                      className="px-1 text-rose-600"
                      title="Tirar"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ol>
              <SelectBusca
                opcoes={opcoes.lojas.map((l) => ({ valor: l.id, rotulo: l.nome, detalhe: l.cidade || undefined }))}
                valor={lojaParaAdicionar}
                aoMudar={adicionarParada}
                placeholder="➕ Adicionar loja"
              />
            </div>

            {erroForm && <p className="text-sm text-rose-600">{erroForm}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} disabled={enviando} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={enviando} className="btn-primary">{enviando ? "Salvando..." : form.id ? "Salvar" : "Criar rota"}</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Finalizar rota */}
      <Modal isOpen={Boolean(finalizando)} onClose={() => !enviando && setFinalizando(null)} title="🏁 Finalizar rota" size="sm">
        {finalizando && (
          <form onSubmit={finalizar} className="space-y-3">
            <p className="text-sm text-gray-600">
              <b>{finalizando.rota.nome}</b> — a data de fim é registrada agora.
            </p>
            {finalizando.rota.veiculo && (
              <>
                <label className="block text-sm font-semibold text-gray-700">
                  KM do veículo agora *
                  <input
                    type="number"
                    min={finalizando.rota.veiculo.km || 0}
                    value={finalizando.km}
                    onChange={(e) => setFinalizando((f) => ({ ...f, km: e.target.value }))}
                    className="input-field mt-1 w-full"
                    required
                  />
                  <span className="text-xs font-normal text-gray-500">Saiu com {finalizando.rota.kmInicial ?? finalizando.rota.veiculo.km} km</span>
                </label>
                <div className="flex flex-wrap gap-1">
                  {COMBUSTIVEL.map((nivel) => (
                    <button
                      key={nivel}
                      type="button"
                      onClick={() => setFinalizando((f) => ({ ...f, combustivel: nivel }))}
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${finalizando.combustivel === nivel ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"}`}
                    >
                      ⛽ {nivel}
                    </button>
                  ))}
                </div>
              </>
            )}
            <input value={finalizando.observacao} onChange={(e) => setFinalizando((f) => ({ ...f, observacao: e.target.value }))} placeholder="Observação (opcional)" className="input-field w-full" />
            {erroForm && <p className="text-sm text-rose-600">{erroForm}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setFinalizando(null)} disabled={enviando} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={enviando} className="btn-primary">{enviando ? "Finalizando..." : "Finalizar"}</button>
            </div>
          </form>
        )}
      </Modal>
      <Footer />
    </div>
  );
}

export default Roteiros;
