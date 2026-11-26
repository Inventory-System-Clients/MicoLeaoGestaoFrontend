import { formatarMinutos } from "../utils/ponto";

// Calendário do mês do funcionário: dias de trabalho, folga e feriado (pela
// escala do cadastro: diária ou 12x36) e as horas feitas em cada dia.
const ESTILO = {
  TRABALHO: "border-emerald-200 bg-emerald-50 text-emerald-900",
  FOLGA: "border-slate-200 bg-slate-100 text-slate-500",
  FERIADO: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
};
const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const trocarMes = (mes, delta) => {
  const [ano, m] = mes.split("-").map(Number);
  const data = new Date(Date.UTC(ano, m - 1 + delta, 1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
};

export function CalendarioEscala({ calendario, escala, hoje, aoMudarMes }) {
  if (!calendario?.dias?.length) return null;
  const [ano, mes] = calendario.mes.split("-").map(Number);
  const primeiroDiaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const vazios = Array.from({ length: primeiroDiaSemana });
  const trabalho = calendario.dias.filter((d) => d.tipo === "TRABALHO").length;
  const folgas = calendario.dias.length - trabalho;

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-black text-gray-900">📅 Minha escala {escala === "12X36" ? "(12x36)" : "(diária)"}</h3>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => aoMudarMes(trocarMes(calendario.mes, -1))} className="rounded-lg bg-gray-100 px-2 py-1 text-sm font-bold">‹</button>
          <span className="min-w-32 text-center text-sm font-bold capitalize">{NOMES_MES[mes - 1]} {ano}</span>
          <button type="button" onClick={() => aoMudarMes(trocarMes(calendario.mes, 1))} className="rounded-lg bg-gray-100 px-2 py-1 text-sm font-bold">›</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-gray-400">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {vazios.map((_, i) => (
          <span key={`v${i}`} />
        ))}
        {calendario.dias.map((d) => (
          <div
            key={d.dia}
            title={d.feriadoNome || (d.tipo === "FOLGA" ? "Folga" : "Dia de trabalho")}
            className={`min-h-14 rounded-lg border p-1 text-left ${ESTILO[d.tipo]} ${d.dia === hoje ? "ring-2 ring-primary" : ""}`}
          >
            <p className="text-xs font-black">{Number(d.dia.slice(8))}</p>
            <p className="truncate text-[10px] font-semibold">
              {d.tipo === "FERIADO" ? d.feriadoNome || "Feriado" : d.tipo === "FOLGA" ? "Folga" : "Trabalho"}
            </p>
            {d.trabalhadoMinutos > 0 && (
              <p className="text-[10px] font-bold text-gray-700">
                {formatarMinutos(d.trabalhadoMinutos)}
                {d.extraMinutos > 0 && <span className="text-emerald-700"> +{formatarMinutos(d.extraMinutos)}</span>}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {trabalho} dia(s) de trabalho e {folgas} de folga/feriado neste mês. Trabalhar na folga conta tudo como hora extra; domingo e feriado valem 100%.
      </p>
    </div>
  );
}

export default CalendarioEscala;
