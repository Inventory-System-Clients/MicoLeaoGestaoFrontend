import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, Modal } from "../components/UIComponents";
import { SelectBusca } from "../components/SelectBusca";
import { MEDALHAS } from "../utils/metas";
import { obterPerfil } from "../utils/perfis";

// Metas por loja (admin e financeiro): lançar o dinheiro que entrou, definir
// bronze/prata/ouro do mês e a comissão de cada pessoa em cada nível.

const ORDEM = ["bronze", "prata", "ouro"];
const NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const hoje = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
const mudarMes = (mes, quantidade) => {
  const [ano, numero] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, numero - 1 + quantidade, 1)).toISOString().slice(0, 7);
};
const nomeDoMes = (mes) => `${NOMES_MES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
const reais = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const mensagemDeErro = (erro, padrao) => erro?.response?.data?.error || padrao;

function Cartao({ titulo, valor, cor = "text-gray-900", detalhe }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-black ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-gray-400">{detalhe}</p>}
    </div>
  );
}

// Barra com os valores (versão da gestão; a do funcionário não tem R$)
function BarraComValores({ meta }) {
  const escala = meta.valorOuro;
  const largura = Math.min(100, (meta.realizado / escala) * 100);
  const cor = meta.nivel ? MEDALHAS[meta.nivel].cor : "#f97316";
  return (
    <div className="relative pb-10 pt-1">
      <div className="h-4 overflow-hidden rounded-full bg-gray-100 shadow-inner">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: `${largura}%`, background: `linear-gradient(90deg, #fb923c, ${cor})` }}
        />
      </div>
      {ORDEM.map((nivel) => {
        const valor = meta[`valor${nivel[0].toUpperCase()}${nivel.slice(1)}`];
        const alcancado = meta.realizado >= valor;
        return (
          <div
            key={nivel}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${Math.min(100, (valor / escala) * 100)}%` }}
          >
            <div className={`h-6 w-0.5 ${alcancado ? "bg-white" : "bg-gray-300"}`} />
            <span className={`text-sm leading-none ${alcancado ? "" : "opacity-50 grayscale"}`}>{MEDALHAS[nivel].icone}</span>
            <span className="whitespace-nowrap text-[10px] font-bold text-gray-500">{reais(valor).replace(",00", "")}</span>
          </div>
        );
      })}
    </div>
  );
}

const META_VAZIA = { valorBronze: "", valorPrata: "", valorOuro: "", comissoes: [] };
const COMISSAO_VAZIA = { usuarioId: "", tipo: "FIXO", bronze: "", prata: "", ouro: "" };

export function Metas() {
  const [mes, setMes] = useState(() => hoje().slice(0, 7));
  const [dados, setDados] = useState(null);
  const [lancamentos, setLancamentos] = useState([]);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("");
  const [lojaLancamentos, setLojaLancamentos] = useState("");

  const [lancando, setLancando] = useState(null);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [metas, lista] = await Promise.all([
        api.get("/metas", { params: { mes } }),
        api.get("/metas/lancamentos", { params: { mes } }),
      ]);
      setDados(metas.data);
      setLancamentos(lista.data);
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao carregar as metas"));
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const lojas = useMemo(() => dados?.lojas || [], [dados]);
  const resumo = useMemo(() => {
    const comMeta = lojas.filter((l) => l.meta);
    return {
      total: lojas.reduce((soma, l) => soma + l.realizado, 0),
      comMeta: comMeta.length,
      niveis: Object.fromEntries(ORDEM.map((n) => [n, comMeta.filter((l) => l.meta.nivel === n).length])),
      comissoes: comMeta.reduce((soma, l) => soma + l.meta.comissoes.reduce((s, c) => s + c.valorAtual, 0), 0),
    };
  }, [lojas]);

  const termo = busca.trim().toLowerCase();
  const visiveis = lojas.filter(
    (l) =>
      (!termo || l.loja.nome.toLowerCase().includes(termo)) &&
      (filtro === "" ||
        (filtro === "sem" && !l.meta) ||
        (filtro === "com" && l.meta) ||
        (filtro === "nenhum" && l.meta && !l.meta.nivel)),
  );
  const lancamentosVisiveis = lancamentos.filter((l) => !lojaLancamentos || l.lojaId === lojaLancamentos);

  const abrirLancamento = (lojaId = "") => {
    setErroModal("");
    const dia = mes === hoje().slice(0, 7) ? hoje() : `${mes}-01`;
    setLancando({ lojaId, data: dia, valor: "", observacao: "" });
  };

  const salvarLancamento = async () => {
    setSalvando(true);
    setErroModal("");
    try {
      await api.post("/metas/lancamentos", lancando);
      setLancando(null);
      await carregar();
    } catch (e) {
      setErroModal(mensagemDeErro(e, "Erro ao lançar"));
    } finally {
      setSalvando(false);
    }
  };

  const excluirLancamento = async (lancamento) => {
    if (!window.confirm(`Excluir o lançamento de ${reais(lancamento.valor)} da ${lancamento.loja?.nome}?`)) return;
    try {
      await api.delete(`/metas/lancamentos/${lancamento.id}`);
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao excluir"));
    }
  };

  const abrirMeta = (linha) => {
    setErroModal("");
    const meta = linha.meta;
    setEditando({
      loja: linha.loja,
      realizado: linha.realizado,
      id: meta?.id,
      ...(meta
        ? {
            valorBronze: meta.valorBronze,
            valorPrata: meta.valorPrata,
            valorOuro: meta.valorOuro,
            comissoes: meta.comissoes.map((c) => ({
              usuarioId: c.usuarioId,
              tipo: c.tipo,
              bronze: c.bronze,
              prata: c.prata,
              ouro: c.ouro,
            })),
          }
        : META_VAZIA),
    });
  };

  const mudarComissao = (indice, campo, valor) =>
    setEditando((atual) => ({
      ...atual,
      comissoes: atual.comissoes.map((c, i) => (i === indice ? { ...c, [campo]: valor } : c)),
    }));

  const salvarMeta = async () => {
    setSalvando(true);
    setErroModal("");
    try {
      await api.put("/metas", {
        mes,
        lojaId: editando.loja.id,
        valorBronze: editando.valorBronze,
        valorPrata: editando.valorPrata,
        valorOuro: editando.valorOuro,
        comissoes: editando.comissoes.filter((c) => c.usuarioId),
      });
      setEditando(null);
      await carregar();
    } catch (e) {
      setErroModal(mensagemDeErro(e, "Erro ao salvar"));
    } finally {
      setSalvando(false);
    }
  };

  const excluirMeta = async () => {
    if (!window.confirm(`Excluir a meta de ${editando.loja.nome} em ${nomeDoMes(mes)}? Os lançamentos continuam.`)) return;
    try {
      await api.delete(`/metas/${editando.id}`);
      setEditando(null);
      await carregar();
    } catch (e) {
      setErroModal(mensagemDeErro(e, "Erro ao excluir"));
    }
  };

  const copiarMesAnterior = async () => {
    try {
      const { data } = await api.post("/metas/copiar-mes-anterior", { mes });
      setAviso(
        data.copiadas
          ? `${data.copiadas} meta(s) copiada(s) de ${nomeDoMes(mudarMes(mes, -1))}, com as comissões.`
          : `Nada para copiar: ${nomeDoMes(mudarMes(mes, -1))} não tem metas, ou as lojas já têm meta neste mês.`,
      );
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao copiar"));
    }
  };

  // Prévia no modal: quanto cada comissão daria com o realizado de hoje
  const previa = (comissao) => {
    if (!editando) return null;
    const bronze = Number(editando.valorBronze);
    const prata = Number(editando.valorPrata);
    const ouro = Number(editando.valorOuro);
    const r = editando.realizado;
    const nivel = r >= ouro && ouro ? "ouro" : r >= prata && prata ? "prata" : r >= bronze && bronze ? "bronze" : null;
    if (!nivel) return "nenhum nível ainda";
    const taxa = Number(comissao[nivel]) || 0;
    return `${MEDALHAS[nivel].icone} ${reais(comissao.tipo === "PERCENTUAL" ? (r * taxa) / 100 : taxa)}`;
  };

  const usuarios = dados?.usuarios || [];

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Metas por Loja" subtitle="Lance o dinheiro que entrou em cada loja, defina bronze, prata e ouro e a comissão de cada pessoa" icon="🎯" />

        {/* Mês e ações */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMes((m) => mudarMes(m, -1))} className="rounded-lg bg-white px-3 py-2 font-black shadow-sm hover:bg-gray-100">‹</button>
            <p className="min-w-44 text-center text-xl font-black text-gray-900">{nomeDoMes(mes)}</p>
            <button type="button" onClick={() => setMes((m) => mudarMes(m, 1))} className="rounded-lg bg-white px-3 py-2 font-black shadow-sm hover:bg-gray-100">›</button>
            {mes !== hoje().slice(0, 7) && (
              <button type="button" onClick={() => setMes(hoje().slice(0, 7))} className="text-xs font-bold text-blue-600 hover:underline">
                Mês atual
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copiarMesAnterior} className="btn-secondary text-sm">📋 Copiar metas do mês anterior</button>
            <button type="button" onClick={() => abrirLancamento()} className="btn-primary text-sm">➕ Lançar dinheiro</button>
          </div>
        </div>

        {erro && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{erro}</div>}
        {aviso && (
          <div className="mb-4 flex justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <span>{aviso}</span>
            <button type="button" onClick={() => setAviso("")}>✕</button>
          </div>
        )}

        {!dados ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Cartao titulo="Entrou no mês" valor={reais(resumo.total)} cor="text-emerald-600" detalhe={`${lancamentos.length} lançamento(s)`} />
              <Cartao titulo="Lojas com meta" valor={`${resumo.comMeta} de ${lojas.length}`} />
              <Cartao
                titulo="Níveis alcançados"
                valor={`${MEDALHAS.ouro.icone} ${resumo.niveis.ouro}  ${MEDALHAS.prata.icone} ${resumo.niveis.prata}  ${MEDALHAS.bronze.icone} ${resumo.niveis.bronze}`}
              />
              <Cartao titulo="Comissões até agora" valor={reais(resumo.comissoes)} cor="text-orange-600" detalhe="Pelo nível de hoje" />
            </div>

            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔍 Buscar loja" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-64" />
              <div className="flex flex-wrap gap-1">
                {[
                  ["", "Todas"],
                  ["com", "Com meta"],
                  ["sem", "Sem meta"],
                  ["nenhum", "Abaixo do bronze"],
                ].map(([chave, rotulo]) => (
                  <button
                    key={chave}
                    type="button"
                    onClick={() => setFiltro(chave)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${filtro === chave ? "bg-gray-900 text-white" : "bg-white text-gray-600 shadow-sm hover:bg-gray-100"}`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {visiveis.map((linha) => {
                const meta = linha.meta;
                const proximo = meta && ORDEM.find((n) => linha.realizado < meta[`valor${n[0].toUpperCase()}${n.slice(1)}`]);
                return (
                  <div key={linha.loja.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-gray-900">{linha.loja.nome}</p>
                        <p className="text-sm text-gray-500">
                          Entrou <b className="text-gray-900">{reais(linha.realizado)}</b>
                          {meta && proximo && (
                            <> · faltam {reais(meta[`valor${proximo[0].toUpperCase()}${proximo.slice(1)}`] - linha.realizado)} para {MEDALHAS[proximo].rotulo}</>
                          )}
                        </p>
                      </div>
                      {meta?.nivel ? (
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${MEDALHAS[meta.nivel].fundo}`}>
                          {MEDALHAS[meta.nivel].icone} {MEDALHAS[meta.nivel].rotulo} · {Math.round(meta.percentual)}%
                        </span>
                      ) : meta ? (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500">{Math.round(meta.percentual)}%</span>
                      ) : null}
                    </div>

                    {meta ? (
                      <>
                        <BarraComValores meta={{ ...meta, realizado: linha.realizado }} />
                        {meta.comissoes.length > 0 ? (
                          <ul className="mt-1 divide-y divide-gray-100 rounded-lg bg-gray-50 text-sm">
                            {meta.comissoes.map((c) => (
                              <li key={c.id} className="flex items-center justify-between px-3 py-2">
                                <span>
                                  <b>{c.usuario?.nome}</b>{" "}
                                  <span className="text-xs text-gray-500">
                                    {c.tipo === "PERCENTUAL"
                                      ? `${c.bronze}% / ${c.prata}% / ${c.ouro}%`
                                      : `${reais(c.bronze)} / ${reais(c.prata)} / ${reais(c.ouro)}`}
                                  </span>
                                </span>
                                <span className={`font-black ${c.valorAtual ? "text-orange-600" : "text-gray-400"}`}>{reais(c.valorAtual)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-xs text-gray-400">Ninguém com comissão nesta meta.</p>
                        )}
                      </>
                    ) : (
                      <p className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-sm text-gray-400">Sem meta em {nomeDoMes(mes)}</p>
                    )}

                    <div className="mt-4 flex justify-end gap-2">
                      <button type="button" onClick={() => abrirLancamento(linha.loja.id)} className="btn-secondary px-3 py-1.5 text-sm">➕ Lançar</button>
                      <button type="button" onClick={() => abrirMeta(linha)} className="btn-primary px-3 py-1.5 text-sm">{meta ? "Editar meta" : "Criar meta"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {visiveis.length === 0 && <p className="py-8 text-center text-sm text-gray-500">Nenhuma loja nesse filtro.</p>}

            {/* Lançamentos do mês */}
            <div className="mt-10 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl font-black text-gray-900">Lançamentos de {nomeDoMes(mes)}</h2>
                <div className="w-full sm:w-72">
                  <SelectBusca
                    opcoes={lojas.map((l) => ({ valor: l.loja.id, rotulo: l.loja.nome }))}
                    valor={lojaLancamentos}
                    aoMudar={setLojaLancamentos}
                    opcaoVazia="Todas as lojas"
                    placeholder="Todas as lojas"
                    className="text-sm"
                  />
                </div>
              </div>
              {lancamentosVisiveis.length === 0 ? (
                <p className="rounded-xl border border-dashed border-gray-300 bg-white/60 p-6 text-center text-sm text-gray-500">Nenhum lançamento.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Data</th>
                        <th className="px-3 py-2">Loja</th>
                        <th className="px-3 py-2 text-right">Valor</th>
                        <th className="px-3 py-2">Observação</th>
                        <th className="px-3 py-2">Lançado por</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lancamentosVisiveis.map((l) => (
                        <tr key={l.id}>
                          <td className="whitespace-nowrap px-3 py-2">{l.data.split("-").reverse().join("/")}</td>
                          <td className="px-3 py-2 font-semibold">{l.loja?.nome}</td>
                          <td className={`px-3 py-2 text-right font-bold ${l.valor < 0 ? "text-rose-600" : "text-emerald-700"}`}>{reais(l.valor)}</td>
                          <td className="px-3 py-2 text-gray-600">{l.observacao || "-"}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{l.criadoPor?.nome || "-"}</td>
                          <td className="px-3 py-2 text-right">
                            <button type="button" onClick={() => excluirLancamento(l)} className="text-xs font-bold text-rose-600 hover:underline">Excluir</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-black">
                      <tr>
                        <td className="px-3 py-2" colSpan={2}>Total</td>
                        <td className="px-3 py-2 text-right">{reais(lancamentosVisiveis.reduce((s, l) => s + l.valor, 0))}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Lançar dinheiro */}
      <Modal isOpen={Boolean(lancando)} onClose={() => !salvando && setLancando(null)} title="Lançar dinheiro" size="sm">
        {lancando && (
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">
              Loja
              <div className="mt-1">
                <SelectBusca
                  opcoes={lojas.map((l) => ({ valor: l.loja.id, rotulo: l.loja.nome }))}
                  valor={lancando.lojaId}
                  aoMudar={(lojaId) => setLancando((l) => ({ ...l, lojaId }))}
                  placeholder="Buscar loja"
                />
              </div>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-gray-700">
                Data
                <input type="date" value={lancando.data} onChange={(e) => setLancando((l) => ({ ...l, data: e.target.value }))} className="input-field mt-1 w-full" />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Valor (R$)
                <input type="number" step="0.01" inputMode="decimal" value={lancando.valor} onChange={(e) => setLancando((l) => ({ ...l, valor: e.target.value }))} placeholder="0,00" className="input-field mt-1 w-full" />
              </label>
            </div>
            <input value={lancando.observacao} onChange={(e) => setLancando((l) => ({ ...l, observacao: e.target.value }))} maxLength={255} placeholder="Observação (opcional)" className="input-field w-full" />
            <p className="text-xs text-gray-500">Para corrigir, lance um valor negativo ou exclua o lançamento errado.</p>
            {erroModal && <p className="text-sm text-rose-600">{erroModal}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setLancando(null)} disabled={salvando} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={salvarLancamento} disabled={salvando || !lancando.lojaId} className="btn-primary">{salvando ? "Salvando..." : "Lançar"}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Meta e comissões */}
      <Modal isOpen={Boolean(editando)} onClose={() => !salvando && setEditando(null)} title={editando ? `Meta · ${editando.loja.nome}` : ""} size="lg">
        {editando && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600">
              {nomeDoMes(mes)} · já entrou <b>{reais(editando.realizado)}</b>
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ORDEM.map((nivel) => {
                const campo = `valor${nivel[0].toUpperCase()}${nivel.slice(1)}`;
                return (
                  <label key={nivel} className="text-sm font-bold text-gray-700">
                    {MEDALHAS[nivel].icone} {MEDALHAS[nivel].rotulo} (R$)
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editando[campo]}
                      onChange={(e) => setEditando((m) => ({ ...m, [campo]: e.target.value }))}
                      className="input-field mt-1 w-full"
                    />
                  </label>
                );
              })}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-gray-900">Comissões</h4>
                <button
                  type="button"
                  onClick={() => setEditando((m) => ({ ...m, comissoes: [...m.comissoes, { ...COMISSAO_VAZIA }] }))}
                  className="text-sm font-bold text-blue-600 hover:underline"
                >
                  ➕ Adicionar pessoa
                </button>
              </div>
              {editando.comissoes.length === 0 && (
                <p className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-sm text-gray-400">
                  Ninguém ainda. Quem tiver comissão aqui vê a barrinha desta loja (só a %).
                </p>
              )}
              {editando.comissoes.map((comissao, indice) => {
                const escolhidos = editando.comissoes.map((c) => c.usuarioId);
                return (
                  <div key={indice} className="grid grid-cols-1 items-end gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3 md:grid-cols-12">
                    <div className="md:col-span-4">
                      <SelectBusca
                        opcoes={usuarios
                          .filter((u) => u.id === comissao.usuarioId || !escolhidos.includes(u.id))
                          .map((u) => ({ valor: u.id, rotulo: u.nome, detalhe: obterPerfil(u.role).curto }))}
                        valor={comissao.usuarioId}
                        aoMudar={(usuarioId) => mudarComissao(indice, "usuarioId", usuarioId)}
                        placeholder="Buscar pessoa"
                        className="text-sm"
                      />
                    </div>
                    <div className="flex overflow-hidden rounded-lg border border-gray-300 md:col-span-2">
                      {[
                        ["FIXO", "R$"],
                        ["PERCENTUAL", "%"],
                      ].map(([tipo, rotulo]) => (
                        <button
                          key={tipo}
                          type="button"
                          onClick={() => mudarComissao(indice, "tipo", tipo)}
                          className={`flex-1 py-2 text-sm font-black ${comissao.tipo === tipo ? "bg-gray-900 text-white" : "bg-white text-gray-600"}`}
                        >
                          {rotulo}
                        </button>
                      ))}
                    </div>
                    {ORDEM.map((nivel) => (
                      <label key={nivel} className="text-xs font-bold text-gray-500 md:col-span-1">
                        {MEDALHAS[nivel].icone}
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={comissao[nivel]}
                          onChange={(e) => mudarComissao(indice, nivel, e.target.value)}
                          placeholder={comissao.tipo === "PERCENTUAL" ? "%" : "R$"}
                          className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                        />
                      </label>
                    ))}
                    <div className="flex items-center justify-between gap-2 text-xs md:col-span-2">
                      <span className="text-gray-500" title="Com o que entrou até agora">Hoje: {previa(comissao)}</span>
                      <button
                        type="button"
                        onClick={() => setEditando((m) => ({ ...m, comissoes: m.comissoes.filter((_, i) => i !== indice) }))}
                        className="font-bold text-rose-600"
                        title="Tirar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {erroModal && <p className="text-sm text-rose-600">{erroModal}</p>}
            <div className="flex flex-wrap justify-between gap-2">
              {editando.id ? (
                <button type="button" onClick={excluirMeta} className="text-sm font-bold text-rose-600 hover:underline">Excluir meta</button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditando(null)} disabled={salvando} className="btn-secondary">Cancelar</button>
                <button type="button" onClick={salvarMeta} disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : "Salvar meta"}</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
      <Footer />
    </div>
  );
}

export default Metas;
