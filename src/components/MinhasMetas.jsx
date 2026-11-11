import { useEffect, useState } from "react";
import api from "../services/api";
import { MEDALHAS } from "../utils/metas";

// Barra de progresso das metas das lojas em que a pessoa tem comissão.
// Só porcentagem e nível: a API não manda nenhum valor em R$.
// Não aparece nada se a pessoa não tem meta no mês.

const ORDEM = ["bronze", "prata", "ouro"];

const formatarPorcento = (valor) => `${Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function BarraMeta({ meta, ritmo }) {
  // Começa vazia e enche (animação ao abrir)
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setLargura(Math.min(100, meta.percentual)), 80);
    return () => clearTimeout(timer);
  }, [meta.percentual]);

  const proximo = ORDEM.find((nivel) => meta.percentual < meta.marcos[nivel]);
  const faltam = proximo ? Math.max(1, Math.ceil(meta.marcos[proximo] - meta.percentual)) : 0;
  const cor = meta.nivel ? MEDALHAS[meta.nivel].cor : "#f97316";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-gray-900">{meta.loja}</p>
          <p className="text-xs text-gray-500">
            {proximo
              ? `Faltam ${faltam}% para o ${MEDALHAS[proximo].rotulo} ${MEDALHAS[proximo].icone}`
              : "Meta Ouro batida! 🏆"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black" style={{ color: cor }}>
            {formatarPorcento(meta.percentual)}
          </p>
          {meta.nivel && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${MEDALHAS[meta.nivel].fundo}`}>
              {MEDALHAS[meta.nivel].icone} {MEDALHAS[meta.nivel].rotulo}
            </span>
          )}
        </div>
      </div>

      <div className="relative pb-7 pt-1">
        <div className="relative h-5 overflow-hidden rounded-full bg-gray-100 shadow-inner">
          <div
            className="relative h-full rounded-full transition-[width] duration-[1600ms] ease-out"
            style={{
              width: `${largura}%`,
              background: `linear-gradient(90deg, #fb923c, ${cor})`,
            }}
          >
            {/* Brilho passando na barra */}
            <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,transparent_25%,rgba(255,255,255,0.45)_50%,transparent_75%)]" />
          </div>
          {/* Onde deveria estar pelo dia do mês */}
          {ritmo > 0 && ritmo < 100 && (
            <div
              className="absolute top-0 h-full w-0.5 bg-gray-900/30"
              style={{ left: `${ritmo}%` }}
              title="Ritmo esperado para hoje"
            />
          )}
        </div>
        {ORDEM.map((nivel) => {
          const posicao = Math.min(100, meta.marcos[nivel]);
          const alcancado = meta.percentual >= meta.marcos[nivel];
          return (
            <div
              key={nivel}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${posicao}%` }}
            >
              <div className={`h-7 w-0.5 ${alcancado ? "bg-white/80" : "bg-gray-300"}`} />
              <span
                className={`mt-0.5 text-base leading-none transition ${alcancado ? "scale-125" : "opacity-40 grayscale"}`}
                title={MEDALHAS[nivel].rotulo}
              >
                {MEDALHAS[nivel].icone}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MinhasMetas({ className = "" }) {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    api
      .get("/metas/minhas")
      .then(({ data }) => setDados(data))
      .catch(() => setDados(null));
  }, []);

  if (!dados?.metas?.length) return null;
  const ritmo = Math.round((dados.diaAtual / dados.diasNoMes) * 100);
  const nomeMes = NOMES_MES[Number(dados.mes.slice(5, 7)) - 1];

  return (
    <section className={className}>
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-xl font-black text-gray-900">🎯 Metas de {nomeMes}</h2>
        <p className="text-xs text-gray-500">
          Dia {dados.diaAtual} de {dados.diasNoMes} · o risco na barra é o ritmo esperado para hoje
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {dados.metas.map((meta) => (
          <BarraMeta key={meta.lojaId} meta={meta} ritmo={ritmo} />
        ))}
      </div>
    </section>
  );
}

export default MinhasMetas;
