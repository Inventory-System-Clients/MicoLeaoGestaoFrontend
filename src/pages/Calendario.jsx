import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, Modal } from "../components/UIComponents";
import { TarefaForm } from "../components/TarefaForm";
import {
  CATEGORIAS_CALENDARIO,
  CORES_PERIODO,
  NOMES_MES,
  dataBr,
  hojeBrasilia,
  mensagemDeErro,
} from "../utils/tarefas";

// Calendário (Análise > Calendário, admin): tudo o que tem data no sistema
// (tarefas, contas, extintores, contratos, manutenções, rotas, projetos,
// transferências, gastos, compras) e os períodos (ex.: Natal). Dá para
// agendar tarefa num dia, ou a partir de um item (pagar a conta, trocar o
// extintor, renovar o contrato).

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CHAVE_FILTROS = "calendario.filtros";

const somarDias = (dia, quantidade) => {
  const data = new Date(`${dia}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() + quantidade);
  return data.toISOString().slice(0, 10);
};
const diaDaSemana = (dia) => new Date(`${dia}T12:00:00Z`).getUTCDay();
const mudarMes = (mes, quantidade) => {
  const [ano, numero] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, numero - 1 + quantidade, 1)).toISOString().slice(0, 7);
};
const ultimoDiaDoMes = (mes) => {
  const [ano, numero] = mes.split("-").map(Number);
  return new Date(Date.UTC(ano, numero, 0)).toISOString().slice(0, 10);
};

// Do domingo antes do dia 1 ao sábado depois do último dia
const gradeDoMes = (mes) => {
  const primeiro = `${mes}-01`;
  const inicio = somarDias(primeiro, -diaDaSemana(primeiro));
  const ultimo = ultimoDiaDoMes(mes);
  const fim = somarDias(ultimo, 6 - diaDaSemana(ultimo));
  const dias = [];
  for (let dia = inicio; dia <= fim; dia = somarDias(dia, 1)) dias.push(dia);
  return { inicio, fim, dias };
};

const lerFiltros = () => {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_FILTROS) || "null");
    if (Array.isArray(salvo)) return new Set(salvo);
  } catch {
    // sem armazenamento: mostra tudo
  }
  return new Set(Object.keys(CATEGORIAS_CALENDARIO));
};

const PERIODO_VAZIO = { titulo: "", descricao: "", dataInicio: "", dataFim: "", cor: "vermelho", feriado: false };

function ModalPeriodo({ periodo, onFechar, onSalvo }) {
  const [form, setForm] = useState(periodo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const salvar = async (evento) => {
    evento.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      if (form.id) await api.put(`/calendario/periodos/${form.id}`, form);
      else await api.post("/calendario/periodos", form);
      onSalvo();
    } catch (error) {
      setErro(mensagemDeErro(error, "Erro ao salvar o período."));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!window.confirm(`Excluir o período "${form.titulo}"?`)) return;
    setSalvando(true);
    try {
      await api.delete(`/calendario/periodos/${form.id}`);
      onSalvo();
    } catch (error) {
      setErro(mensagemDeErro(error, "Erro ao excluir."));
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !salvando && onFechar()} title={form.id ? "Editar período" : "Novo período"} size="sm">
      <form onSubmit={salvar} className="space-y-3 text-left">
        <label className="block text-sm font-semibold text-gray-700">
          Nome *
          <input className="input-field mt-1" required maxLength={120} placeholder="Ex.: Natal, Black Friday, Férias escolares" value={form.titulo} onChange={(e) => mudar("titulo", e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-gray-700">
            Começa *
            <input type="date" required className="input-field mt-1" value={form.dataInicio} onChange={(e) => mudar("dataInicio", e.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-gray-700">
            Termina *
            <input type="date" required min={form.dataInicio || undefined} className="input-field mt-1" value={form.dataFim} onChange={(e) => mudar("dataFim", e.target.value)} />
          </label>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">Cor</p>
          <div className="mt-1 flex gap-2">
            {Object.entries(CORES_PERIODO).map(([nome, classe]) => (
              <button
                key={nome}
                type="button"
                aria-label={nome}
                onClick={() => mudar("cor", nome)}
                className={`h-7 w-7 rounded-full ${classe} ${form.cor === nome ? "ring-2 ring-gray-900 ring-offset-2" : ""}`}
              />
            ))}
          </div>
        </div>
        <label className="flex items-start gap-2 rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-2 text-sm">
          <input type="checkbox" className="mt-1" checked={Boolean(form.feriado)} onChange={(e) => mudar("feriado", e.target.checked)} />
          <span>
            <b>É feriado</b>
            <span className="block text-xs text-gray-600">No ponto: dia de folga e quem trabalhar ganha hora extra 100%. (Os feriados nacionais já entram sozinhos.)</span>
          </span>
        </label>
        <label className="block text-sm font-semibold text-gray-700">
          Observação
          <textarea rows={2} className="input-field mt-1" value={form.descricao || ""} onChange={(e) => mudar("descricao", e.target.value)} />
        </label>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="flex items-center justify-between gap-2">
          {form.id ? (
            <button type="button" className="text-sm font-semibold text-red-600 hover:underline" onClick={excluir} disabled={salvando}>
              Excluir
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={onFechar} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ItemDoDia({ evento, onAgendar, onPeriodo }) {
  const categoria = CATEGORIAS_CALENDARIO[evento.categoria] || CATEGORIAS_CALENDARIO.tarefa;
  // Itens que viram tarefa com ação
  const agendar =
    evento.categoria === "conta" && evento.status === "PENDENTE"
      ? { rotulo: "Agendar pagamento", inicial: { tipo: "PAGAR_CONTA", data: evento.data, dados: { contaPagarId: evento.contaPagarId } } }
      : evento.categoria === "extintor"
        ? { rotulo: "Agendar troca", inicial: { tipo: "TROCAR_EXTINTOR", data: evento.data, dados: { extintorId: String(evento.extintorId) } } }
        : evento.categoria === "contrato"
          ? { rotulo: "Agendar renovação", inicial: { tipo: "RENOVAR_CONTRATO", data: evento.data, dados: { lojaId: evento.lojaId } } }
          : null;

  return (
    <li className={`rounded-lg border px-3 py-2 ${categoria.cor} ${evento.atrasada ? "ring-1 ring-red-400" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            <span className="mr-1">{categoria.icone}</span>
            {evento.titulo}
          </p>
          {(evento.detalhe || evento.dataFim) && (
            <p className="text-xs opacity-80">
              {evento.dataFim && evento.dataFim !== evento.data ? `${dataBr(evento.data)} a ${dataBr(evento.dataFim)}` : ""}
              {evento.dataFim && evento.dataFim !== evento.data && evento.detalhe ? " · " : ""}
              {evento.detalhe}
            </p>
          )}
          {evento.atrasada && <p className="text-xs font-bold text-red-700">Atrasada</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {evento.categoria === "periodo" ? (
            <button type="button" className="text-xs font-semibold underline" onClick={() => onPeriodo(evento)}>
              Editar
            </button>
          ) : (
            evento.link && (
              <Link to={evento.link} className="text-xs font-semibold underline">
                Abrir
              </Link>
            )
          )}
          {agendar && (
            <button type="button" className="rounded bg-white/80 px-2 py-0.5 text-xs font-bold text-gray-800 shadow-sm hover:bg-white" onClick={() => onAgendar(agendar.inicial)}>
              ⚡ {agendar.rotulo}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export function Calendario() {
  const hoje = hojeBrasilia();
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [diaEscolhido, setDiaEscolhido] = useState(hoje);
  const [eventos, setEventos] = useState(null);
  const [erro, setErro] = useState("");
  const [filtros, setFiltros] = useState(lerFiltros);
  const [tarefaInicial, setTarefaInicial] = useState(null);
  const [periodo, setPeriodo] = useState(null);

  const grade = useMemo(() => gradeDoMes(mes), [mes]);

  // Recarrega mudando a versão; resposta de um mês antigo é ignorada
  const [versao, setVersao] = useState(0);
  const carregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let ativo = true;
    api
      .get("/calendario", { params: { inicio: grade.inicio, fim: grade.fim } })
      .then(({ data }) => {
        if (!ativo) return;
        setEventos(data.eventos);
        setErro("");
      })
      .catch((error) => ativo && setErro(mensagemDeErro(error, "Erro ao carregar o calendário.")));
    return () => {
      ativo = false;
    };
  }, [grade, versao]);

  const alternarFiltro = (categoria) =>
    setFiltros((atual) => {
      const novo = new Set(atual);
      if (novo.has(categoria)) novo.delete(categoria);
      else novo.add(categoria);
      try {
        localStorage.setItem(CHAVE_FILTROS, JSON.stringify([...novo]));
      } catch {
        // sem armazenamento: só não lembra
      }
      return novo;
    });

  // Dia -> eventos (períodos e gastos ocupam todos os dias do intervalo)
  const porDia = useMemo(() => {
    const mapa = new Map(grade.dias.map((dia) => [dia, []]));
    for (const evento of eventos || []) {
      if (!filtros.has(evento.categoria)) continue;
      const fim = evento.dataFim && evento.dataFim > evento.data ? evento.dataFim : evento.data;
      for (let dia = evento.data < grade.inicio ? grade.inicio : evento.data; dia <= fim && dia <= grade.fim; dia = somarDias(dia, 1)) {
        mapa.get(dia)?.push(evento);
      }
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => (a.categoria === "periodo" ? -1 : b.categoria === "periodo" ? 1 : 0));
    }
    return mapa;
  }, [eventos, filtros, grade]);

  const contagem = useMemo(() => {
    const total = {};
    for (const evento of eventos || []) total[evento.categoria] = (total[evento.categoria] || 0) + 1;
    return total;
  }, [eventos]);

  const doDia = porDia.get(diaEscolhido) || [];
  const abrirPeriodo = (evento) =>
    setPeriodo({
      id: evento.periodoId,
      titulo: evento.nomePeriodo || evento.titulo,
      descricao: evento.detalhe || "",
      dataInicio: evento.data,
      dataFim: evento.dataFim,
      cor: evento.cor,
      feriado: Boolean(evento.feriado),
    });

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Calendário"
          subtitle="Tudo o que tem data no sistema, os períodos (ex.: Natal) e as tarefas agendadas"
          icon="📅"
          action={
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => setPeriodo({ ...PERIODO_VAZIO, dataInicio: diaEscolhido, dataFim: diaEscolhido })}>
                🎄 Novo período
              </button>
              <button type="button" className="btn-primary" onClick={() => setTarefaInicial({ data: diaEscolhido })}>
                ➕ Agendar tarefa
              </button>
            </div>
          }
        />

        {/* Mês */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMes((m) => mudarMes(m, -1))} className="rounded-lg bg-white px-3 py-2 font-black shadow-sm hover:bg-gray-100" aria-label="Mês anterior">
            ‹
          </button>
          <p className="min-w-44 text-center text-xl font-black text-gray-900">
            {NOMES_MES[Number(mes.slice(5, 7)) - 1]} {mes.slice(0, 4)}
          </p>
          <button type="button" onClick={() => setMes((m) => mudarMes(m, 1))} className="rounded-lg bg-white px-3 py-2 font-black shadow-sm hover:bg-gray-100" aria-label="Próximo mês">
            ›
          </button>
          <button
            type="button"
            onClick={() => {
              setMes(hoje.slice(0, 7));
              setDiaEscolhido(hoje);
            }}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-gray-100"
          >
            Hoje
          </button>
        </div>

        {/* Filtros */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {Object.entries(CATEGORIAS_CALENDARIO).map(([chave, categoria]) => (
            <button
              key={chave}
              type="button"
              onClick={() => alternarFiltro(chave)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                filtros.has(chave) ? categoria.cor : "border-gray-200 bg-white text-gray-400 line-through"
              }`}
            >
              {categoria.icone} {categoria.nome}
              {contagem[chave] ? ` (${contagem[chave]})` : ""}
            </button>
          ))}
        </div>

        {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          {/* Grade */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 text-center text-xs font-bold uppercase text-gray-500">
              {DIAS_SEMANA.map((dia) => (
                <div key={dia} className="py-2">
                  {dia}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grade.dias.map((dia) => {
                const lista = porDia.get(dia) || [];
                const periodos = lista.filter((evento) => evento.categoria === "periodo");
                const outros = lista.filter((evento) => evento.categoria !== "periodo");
                const foraDoMes = dia.slice(0, 7) !== mes;
                const atrasado = outros.some((evento) => evento.atrasada);
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => setDiaEscolhido(dia)}
                    className={`relative min-h-16 border-b border-r border-gray-100 p-1 text-left align-top transition hover:bg-gray-50 sm:min-h-28 ${
                      foraDoMes ? "bg-gray-50/60 text-gray-400" : ""
                    } ${diaEscolhido === dia ? "ring-2 ring-inset ring-primary" : ""}`}
                  >
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        dia === hoje ? "bg-primary text-white" : ""
                      }`}
                    >
                      {Number(dia.slice(8))}
                    </span>
                    {periodos.map((evento) => (
                      <span key={evento.id} className={`mt-0.5 block h-1.5 rounded-full sm:h-auto sm:truncate sm:px-1 sm:text-[10px] sm:font-bold sm:text-white ${CORES_PERIODO[evento.cor] || "bg-red-500"}`}>
                        <span className="hidden sm:inline">{evento.titulo}</span>
                      </span>
                    ))}
                    {/* Celular: só a quantidade */}
                    {outros.length > 0 && (
                      <span className={`mt-0.5 inline-block rounded-full px-1.5 text-[10px] font-bold sm:hidden ${atrasado ? "bg-red-600 text-white" : "bg-gray-800 text-white"}`}>
                        {outros.length}
                      </span>
                    )}
                    <span className="hidden sm:block">
                      {outros.slice(0, 3).map((evento) => (
                        <span
                          key={evento.id}
                          className={`mt-0.5 block truncate rounded border px-1 text-[10px] font-semibold ${(CATEGORIAS_CALENDARIO[evento.categoria] || CATEGORIAS_CALENDARIO.tarefa).cor} ${evento.atrasada ? "ring-1 ring-red-400" : ""} ${evento.status === "FEITA" || evento.status === "PAGA" ? "line-through opacity-60" : ""}`}
                        >
                          {(CATEGORIAS_CALENDARIO[evento.categoria] || {}).icone} {evento.titulo}
                        </span>
                      ))}
                      {outros.length > 3 && <span className="mt-0.5 block text-[10px] font-bold text-gray-500">+{outros.length - 3} mais</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            {!eventos && !erro && <p className="py-4 text-center text-sm text-gray-500">Carregando...</p>}
          </div>

          {/* Dia escolhido */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-lg font-black text-gray-900">
                {DIAS_SEMANA[diaDaSemana(diaEscolhido)]}, {dataBr(diaEscolhido)}
              </p>
              <button type="button" className="rounded-lg bg-primary px-2.5 py-1 text-sm font-bold text-white" onClick={() => setTarefaInicial({ data: diaEscolhido })}>
                ➕ Tarefa
              </button>
            </div>
            {doDia.length === 0 ? (
              <p className="text-sm text-gray-500">Nada neste dia.</p>
            ) : (
              <ul className="space-y-2">
                {doDia.map((evento) => (
                  <ItemDoDia key={evento.id} evento={evento} onAgendar={setTarefaInicial} onPeriodo={abrirPeriodo} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <TarefaForm aberto={Boolean(tarefaInicial)} inicial={tarefaInicial || undefined} onFechar={() => setTarefaInicial(null)} onSalva={carregar} />
      {periodo && (
        <ModalPeriodo
          periodo={periodo}
          onFechar={() => setPeriodo(null)}
          onSalvo={() => {
            setPeriodo(null);
            carregar();
          }}
        />
      )}
      <Footer />
    </div>
  );
}

export default Calendario;
