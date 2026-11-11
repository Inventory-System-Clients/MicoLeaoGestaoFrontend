import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, Modal } from "../components/UIComponents";
import { MapaPonto } from "../components/MapaPonto";
import {
  TIPOS_BATIDA,
  SITUACAO_DIA,
  DIAS_SEMANA,
  PERIODOS_RAPIDOS,
  formatarMinutos,
  formatarHora,
  formatarDataHora,
  formatarDia,
  formatarDistancia,
  hojeEmBrasilia,
  pegarLocalizacao,
  localMaisProximo,
} from "../utils/ponto";

// Tela do funcionário: bater o ponto (só quando ele clica — sair do sistema
// não bate nada) e ver o próprio histórico de horas.

const ORDEM_DO_DIA = ["ENTRADA", "SAIDA_INTERVALO", "VOLTA_INTERVALO", "SAIDA"];
const mensagemDeErro = (erro, padrao) => erro?.response?.data?.error || erro?.message || padrao;

function Relogio() {
  const [agora, setAgora] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="text-center">
      <p className="font-mono text-5xl font-black tracking-tight text-gray-900 sm:text-6xl">
        {agora.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}
      </p>
      <p className="mt-1 text-sm font-medium capitalize text-gray-500">
        {agora.toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          timeZone: "America/Sao_Paulo",
        })}
      </p>
    </div>
  );
}

function CartaoTotal({ titulo, valor, destaque = "text-gray-900", detalhe }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-black ${destaque}`}>{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-gray-400">{detalhe}</p>}
    </div>
  );
}

export function MeuPonto() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [periodo, setPeriodo] = useState(() => PERIODOS_RAPIDOS[2].calcular(hojeEmBrasilia()));
  const [periodoRapido, setPeriodoRapido] = useState("mes");

  const [posicao, setPosicao] = useState(null);
  const [lendoGps, setLendoGps] = useState(false);
  const [erroGps, setErroGps] = useState("");

  const [confirmando, setConfirmando] = useState(null);
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [comprovante, setComprovante] = useState(null);
  const [diaAberto, setDiaAberto] = useState(null);
  const [minutoAtual, setMinutoAtual] = useState(Date.now());

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/ponto/meu", { params: periodo });
      setDados(data);
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao carregar o ponto"));
    } finally {
      setCarregando(false);
    }
  }, [periodo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const lerGps = useCallback(async () => {
    setLendoGps(true);
    setErroGps("");
    try {
      setPosicao({ ...(await pegarLocalizacao()), lidaEm: new Date() });
    } catch (e) {
      setPosicao(null);
      setErroGps(e.message);
    } finally {
      setLendoGps(false);
    }
  }, []);

  useEffect(() => {
    lerGps();
  }, [lerGps]);

  // Contador do dia anda sozinho enquanto está trabalhando
  useEffect(() => {
    const timer = setInterval(() => setMinutoAtual(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const proximo = useMemo(() => localMaisProximo(posicao, dados?.locais), [posicao, dados?.locais]);
  const hoje = dados?.hoje;
  const ultimaDeHoje = hoje?.batidas?.[hoje.batidas.length - 1];
  const trabalhando =
    hoje?.situacao === "EM_ANDAMENTO" && ["ENTRADA", "VOLTA_INTERVALO"].includes(ultimaDeHoje?.tipo);
  const trabalhadoHoje =
    (hoje?.trabalhadoMinutos || 0) +
    (trabalhando && dados?.agora
      ? Math.max(0, Math.floor((minutoAtual - new Date(dados.agora).getTime()) / 60000))
      : 0);
  const jornada = dados?.usuario?.jornadaDiariaMinutos || 480;
  const progresso = Math.min(100, Math.round((trabalhadoHoje / jornada) * 100));

  const status = (() => {
    if (!hoje || hoje.batidas.length === 0) return { texto: "Você ainda não bateu o ponto hoje", cor: "bg-slate-100 text-slate-700" };
    if (hoje.situacao === "EM_ANDAMENTO") {
      return ultimaDeHoje?.tipo === "SAIDA_INTERVALO"
        ? { texto: `Em intervalo desde ${formatarHora(ultimaDeHoje.dataHora)}`, cor: "bg-amber-100 text-amber-800" }
        : { texto: `Trabalhando desde ${formatarHora(ultimaDeHoje?.dataHora)}`, cor: "bg-emerald-100 text-emerald-800" };
    }
    if (hoje.situacao === "INCOMPLETO") return { texto: "Batidas de hoje incompletas — avise o administrador", cor: "bg-rose-100 text-rose-800" };
    return { texto: `Dia encerrado às ${formatarHora(ultimaDeHoje?.dataHora)}`, cor: "bg-gray-100 text-gray-700" };
  })();

  const bater = async () => {
    if (!confirmando) return;
    setEnviando(true);
    try {
      // Lê de novo na hora da batida: a posição tem que ser a de agora
      const atual = await pegarLocalizacao();
      setPosicao({ ...atual, lidaEm: new Date() });
      const { data } = await api.post("/ponto/batidas", {
        tipo: confirmando,
        ...atual,
        observacao: observacao.trim() || undefined,
      });
      setComprovante(data);
      setConfirmando(null);
      setObservacao("");
      await carregar();
    } catch (e) {
      setErroGps("");
      setConfirmando(null);
      setErro(mensagemDeErro(e, "Não foi possível bater o ponto"));
      await carregar();
    } finally {
      setEnviando(false);
    }
  };

  const escolherPeriodoRapido = (opcao) => {
    setPeriodoRapido(opcao.chave);
    setPeriodo(opcao.calcular(hojeEmBrasilia()));
  };

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Meu Ponto" subtitle="Entrada, intervalo e saída — o ponto só é registrado quando você toca no botão" icon="⏱️" />

        {erro && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <span>{erro}</span>
            <button type="button" onClick={() => setErro("")} className="font-bold">✕</button>
          </div>
        )}

        {dados?.semPonto ? (
          <div className="card text-center text-gray-600">
            Administrador não bate ponto. Para acompanhar a equipe, use o <b>Controle de Ponto</b>.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* Bater o ponto */}
            <div className="card space-y-5 lg:col-span-3">
              <Relogio />
              <div className={`rounded-xl px-4 py-3 text-center text-sm font-bold ${status.cor}`}>{status.texto}</div>

              {/* Localização */}
              <div
                className={`rounded-xl border p-4 text-sm ${
                  erroGps
                    ? "border-rose-200 bg-rose-50"
                    : proximo?.dentro
                      ? "border-emerald-200 bg-emerald-50"
                      : posicao
                        ? "border-amber-200 bg-amber-50"
                        : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-800">📍 Sua localização</p>
                    {lendoGps && <p className="mt-1 text-gray-600">Procurando sua localização...</p>}
                    {!lendoGps && erroGps && <p className="mt-1 text-rose-700">{erroGps}</p>}
                    {!lendoGps && posicao && (
                      <>
                        {proximo ? (
                          <p className="mt-1 text-gray-700">
                            {proximo.dentro ? "✅ Você está em " : "⚠️ Fora dos locais cadastrados. Mais perto: "}
                            <b>{proximo.local.nome}</b> ({formatarDistancia(proximo.distancia)})
                          </p>
                        ) : (
                          <p className="mt-1 text-gray-700">Localização encontrada.</p>
                        )}
                        <p className="mt-0.5 text-xs text-gray-500">
                          Precisão de ~{posicao.precisao} m
                          {posicao.precisao > 100 && " (baixa — se puder, vá para um lugar aberto)"}
                          {proximo && !proximo.dentro && " · Pode bater mesmo assim; o administrador verá onde foi."}
                        </p>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={lerGps}
                    disabled={lendoGps}
                    className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {lendoGps ? "..." : "Atualizar"}
                  </button>
                </div>
              </div>

              {/* Botões */}
              <div className={`grid gap-3 ${dados?.proximas?.length > 1 ? "sm:grid-cols-2" : ""}`}>
                {dados?.proximas?.map((tipo, indice) => (
                  <button
                    key={tipo}
                    type="button"
                    disabled={!posicao || lendoGps}
                    onClick={() => setConfirmando(tipo)}
                    className={`flex min-h-16 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-lg font-black text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
                      TIPOS_BATIDA[tipo].cor
                    } ${indice > 0 ? "sm:text-base" : ""}`}
                  >
                    <span>{TIPOS_BATIDA[tipo].icone}</span>
                    {TIPOS_BATIDA[tipo].acao}
                  </button>
                ))}
              </div>
              {!posicao && !lendoGps && (
                <p className="text-center text-xs text-gray-500">Para bater o ponto é preciso liberar a localização.</p>
              )}

              {(posicao || dados?.locais?.length > 0) && (
                <MapaPonto
                  altura={220}
                  locais={dados?.locais || []}
                  enquadrar={posicao ? "pontos" : "tudo"}
                  pontos={
                    posicao
                      ? [{ id: "eu", latitude: posicao.latitude, longitude: posicao.longitude, cor: "#2563eb", titulo: "Você está aqui" }]
                      : []
                  }
                />
              )}
            </div>

            {/* Hoje */}
            <div className="card space-y-4 lg:col-span-2">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-black text-gray-900">Hoje</h2>
                <span className="text-xs text-gray-500">Jornada de {formatarMinutos(jornada)}</span>
              </div>
              <div>
                <div className="flex items-end justify-between">
                  <p className="text-4xl font-black text-gray-900">{formatarMinutos(trabalhadoHoje)}</p>
                  <p className="text-sm font-semibold text-gray-500">
                    {trabalhadoHoje >= jornada
                      ? `+${formatarMinutos(trabalhadoHoje - jornada)} além da jornada`
                      : `faltam ${formatarMinutos(jornada - trabalhadoHoje)}`}
                  </p>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${trabalhadoHoje > jornada ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${progresso}%` }}
                  />
                </div>
              </div>
              <ol className="space-y-2">
                {ORDEM_DO_DIA.map((tipo) => {
                  const batida = hoje?.batidas?.find((b) => b.tipo === tipo);
                  return (
                    <li
                      key={tipo}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                        batida ? "border-gray-200 bg-white" : "border-dashed border-gray-200 bg-gray-50 text-gray-400"
                      }`}
                    >
                      <span className="flex items-center gap-2 font-semibold">
                        <span>{TIPOS_BATIDA[tipo].icone}</span>
                        {TIPOS_BATIDA[tipo].rotulo}
                      </span>
                      <span className="flex items-center gap-2">
                        {batida?.foraDoLocal && <span title="Fora dos locais cadastrados">⚠️</span>}
                        <span className="font-mono font-bold">{batida ? formatarHora(batida.dataHora) : "--:--"}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
              {hoje?.intervaloMinutos > 0 && (
                <p className="text-xs text-gray-500">Intervalo: {formatarMinutos(hoje.intervaloMinutos)}</p>
              )}
              {hoje?.avisos?.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  {hoje.avisos.map((aviso) => (
                    <li key={aviso}>⚠️ {aviso}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Histórico */}
        {!dados?.semPonto && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <h2 className="text-2xl font-black text-gray-900">Meu histórico</h2>
              <div className="flex flex-wrap items-end gap-2">
                {PERIODOS_RAPIDOS.map((opcao) => (
                  <button
                    key={opcao.chave}
                    type="button"
                    onClick={() => escolherPeriodoRapido(opcao)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      periodoRapido === opcao.chave ? "bg-gray-900 text-white" : "bg-white text-gray-600 shadow-sm hover:bg-gray-100"
                    }`}
                  >
                    {opcao.rotulo}
                  </button>
                ))}
                <input
                  type="date"
                  value={periodo.inicio}
                  max={periodo.fim}
                  onChange={(e) => {
                    setPeriodoRapido("");
                    setPeriodo((p) => ({ ...p, inicio: e.target.value }));
                  }}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                />
                <input
                  type="date"
                  value={periodo.fim}
                  min={periodo.inicio}
                  max={hojeEmBrasilia()}
                  onChange={(e) => {
                    setPeriodoRapido("");
                    setPeriodo((p) => ({ ...p, fim: e.target.value }));
                  }}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <CartaoTotal titulo="Trabalhado" valor={formatarMinutos(dados?.totais?.trabalhadoMinutos)} detalhe={`${dados?.totais?.diasTrabalhados || 0} dia(s)`} />
              <CartaoTotal titulo="Horas extras" valor={formatarMinutos(dados?.totais?.extraMinutos)} destaque="text-emerald-600" />
              <CartaoTotal titulo="Horas a menos" valor={formatarMinutos(dados?.totais?.debitoMinutos)} destaque="text-rose-600" />
              <CartaoTotal
                titulo="Saldo"
                valor={formatarMinutos(dados?.totais?.saldoMinutos, { sinal: true })}
                destaque={(dados?.totais?.saldoMinutos || 0) >= 0 ? "text-emerald-600" : "text-rose-600"}
                detalhe="Tolerância de 10 min por dia"
              />
            </div>

            <div className="space-y-2">
              {dados?.dias?.filter((dia) => dia.batidas.length > 0).length === 0 && (
                <div className="card text-center text-sm text-gray-500">Nenhuma batida no período.</div>
              )}
              {dados?.dias
                ?.filter((dia) => dia.batidas.length > 0)
                .map((dia) => {
                  const aberto = diaAberto === dia.dia;
                  return (
                    <div key={dia.dia} className="rounded-xl border border-gray-100 bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={() => setDiaAberto(aberto ? null : dia.dia)}
                        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className="w-16">
                          <p className="text-lg font-black text-gray-900">{formatarDia(dia.dia)}</p>
                          <p className="text-xs text-gray-500">{DIAS_SEMANA[dia.diaDaSemana]}</p>
                        </div>
                        <div className="flex flex-1 flex-wrap gap-1.5">
                          {dia.batidas.map((batida) => (
                            <span key={batida.id} className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs font-bold text-gray-700" title={TIPOS_BATIDA[batida.tipo].rotulo}>
                              {TIPOS_BATIDA[batida.tipo].icone} {formatarHora(batida.dataHora)}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="font-bold text-gray-900">{formatarMinutos(dia.trabalhadoMinutos)}</span>
                          {dia.extraMinutos > 0 && <span className="font-bold text-emerald-600">+{formatarMinutos(dia.extraMinutos)}</span>}
                          {dia.debitoMinutos > 0 && <span className="font-bold text-rose-600">-{formatarMinutos(dia.debitoMinutos)}</span>}
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${SITUACAO_DIA[dia.situacao].classe}`}>
                            {SITUACAO_DIA[dia.situacao].rotulo}
                          </span>
                          {dia.avisos.length > 0 && <span title={dia.avisos.join("\n")}>⚠️</span>}
                        </div>
                      </button>
                      {aberto && (
                        <div className="space-y-2 border-t border-gray-100 px-4 py-3 text-sm">
                          {dia.batidas.map((batida) => (
                            <div key={batida.id} className="flex flex-wrap items-center justify-between gap-2">
                              <span>
                                {TIPOS_BATIDA[batida.tipo].icone} <b>{TIPOS_BATIDA[batida.tipo].rotulo}</b> às{" "}
                                {formatarHora(batida.dataHora)}
                                {batida.origem === "AJUSTE" && (
                                  <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-bold text-violet-700">
                                    Lançada pelo admin
                                  </span>
                                )}
                              </span>
                              <span className="text-xs text-gray-500">
                                {batida.local ? `${batida.local.nome} · ${formatarDistancia(batida.distanciaMetros)}` : batida.origem === "AJUSTE" ? batida.motivoAjuste : "Sem local cadastrado"}
                                {batida.foraDoLocal && " · fora do local"}
                              </span>
                            </div>
                          ))}
                          {dia.intervaloMinutos > 0 && <p className="text-xs text-gray-500">Intervalo: {formatarMinutos(dia.intervaloMinutos)}</p>}
                          {dia.avisos.map((aviso) => (
                            <p key={aviso} className="text-xs text-amber-700">⚠️ {aviso}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Confirmação: a batida só acontece aqui */}
      <Modal isOpen={Boolean(confirmando)} onClose={() => !enviando && setConfirmando(null)} title="Confirmar batida" size="sm">
        {confirmando && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 text-center text-white ${TIPOS_BATIDA[confirmando].cor}`}>
              <p className="text-3xl">{TIPOS_BATIDA[confirmando].icone}</p>
              <p className="text-xl font-black">{TIPOS_BATIDA[confirmando].rotulo}</p>
              <p className="text-sm opacity-90">Agora, {formatarHora(new Date())}</p>
            </div>
            {proximo && (
              <p className="text-center text-sm text-gray-600">
                {proximo.dentro ? "Em " : "Fora dos locais · mais perto: "}
                <b>{proximo.local.nome}</b> ({formatarDistancia(proximo.distancia)})
              </p>
            )}
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              maxLength={255}
              rows={2}
              placeholder="Observação (opcional) — ex.: entrega no cliente"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setConfirmando(null)} disabled={enviando} className="btn-secondary">
                Cancelar
              </button>
              <button type="button" onClick={bater} disabled={enviando} className="btn-primary">
                {enviando ? "Registrando..." : "Confirmar"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Comprovante */}
      <Modal isOpen={Boolean(comprovante)} onClose={() => setComprovante(null)} title="Ponto registrado ✅" size="sm">
        {comprovante && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 font-mono">
              <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-500">Comprovante de ponto</p>
              <p className="mt-3"><b>Nº:</b> {String(comprovante.nsr).padStart(9, "0")}</p>
              <p><b>Nome:</b> {dados?.usuario?.nome}</p>
              <p><b>Batida:</b> {TIPOS_BATIDA[comprovante.tipo].rotulo}</p>
              <p><b>Data/hora:</b> {formatarDataHora(comprovante.dataHora)}</p>
              <p><b>Local:</b> {comprovante.local?.nome || "-"} ({formatarDistancia(comprovante.distanciaMetros)})</p>
              {comprovante.foraDoLocal && <p className="text-amber-700">Registrado fora dos locais cadastrados</p>}
            </div>
            <button type="button" onClick={() => setComprovante(null)} className="btn-primary w-full">
              OK
            </button>
          </div>
        )}
      </Modal>
      <Footer />
    </div>
  );
}

export default MeuPonto;
