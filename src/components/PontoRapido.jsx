import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { Modal } from "./UIComponents";
import {
  TIPOS_BATIDA,
  formatarHora,
  formatarDataHora,
  formatarDistancia,
  pegarLocalizacao,
} from "../utils/ponto";

// Ponto sem sair da tela de trabalho (mesmas regras de Meu Ponto):
// - antes da entrada: cartão grande "Bater entrada" (aparece logo após o login)
// - depois: barra discreta fixa embaixo, com intervalo/volta/saída
// A batida só acontece no "Confirmar" — sair do sistema não bate nada.
const mensagemDeErro = (erro, padrao) => erro?.response?.data?.error || erro?.message || padrao;

export function PontoRapido({ aoMudar }) {
  const [dados, setDados] = useState(null);
  const [confirmando, setConfirmando] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [comprovante, setComprovante] = useState(null);
  const [adiado, setAdiado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/ponto/meu");
      setDados(data);
      aoMudar?.(data);
    } catch {
      setDados(null);
    }
  }, [aoMudar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const bater = async () => {
    setEnviando(true);
    setErro("");
    try {
      const posicao = await pegarLocalizacao();
      const { data } = await api.post("/ponto/batidas", { tipo: confirmando, ...posicao });
      setComprovante(data);
      setConfirmando(null);
      await carregar();
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível bater o ponto"));
    } finally {
      setEnviando(false);
    }
  };

  if (!dados || dados.semPonto) return null;

  const hoje = dados.hoje;
  const ultima = hoje?.batidas?.[hoje.batidas.length - 1];
  const precisaEntrada = dados.proximas?.[0] === "ENTRADA";
  const encerrou = precisaEntrada && hoje?.situacao === "COMPLETO";

  const modais = (
    <>
      <Modal isOpen={Boolean(confirmando)} onClose={() => !enviando && setConfirmando(null)} title="Confirmar ponto" size="sm">
        {confirmando && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 text-center text-white ${TIPOS_BATIDA[confirmando].cor}`}>
              <p className="text-3xl">{TIPOS_BATIDA[confirmando].icone}</p>
              <p className="text-xl font-black">{TIPOS_BATIDA[confirmando].rotulo}</p>
              <p className="text-sm opacity-90">Agora, {formatarHora(new Date())}</p>
            </div>
            <p className="text-center text-xs text-gray-500">A localização é lida na hora de confirmar.</p>
            {erro && <p className="text-center text-sm text-rose-600">{erro}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setConfirmando(null)} disabled={enviando} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={bater} disabled={enviando} className="btn-primary">
                {enviando ? "Registrando..." : "Confirmar"}
              </button>
            </div>
          </div>
        )}
      </Modal>
      <Modal isOpen={Boolean(comprovante)} onClose={() => setComprovante(null)} title="Ponto registrado ✅" size="sm">
        {comprovante && (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4 font-mono">
              <p><b>Nº:</b> {String(comprovante.nsr).padStart(9, "0")}</p>
              <p><b>Batida:</b> {TIPOS_BATIDA[comprovante.tipo].rotulo}</p>
              <p><b>Data/hora:</b> {formatarDataHora(comprovante.dataHora)}</p>
              <p><b>Local:</b> {comprovante.local?.nome || "-"} ({formatarDistancia(comprovante.distanciaMetros)})</p>
            </div>
            <button type="button" onClick={() => setComprovante(null)} className="btn-primary w-full">OK</button>
          </div>
        )}
      </Modal>
    </>
  );

  // Ainda não entrou: cartão grande no topo
  if (precisaEntrada && !adiado) {
    return (
      <>
        <div className="mb-6 rounded-2xl border-2 border-emerald-200 bg-white p-6 text-center shadow-lg">
          <p className="text-4xl">⏱️</p>
          <h2 className="mt-2 text-2xl font-black text-gray-900">
            {encerrou ? "Você já encerrou o dia" : "Bom trabalho! Bata o ponto para começar"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {encerrou
              ? `Saída registrada às ${formatarHora(ultima?.dataHora)}. Se voltou a trabalhar, bata uma nova entrada.`
              : "Sua localização é registrada junto com o horário."}
          </p>
          <button
            type="button"
            onClick={() => {
              setErro("");
              setConfirmando("ENTRADA");
            }}
            className="mt-5 inline-flex min-h-14 w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 text-lg font-black text-white shadow-lg transition hover:brightness-110 active:scale-[0.98]"
          >
            🟢 Bater entrada
          </button>
          <button type="button" onClick={() => setAdiado(true)} className="mt-3 block w-full text-xs font-semibold text-gray-400 hover:text-gray-600">
            Agora não
          </button>
        </div>
        {modais}
      </>
    );
  }
  if (precisaEntrada) return modais;

  // Trabalhando: barra discreta embaixo
  const emIntervalo = ultima?.tipo === "SAIDA_INTERVALO";
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="text-xs text-gray-600">
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${emIntervalo ? "bg-amber-500" : "bg-emerald-500"}`} />
            {emIntervalo ? "Em intervalo" : "Trabalhando"} desde <b>{formatarHora(ultima?.dataHora)}</b>
          </p>
          <div className="flex gap-2">
            {dados.proximas.map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => {
                  setErro("");
                  setConfirmando(tipo);
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                {TIPOS_BATIDA[tipo].icone} {tipo === "SAIDA_INTERVALO" ? "Almoço" : tipo === "VOLTA_INTERVALO" ? "Voltei" : "Saída"}
              </button>
            ))}
          </div>
        </div>
      </div>
      {modais}
    </>
  );
}

export default PontoRapido;
