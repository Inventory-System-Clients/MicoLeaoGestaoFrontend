import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, Modal } from "../components/UIComponents";
import { MapaPonto } from "../components/MapaPonto";
import { SelectBusca } from "../components/SelectBusca";
import { obterPerfil } from "../utils/perfis";
import {
  TIPOS_BATIDA,
  STATUS_FUNCIONARIO,
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
  baixarCsv,
  linkDoMapa,
} from "../utils/ponto";

// Controle de ponto do administrador (ele mesmo não bate ponto): quem está
// trabalhando agora, horas e extras do período, espelho dia a dia com
// ajustes, todas as batidas com filtros, locais (cerca no mapa) e jornadas.

const ABAS = [
  { chave: "agora", rotulo: "Agora", icone: "🟢" },
  { chave: "horas", rotulo: "Horas e extras", icone: "📊" },
  { chave: "espelho", rotulo: "Espelho de ponto", icone: "📋" },
  { chave: "batidas", rotulo: "Batidas", icone: "🕒" },
  { chave: "locais", rotulo: "Locais", icone: "📍" },
  { chave: "jornadas", rotulo: "Jornadas", icone: "⚙️" },
];

const COR_STATUS = {
  TRABALHANDO: "#10b981",
  INTERVALO: "#f59e0b",
  ENCERROU: "#9ca3af",
  INCOMPLETO: "#f43f5e",
  NAO_BATEU: "#cbd5e1",
};

const mensagemDeErro = (erro, padrao) => erro?.response?.data?.error || erro?.message || padrao;

function Carregando() {
  return (
    <div className="flex justify-center py-16">
      <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}

function Vazio({ children }) {
  return <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 p-8 text-center text-sm text-gray-500">{children}</div>;
}

function Cartao({ titulo, valor, cor = "text-gray-900", detalhe, onClick, ativo }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-xl border bg-white p-4 text-left shadow-sm transition ${
        ativo ? "border-gray-900 ring-2 ring-gray-900/10" : "border-gray-100"
      } ${onClick ? "hover:border-gray-300" : ""}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-black ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-gray-400">{detalhe}</p>}
    </Tag>
  );
}

function FiltroPeriodo({ periodo, aoMudar }) {
  const [rapido, setRapido] = useState("mes");
  const hoje = hojeEmBrasilia();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIODOS_RAPIDOS.map((opcao) => (
        <button
          key={opcao.chave}
          type="button"
          onClick={() => {
            setRapido(opcao.chave);
            aoMudar(opcao.calcular(hoje));
          }}
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${
            rapido === opcao.chave ? "bg-gray-900 text-white" : "bg-white text-gray-600 shadow-sm hover:bg-gray-100"
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
          setRapido("");
          aoMudar({ ...periodo, inicio: e.target.value });
        }}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
      />
      <span className="text-xs text-gray-400">até</span>
      <input
        type="date"
        value={periodo.fim}
        min={periodo.inicio}
        max={hoje}
        onChange={(e) => {
          setRapido("");
          aoMudar({ ...periodo, fim: e.target.value });
        }}
        className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs"
      />
    </div>
  );
}

function ChipBatida({ batida }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs font-bold ${
        batida.foraDoLocal ? "bg-amber-100 text-amber-800" : batida.origem === "AJUSTE" ? "bg-violet-100 text-violet-800" : "bg-gray-100 text-gray-700"
      }`}
      title={`${TIPOS_BATIDA[batida.tipo].rotulo}${batida.local ? ` · ${batida.local.nome} (${formatarDistancia(batida.distanciaMetros)})` : ""}${
        batida.foraDoLocal ? " · fora do local" : ""
      }${batida.origem === "AJUSTE" ? ` · ajuste: ${batida.motivoAjuste}` : ""}`}
    >
      {TIPOS_BATIDA[batida.tipo].icone} {formatarHora(batida.dataHora)}
    </span>
  );
}

// ---------------- Agora ----------------
function AbaAgora({ abrirEspelho }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/ponto/admin/painel");
      setDados(data);
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao carregar"));
    }
  }, []);

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, 60000);
    return () => clearInterval(timer);
  }, [carregar]);

  if (erro) return <Vazio>{erro}</Vazio>;
  if (!dados) return <Carregando />;

  const contagem = dados.funcionarios.reduce((soma, f) => ({ ...soma, [f.status]: (soma[f.status] || 0) + 1 }), {});
  const foraHoje = dados.funcionarios.reduce((soma, f) => soma + (f.dia?.foraDoLocal || 0), 0);
  const termo = busca.trim().toLowerCase();
  const lista = dados.funcionarios.filter(
    (f) => (!filtro || f.status === filtro) && (!termo || f.usuario.nome.toLowerCase().includes(termo)),
  );
  const pontosNoMapa = lista
    .filter((f) => f.ultima?.latitude != null)
    .map((f) => ({
      id: f.usuario.id,
      latitude: f.ultima.latitude,
      longitude: f.ultima.longitude,
      cor: COR_STATUS[f.status],
      titulo: `${f.usuario.nome} · ${STATUS_FUNCIONARIO[f.status].rotulo}`,
      descricao: `${f.usuario.nome}: ${TIPOS_BATIDA[f.ultima.tipo].rotulo} às ${formatarHora(f.ultima.dataHora)}${
        f.ultima.local ? ` · ${f.ultima.local.nome} (${formatarDistancia(f.ultima.distanciaMetros)})` : ""
      }`,
    }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {["TRABALHANDO", "INTERVALO", "ENCERROU", "NAO_BATEU"].map((status) => (
          <Cartao
            key={status}
            titulo={STATUS_FUNCIONARIO[status].rotulo}
            valor={contagem[status] || 0}
            cor={status === "TRABALHANDO" ? "text-emerald-600" : status === "INTERVALO" ? "text-amber-600" : "text-gray-900"}
            onClick={() => setFiltro(filtro === status ? "" : status)}
            ativo={filtro === status}
          />
        ))}
        <Cartao titulo="Batidas fora do local hoje" valor={foraHoje} cor={foraHoje ? "text-amber-600" : "text-gray-900"} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-3 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="🔍 Buscar funcionário"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:w-64"
            />
            <p className="text-xs text-gray-400">Atualiza sozinho a cada minuto · {formatarHora(dados.agora)}</p>
          </div>
          {lista.length === 0 && <Vazio>Ninguém nesse filtro.</Vazio>}
          {lista.map((f) => (
            <button
              key={f.usuario.id}
              type="button"
              onClick={() => abrirEspelho(f.usuario.id)}
              className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-gray-300"
            >
              <span className={`h-3 w-3 shrink-0 rounded-full ${STATUS_FUNCIONARIO[f.status].ponto}`} />
              <div className="min-w-40 flex-1">
                <p className="font-bold text-gray-900">{f.usuario.nome}</p>
                <p className="text-xs text-gray-500">
                  {obterPerfil(f.usuario.role).nome}
                  {f.ultima?.local &&
                    (f.ultima.foraDoLocal
                      ? ` · ⚠️ fora do local (${formatarDistancia(f.ultima.distanciaMetros)} de ${f.ultima.local.nome})`
                      : ` · ${f.ultima.local.nome}`)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {(f.dia?.batidas || []).map((b) => (
                  <ChipBatida key={b.id} batida={b} />
                ))}
              </div>
              <div className="text-right">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_FUNCIONARIO[f.status].classe}`}>
                  {STATUS_FUNCIONARIO[f.status].rotulo}
                </span>
                {f.dia?.batidas?.length > 0 && (
                  <p className="mt-1 text-xs font-semibold text-gray-600">
                    {formatarMinutos(f.dia.trabalhadoMinutos)} de {formatarMinutos(f.usuario.jornadaDiariaMinutos)}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
        <div className="lg:col-span-2">
          <div className="sticky top-4 space-y-2">
            <MapaPonto altura={420} locais={dados.locais} pontos={pontosNoMapa} />
            <p className="text-xs text-gray-500">Mostra a última batida de cada pessoa. Círculos laranja: locais cadastrados.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Horas e extras ----------------
function Cabecalho({ campo, children, className = "", ordem, ordenar }) {
  return (
    <th className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 hover:text-gray-900 ${className}`} onClick={() => ordenar(campo)}>
      {children} {ordem.campo === campo ? (ordem.desc ? "▼" : "▲") : ""}
    </th>
  );
}

function AbaHoras({ periodo, setPeriodo, abrirEspelho }) {
  // Resultado guardado com a busca que o gerou: trocou o período, mostra
  // "carregando" até chegar o novo
  const chave = JSON.stringify(periodo);
  const [resultado, setResultado] = useState({ chave: null, dados: null, erro: "" });
  const dados = resultado.chave === chave ? resultado.dados : null;
  const erro = resultado.chave === chave ? resultado.erro : "";
  const [ordem, setOrdem] = useState({ campo: "nome", desc: false });
  const [soComRegistro, setSoComRegistro] = useState(true);

  useEffect(() => {
    api
      .get("/ponto/admin/resumo", { params: periodo })
      .then(({ data }) => setResultado({ chave, dados: data, erro: "" }))
      .catch((e) => setResultado({ chave, dados: null, erro: mensagemDeErro(e, "Erro ao carregar") }));
  }, [periodo, chave]);

  const linhas = useMemo(() => {
    const lista = (dados?.funcionarios || []).filter((l) => !soComRegistro || l.totais.diasTrabalhados > 0);
    const valor = (linha) => (ordem.campo === "nome" ? linha.usuario.nome : linha.totais[ordem.campo]);
    return [...lista].sort((a, b) => {
      const comparacao = typeof valor(a) === "string" ? valor(a).localeCompare(valor(b)) : valor(a) - valor(b);
      return ordem.desc ? -comparacao : comparacao;
    });
  }, [dados, ordem, soComRegistro]);

  const total = linhas.reduce(
    (soma, l) => ({
      trabalhado: soma.trabalhado + l.totais.trabalhadoMinutos,
      extra: soma.extra + l.totais.extraMinutos,
      debito: soma.debito + l.totais.debitoMinutos,
      incompletos: soma.incompletos + l.totais.diasIncompletos,
    }),
    { trabalhado: 0, extra: 0, debito: 0, incompletos: 0 },
  );

  const ordenar = (campo) => setOrdem((atual) => ({ campo, desc: atual.campo === campo ? !atual.desc : campo !== "nome" }));
  const cabecalho = { ordem, ordenar };

  const exportar = () =>
    baixarCsv(`horas_${periodo.inicio}_a_${periodo.fim}.csv`, [
      ["Funcionário", "Perfil", "Jornada/dia", "Dias trabalhados", "Trabalhado", "Extras", "Horas a menos", "Saldo", "Dias incompletos", "Batidas fora do local", "Ajustes"],
      ...linhas.map((l) => [
        l.usuario.nome,
        obterPerfil(l.usuario.role).nome,
        formatarMinutos(l.usuario.jornadaDiariaMinutos),
        l.totais.diasTrabalhados,
        formatarMinutos(l.totais.trabalhadoMinutos),
        formatarMinutos(l.totais.extraMinutos),
        formatarMinutos(l.totais.debitoMinutos),
        formatarMinutos(l.totais.saldoMinutos),
        l.totais.diasIncompletos,
        l.totais.foraDoLocal,
        l.totais.ajustes,
      ]),
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FiltroPeriodo periodo={periodo} aoMudar={setPeriodo} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
            <input type="checkbox" checked={soComRegistro} onChange={(e) => setSoComRegistro(e.target.checked)} />
            Só quem bateu ponto
          </label>
          <button type="button" onClick={exportar} disabled={!linhas.length} className="btn-secondary text-sm">
            ⬇️ Planilha
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cartao titulo="Trabalhado (equipe)" valor={formatarMinutos(total.trabalhado)} />
        <Cartao titulo="Horas extras" valor={formatarMinutos(total.extra)} cor="text-emerald-600" />
        <Cartao titulo="Horas a menos" valor={formatarMinutos(total.debito)} cor="text-rose-600" />
        <Cartao titulo="Dias incompletos" valor={total.incompletos} cor={total.incompletos ? "text-rose-600" : "text-gray-900"} detalhe="Faltou alguma batida" />
      </div>

      {erro && <Vazio>{erro}</Vazio>}
      {!dados && !erro && <Carregando />}
      {dados && linhas.length === 0 && <Vazio>Ninguém bateu ponto nesse período.</Vazio>}
      {dados && linhas.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500">
              <tr>
                <Cabecalho {...cabecalho} campo="nome">Funcionário</Cabecalho>
                <Cabecalho {...cabecalho} campo="diasTrabalhados" className="text-right">Dias</Cabecalho>
                <Cabecalho {...cabecalho} campo="trabalhadoMinutos" className="text-right">Trabalhado</Cabecalho>
                <Cabecalho {...cabecalho} campo="extraMinutos" className="text-right">Extras</Cabecalho>
                <Cabecalho {...cabecalho} campo="debitoMinutos" className="text-right">A menos</Cabecalho>
                <Cabecalho {...cabecalho} campo="saldoMinutos" className="text-right">Saldo</Cabecalho>
                <Cabecalho {...cabecalho} campo="avisos" className="text-right">Avisos</Cabecalho>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {linhas.map((l) => (
                <tr key={l.usuario.id} onClick={() => abrirEspelho(l.usuario.id)} className="cursor-pointer hover:bg-orange-50/50">
                  <td className="px-3 py-2.5">
                    <p className="font-bold text-gray-900">{l.usuario.nome}</p>
                    <p className="text-xs text-gray-500">
                      {obterPerfil(l.usuario.role).nome} · jornada {formatarMinutos(l.usuario.jornadaDiariaMinutos)}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right">{l.totais.diasTrabalhados}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{formatarMinutos(l.totais.trabalhadoMinutos)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">{formatarMinutos(l.totais.extraMinutos)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-rose-600">{formatarMinutos(l.totais.debitoMinutos)}</td>
                  <td className={`px-3 py-2.5 text-right font-black ${l.totais.saldoMinutos >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {formatarMinutos(l.totais.saldoMinutos, { sinal: true })}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="inline-flex flex-wrap justify-end gap-1">
                      {l.totais.diasIncompletos > 0 && <span className="rounded bg-rose-100 px-1.5 text-xs font-bold text-rose-700">{l.totais.diasIncompletos} incompleto(s)</span>}
                      {l.totais.foraDoLocal > 0 && <span className="rounded bg-amber-100 px-1.5 text-xs font-bold text-amber-700">{l.totais.foraDoLocal} fora</span>}
                      {l.totais.ajustes > 0 && <span className="rounded bg-violet-100 px-1.5 text-xs font-bold text-violet-700">{l.totais.ajustes} ajuste(s)</span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">
        Hora extra conta o que passar da jornada do dia, com tolerância de 10 min por dia (CLT art. 58 §1º). Clique numa linha para ver o dia a dia.
      </p>
    </div>
  );
}

// ---------------- Espelho de ponto ----------------
function AbaEspelho({ funcionarios, usuarioId, setUsuarioId, periodo, setPeriodo }) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [lancando, setLancando] = useState(null);
  const [desconsiderando, setDesconsiderando] = useState(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState("");
  const [soComRegistro, setSoComRegistro] = useState(false);

  const carregar = useCallback(async () => {
    if (!usuarioId) return;
    try {
      const { data } = await api.get("/ponto/admin/espelho", { params: { usuarioId, ...periodo } });
      setDados(data);
      setErro("");
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao carregar"));
    }
  }, [usuarioId, periodo]);

  useEffect(() => {
    setDados(null);
    carregar();
  }, [carregar]);

  const abrirLancamento = (dia, tipo = "ENTRADA") => {
    setErroModal("");
    setMotivo("");
    setLancando({ dia: dia || hojeEmBrasilia(), hora: "08:00", tipo });
  };

  const salvarLancamento = async () => {
    setSalvando(true);
    setErroModal("");
    try {
      await api.post("/ponto/admin/ajustes", {
        usuarioId,
        tipo: lancando.tipo,
        dataHora: `${lancando.dia}T${lancando.hora}:00-03:00`,
        dataReferencia: lancando.dia,
        motivo,
      });
      setLancando(null);
      await carregar();
    } catch (e) {
      setErroModal(mensagemDeErro(e, "Erro ao lançar"));
    } finally {
      setSalvando(false);
    }
  };

  const salvarDesconsiderar = async () => {
    setSalvando(true);
    setErroModal("");
    try {
      await api.patch(`/ponto/admin/batidas/${desconsiderando.id}/desconsiderar`, { motivo });
      setDesconsiderando(null);
      await carregar();
    } catch (e) {
      setErroModal(mensagemDeErro(e, "Erro ao desconsiderar"));
    } finally {
      setSalvando(false);
    }
  };

  const dias = (dados?.dias || []).filter((dia) => !soComRegistro || dia.batidas.length > 0);
  const horaDe = (dia, tipo) => dia.batidas.filter((b) => b.tipo === tipo);

  const exportar = () =>
    baixarCsv(`espelho_${dados.usuario.nome.replace(/\s+/g, "_")}_${periodo.inicio}_a_${periodo.fim}.csv`, [
      ["Funcionário", dados.usuario.nome],
      ["Período", `${formatarDia(periodo.inicio, { ano: true })} a ${formatarDia(periodo.fim, { ano: true })}`],
      ["Jornada diária", formatarMinutos(dados.usuario.jornadaDiariaMinutos)],
      [],
      ["Dia", "Semana", "Entrada", "Saída intervalo", "Volta intervalo", "Saída", "Trabalhado", "Intervalo", "Extra", "A menos", "Situação", "Avisos"],
      ...[...dados.dias].reverse().map((dia) => [
        formatarDia(dia.dia, { ano: true }),
        DIAS_SEMANA[dia.diaDaSemana],
        ...["ENTRADA", "SAIDA_INTERVALO", "VOLTA_INTERVALO", "SAIDA"].map((tipo) =>
          horaDe(dia, tipo).map((b) => `${formatarHora(b.dataHora)}${b.origem === "AJUSTE" ? "*" : ""}`).join(" "),
        ),
        formatarMinutos(dia.trabalhadoMinutos),
        formatarMinutos(dia.intervaloMinutos),
        formatarMinutos(dia.extraMinutos),
        formatarMinutos(dia.debitoMinutos),
        SITUACAO_DIA[dia.situacao].rotulo,
        dia.avisos.join(" | "),
      ]),
      [],
      ["Totais", "", "", "", "", "", formatarMinutos(dados.totais.trabalhadoMinutos), "", formatarMinutos(dados.totais.extraMinutos), formatarMinutos(dados.totais.debitoMinutos), `Saldo ${formatarMinutos(dados.totais.saldoMinutos, { sinal: true })}`],
      ["* batida lançada pelo administrador"],
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full lg:w-80">
          <SelectBusca
            opcoes={funcionarios.map((f) => ({ valor: f.id, rotulo: f.nome, detalhe: obterPerfil(f.role).nome }))}
            valor={usuarioId}
            aoMudar={setUsuarioId}
            placeholder="Escolha o funcionário"
          />
        </div>
        <FiltroPeriodo periodo={periodo} aoMudar={setPeriodo} />
      </div>

      {!usuarioId && <Vazio>Escolha um funcionário para ver o espelho de ponto.</Vazio>}
      {usuarioId && erro && <Vazio>{erro}</Vazio>}
      {usuarioId && !dados && !erro && <Carregando />}
      {dados && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Cartao titulo="Trabalhado" valor={formatarMinutos(dados.totais.trabalhadoMinutos)} detalhe={`${dados.totais.diasTrabalhados} dia(s) · jornada ${formatarMinutos(dados.usuario.jornadaDiariaMinutos)}`} />
            <Cartao titulo="Horas extras" valor={formatarMinutos(dados.totais.extraMinutos)} cor="text-emerald-600" />
            <Cartao titulo="Horas a menos" valor={formatarMinutos(dados.totais.debitoMinutos)} cor="text-rose-600" />
            <Cartao titulo="Saldo" valor={formatarMinutos(dados.totais.saldoMinutos, { sinal: true })} cor={dados.totais.saldoMinutos >= 0 ? "text-emerald-600" : "text-rose-600"} />
            <Cartao titulo="Avisos" valor={dados.totais.avisos} cor={dados.totais.avisos ? "text-amber-600" : "text-gray-900"} detalhe={`${dados.totais.ajustes} ajuste(s) · ${dados.totais.foraDoLocal} fora do local`} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
              <input type="checkbox" checked={soComRegistro} onChange={(e) => setSoComRegistro(e.target.checked)} />
              Esconder dias sem registro
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => abrirLancamento()} className="btn-secondary text-sm">
                ➕ Lançar batida
              </button>
              <button type="button" onClick={exportar} className="btn-secondary text-sm">
                ⬇️ Planilha
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Dia</th>
                  <th className="px-3 py-2">Entrada</th>
                  <th className="px-3 py-2">Intervalo</th>
                  <th className="px-3 py-2">Volta</th>
                  <th className="px-3 py-2">Saída</th>
                  <th className="px-3 py-2 text-right">Trabalhado</th>
                  <th className="px-3 py-2 text-right">Extra</th>
                  <th className="px-3 py-2 text-right">A menos</th>
                  <th className="px-3 py-2">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dias.map((dia) => (
                  <tr key={dia.dia} className={`align-top ${dia.diaDaSemana === 0 ? "bg-slate-50/70" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="font-bold text-gray-900">{formatarDia(dia.dia)}</span>{" "}
                      <span className="text-xs text-gray-500">{DIAS_SEMANA[dia.diaDaSemana]}</span>
                    </td>
                    {["ENTRADA", "SAIDA_INTERVALO", "VOLTA_INTERVALO", "SAIDA"].map((tipo) => (
                      <td key={tipo} className="px-3 py-2.5">
                        <div className="flex flex-col items-start gap-1">
                          {horaDe(dia, tipo).map((b) => (
                            <span key={b.id} className="group inline-flex items-center gap-1">
                              <ChipBatida batida={b} />
                              {b.latitude != null && (
                                <a href={linkDoMapa(b.latitude, b.longitude)} target="_blank" rel="noreferrer" className="text-xs" title="Ver no mapa">
                                  🗺️
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setErroModal("");
                                  setMotivo("");
                                  setDesconsiderando(b);
                                }}
                                className="text-xs text-gray-300 hover:text-rose-600"
                                title="Desconsiderar esta batida"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                          {horaDe(dia, tipo).length === 0 && (
                            <button type="button" onClick={() => abrirLancamento(dia.dia, tipo)} className="text-xs text-gray-300 hover:text-primary" title="Lançar batida">
                              + lançar
                            </button>
                          )}
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-semibold">{dia.batidas.length ? formatarMinutos(dia.trabalhadoMinutos) : "-"}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">{dia.extraMinutos ? formatarMinutos(dia.extraMinutos) : ""}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-rose-600">{dia.debitoMinutos ? formatarMinutos(dia.debitoMinutos) : ""}</td>
                    <td className="px-3 py-2.5">
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${SITUACAO_DIA[dia.situacao].classe}`}>
                        {SITUACAO_DIA[dia.situacao].rotulo}
                      </span>
                      {dia.avisos.map((aviso) => (
                        <p key={aviso} className="mt-1 max-w-56 text-xs text-amber-700">⚠️ {aviso}</p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">
            Roxo: lançada pelo admin · Amarelo: fora dos locais · ✕ desconsidera a batida (ela continua no histórico, em Batidas → Desconsideradas).
          </p>
        </>
      )}

      <Modal isOpen={Boolean(lancando)} onClose={() => !salvando && setLancando(null)} title="Lançar batida" size="sm">
        {lancando && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Para batida esquecida ou errada. Fica marcada como <b>lançada pelo admin</b>, com o motivo.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-gray-700">
                Dia
                <input type="date" value={lancando.dia} max={hojeEmBrasilia()} onChange={(e) => setLancando((l) => ({ ...l, dia: e.target.value }))} className="input-field mt-1 w-full" />
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Hora
                <input type="time" value={lancando.hora} onChange={(e) => setLancando((l) => ({ ...l, hora: e.target.value }))} className="input-field mt-1 w-full" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(TIPOS_BATIDA).map(([tipo, info]) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setLancando((l) => ({ ...l, tipo }))}
                  className={`rounded-lg border px-3 py-2 text-sm font-bold ${lancando.tipo === tipo ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700"}`}
                >
                  {info.icone} {info.rotulo}
                </button>
              ))}
            </div>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={255} placeholder="Motivo (obrigatório) — ex.: esqueceu de bater a saída" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            {erroModal && <p className="text-sm text-rose-600">{erroModal}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setLancando(null)} disabled={salvando} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={salvarLancamento} disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : "Lançar"}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(desconsiderando)} onClose={() => !salvando && setDesconsiderando(null)} title="Desconsiderar batida" size="sm">
        {desconsiderando && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              <b>{TIPOS_BATIDA[desconsiderando.tipo].rotulo}</b> de {formatarDataHora(desconsiderando.dataHora)} sai da conta de horas. O registro original continua guardado.
            </p>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={255} placeholder="Motivo (obrigatório) — ex.: bateu duas vezes" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            {erroModal && <p className="text-sm text-rose-600">{erroModal}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setDesconsiderando(null)} disabled={salvando} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={salvarDesconsiderar} disabled={salvando} className="btn-danger rounded-lg bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700 disabled:opacity-60">
                {salvando ? "Salvando..." : "Desconsiderar"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------- Batidas ----------------
function AbaBatidas({ funcionarios, locais, periodo, setPeriodo }) {
  const [filtros, setFiltros] = useState({ usuarioId: "", localId: "", tipo: "", situacao: "" });
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const chave = JSON.stringify({ periodo, filtros });
  const [resultado, setResultado] = useState({ chave: null, dados: null, erro: "" });
  const dados = resultado.chave === chave ? resultado.dados : null;
  const erro = resultado.chave === chave ? resultado.erro : "";

  useEffect(() => {
    api
      .get("/ponto/admin/batidas", { params: { ...periodo, ...filtros } })
      .then(({ data }) => setResultado({ chave, dados: data, erro: "" }))
      .catch((e) => setResultado({ chave, dados: null, erro: mensagemDeErro(e, "Erro ao carregar") }));
  }, [periodo, filtros, chave]);

  const batidas = dados?.batidas || [];
  const mudar = (campo) => (valor) => setFiltros((f) => ({ ...f, [campo]: valor }));

  const exportar = () =>
    baixarCsv(`batidas_${periodo.inicio}_a_${periodo.fim}.csv`, [
      ["Nº", "Data/hora", "Funcionário", "Batida", "Local mais próximo", "Distância (m)", "Fora do local", "Precisão GPS (m)", "Latitude", "Longitude", "Origem", "Motivo do ajuste", "Observação", "Desconsiderada", "Motivo"],
      ...batidas.map((b) => [
        b.nsr,
        formatarDataHora(b.dataHora),
        b.usuario?.nome,
        TIPOS_BATIDA[b.tipo].rotulo,
        b.local?.nome || "",
        b.distanciaMetros ?? "",
        b.foraDoLocal ? "Sim" : "Não",
        b.precisaoMetros ?? "",
        b.latitude ?? "",
        b.longitude ?? "",
        b.origem === "AJUSTE" ? `Ajuste (${b.criadoPor?.nome || "admin"})` : "Funcionário",
        b.motivoAjuste || "",
        b.observacao || "",
        b.desconsiderada ? "Sim" : "Não",
        b.motivoDesconsiderada || "",
      ]),
    ]);

  return (
    <div className="space-y-4">
      <FiltroPeriodo periodo={periodo} aoMudar={setPeriodo} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <SelectBusca
          opcoes={funcionarios.map((f) => ({ valor: f.id, rotulo: f.nome }))}
          valor={filtros.usuarioId}
          aoMudar={mudar("usuarioId")}
          opcaoVazia="Todos os funcionários"
          placeholder="Todos os funcionários"
          className="text-sm"
        />
        <SelectBusca
          opcoes={locais.map((l) => ({ valor: l.id, rotulo: l.nome }))}
          valor={filtros.localId}
          aoMudar={mudar("localId")}
          opcaoVazia="Todos os locais"
          placeholder="Todos os locais"
          className="text-sm"
        />
        <select value={filtros.tipo} onChange={(e) => mudar("tipo")(e.target.value)} className="select-field text-sm">
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS_BATIDA).map(([tipo, info]) => (
            <option key={tipo} value={tipo}>{info.rotulo}</option>
          ))}
        </select>
        <select value={filtros.situacao} onChange={(e) => mudar("situacao")(e.target.value)} className="select-field text-sm">
          <option value="">Válidas</option>
          <option value="FORA">Só fora do local</option>
          <option value="AJUSTE">Só lançadas pelo admin</option>
          <option value="DESCONSIDERADA">Só desconsideradas</option>
          <option value="TODAS">Todas (inclui desconsideradas)</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          <b>{batidas.length}</b> batida(s)
          {batidas.length >= 2000 && " (mostrando as 2000 mais recentes — diminua o período)"}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setMostrarMapa((m) => !m)} className="btn-secondary text-sm">
            {mostrarMapa ? "Esconder mapa" : "🗺️ Ver no mapa"}
          </button>
          <button type="button" onClick={exportar} disabled={!batidas.length} className="btn-secondary text-sm">⬇️ Planilha</button>
        </div>
      </div>

      {mostrarMapa && (
        <MapaPonto
          altura={380}
          locais={locais}
          enquadrar="pontos"
          pontos={batidas
            .filter((b) => b.latitude != null)
            .slice(0, 500)
            .map((b) => ({
              id: b.id,
              latitude: b.latitude,
              longitude: b.longitude,
              cor: b.foraDoLocal ? "#f59e0b" : "#10b981",
              titulo: `${b.usuario?.nome} · ${TIPOS_BATIDA[b.tipo].rotulo} ${formatarDataHora(b.dataHora)}`,
            }))}
        />
      )}

      {erro && <Vazio>{erro}</Vazio>}
      {!dados && !erro && <Carregando />}
      {dados && batidas.length === 0 && <Vazio>Nenhuma batida com esses filtros.</Vazio>}
      {dados && batidas.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Data/hora</th>
                <th className="px-3 py-2">Funcionário</th>
                <th className="px-3 py-2">Batida</th>
                <th className="px-3 py-2">Onde</th>
                <th className="px-3 py-2">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batidas.map((b) => (
                <tr key={b.id} className={b.desconsiderada ? "bg-gray-50 text-gray-400 line-through decoration-gray-300" : ""}>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <p className="font-semibold">{formatarDataHora(b.dataHora)}</p>
                    <p className="text-xs text-gray-400">Nº {b.nsr}</p>
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{b.usuario?.nome}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">{TIPOS_BATIDA[b.tipo].icone} {TIPOS_BATIDA[b.tipo].rotulo}</td>
                  <td className="px-3 py-2.5">
                    {b.latitude != null ? (
                      <a href={linkDoMapa(b.latitude, b.longitude)} target="_blank" rel="noreferrer" className="hover:underline">
                        {b.foraDoLocal ? "⚠️ " : "✅ "}
                        {b.local ? `${b.local.nome} · ${formatarDistancia(b.distanciaMetros)}` : "Sem local cadastrado"}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                    {b.precisaoMetros > 100 && <p className="text-xs text-amber-600">GPS impreciso (~{b.precisaoMetros} m)</p>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {b.origem === "AJUSTE" && <p className="font-semibold text-violet-700">Lançada por {b.criadoPor?.nome || "admin"}: {b.motivoAjuste}</p>}
                    {b.observacao && <p className="text-gray-600">💬 {b.observacao}</p>}
                    {b.desconsiderada && (
                      <p className="text-rose-600 no-underline">
                        Desconsiderada por {b.desconsideradaPor?.nome || "admin"}: {b.motivoDesconsiderada}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------- Locais ----------------
const LOCAL_VAZIO = { id: null, nome: "", lojaId: "", latitude: null, longitude: null, raioMetros: 200, ativo: true };

function AbaLocais({ locais, recarregarLocais }) {
  const [lojas, setLojas] = useState([]);
  const [form, setForm] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [lendoGps, setLendoGps] = useState(false);

  useEffect(() => {
    api.get("/lojas").then(({ data }) => setLojas(Array.isArray(data) ? data : data?.lojas || [])).catch(() => {});
  }, []);

  const usarMinhaLocalizacao = async () => {
    setLendoGps(true);
    setErro("");
    try {
      const posicao = await pegarLocalizacao();
      setForm((f) => ({ ...f, latitude: posicao.latitude, longitude: posicao.longitude }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setLendoGps(false);
    }
  };

  const salvar = async () => {
    setSalvando(true);
    setErro("");
    try {
      const corpo = { ...form, lojaId: form.lojaId || null };
      if (form.id) await api.put(`/ponto/admin/locais/${form.id}`, corpo);
      else await api.post("/ponto/admin/locais", corpo);
      setForm(null);
      await recarregarLocais();
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao salvar"));
    } finally {
      setSalvando(false);
    }
  };

  const desativar = async (local) => {
    if (!window.confirm(`Desativar "${local.nome}"? As batidas antigas continuam ligadas a ele.`)) return;
    await api.delete(`/ponto/admin/locais/${local.id}`);
    await recarregarLocais();
  };

  const reativar = async (local) => {
    await api.put(`/ponto/admin/locais/${local.id}`, { ...local, ativo: true });
    await recarregarLocais();
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <div className="space-y-3 lg:col-span-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">Onde é esperado bater o ponto. Fora do raio, a batida fica marcada (não é bloqueada).</p>
        </div>
        <button type="button" onClick={() => { setErro(""); setForm({ ...LOCAL_VAZIO }); }} className="btn-primary w-full">
          ➕ Novo local
        </button>
        {locais.length === 0 && <Vazio>Nenhum local ainda. Cadastre as lojas e o depósito para saber se a pessoa bateu no lugar certo.</Vazio>}
        {locais.map((local) => (
          <div key={local.id} className={`rounded-xl border bg-white p-4 shadow-sm ${form?.id === local.id ? "border-blue-400" : "border-gray-100"} ${local.ativo ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-gray-900">📍 {local.nome}</p>
                <p className="text-xs text-gray-500">
                  Raio {local.raioMetros} m{local.loja ? ` · loja ${local.loja.nome}` : ""}
                  {!local.ativo && " · desativado"}
                </p>
              </div>
              <div className="flex gap-2 text-xs font-bold">
                <button type="button" onClick={() => { setErro(""); setForm({ ...local, lojaId: local.lojaId || "" }); }} className="text-blue-600 hover:underline">Editar</button>
                {local.ativo ? (
                  <button type="button" onClick={() => desativar(local)} className="text-rose-600 hover:underline">Desativar</button>
                ) : (
                  <button type="button" onClick={() => reativar(local)} className="text-emerald-600 hover:underline">Reativar</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 lg:col-span-3">
        {form ? (
          <div className="card space-y-3">
            <h3 className="text-lg font-black text-gray-900">{form.id ? "Editar local" : "Novo local"}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold text-gray-700">
                Loja (opcional)
                <div className="mt-1">
                  <SelectBusca
                    opcoes={lojas.map((l) => ({ valor: l.id, rotulo: l.nome }))}
                    valor={form.lojaId}
                    aoMudar={(lojaId) => {
                      const loja = lojas.find((l) => l.id === lojaId);
                      setForm((f) => ({ ...f, lojaId, nome: f.nome || loja?.nome || "" }));
                    }}
                    opcaoVazia="Nenhuma (depósito, escritório...)"
                    placeholder="Buscar loja"
                  />
                </div>
              </label>
              <label className="text-sm font-semibold text-gray-700">
                Nome
                <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex.: Depósito central" className="input-field mt-1 w-full" />
              </label>
            </div>
            <label className="block text-sm font-semibold text-gray-700">
              Raio: <b>{form.raioMetros} m</b>
              <input type="range" min={20} max={1000} step={10} value={form.raioMetros} onChange={(e) => setForm((f) => ({ ...f, raioMetros: Number(e.target.value) }))} className="mt-1 w-full" />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={usarMinhaLocalizacao} disabled={lendoGps} className="btn-secondary text-sm">
                {lendoGps ? "Lendo GPS..." : "📍 Usar minha localização"}
              </button>
              <span className="text-xs text-gray-500">ou clique no mapa para marcar o ponto</span>
            </div>
            <MapaPonto
              altura={340}
              locais={locais.filter((l) => l.ativo && l.id !== form.id)}
              enquadrar={form.latitude != null ? "pontos" : "tudo"}
              selecionado={form.latitude != null ? form : null}
              aoClicar={(latitude, longitude) => setForm((f) => ({ ...f, latitude, longitude }))}
            />
            {form.latitude != null && (
              <p className="text-xs text-gray-500">
                {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
              </p>
            )}
            {erro && <p className="text-sm text-rose-600">{erro}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className="btn-secondary">Cancelar</button>
              <button type="button" onClick={salvar} disabled={salvando} className="btn-primary">{salvando ? "Salvando..." : "Salvar local"}</button>
            </div>
          </div>
        ) : (
          <MapaPonto altura={460} locais={locais.filter((l) => l.ativo)} />
        )}
      </div>
    </div>
  );
}

// ---------------- Jornadas ----------------
const paraHoras = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

function AbaJornadas({ funcionarios, recarregarFuncionarios }) {
  const [valores, setValores] = useState({});
  const [salvo, setSalvo] = useState("");
  const [erro, setErro] = useState("");

  const salvar = async (funcionario) => {
    const texto = valores[funcionario.id];
    const [h, m] = String(texto).split(":").map(Number);
    setErro("");
    try {
      await api.put(`/ponto/admin/jornadas/${funcionario.id}`, { jornadaDiariaMinutos: h * 60 + (m || 0) });
      setSalvo(funcionario.id);
      setTimeout(() => setSalvo(""), 2000);
      setValores((v) => {
        const novo = { ...v };
        delete novo[funcionario.id];
        return novo;
      });
      await recarregarFuncionarios();
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao salvar"));
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        Horas de trabalho esperadas por dia (sem contar o intervalo). Padrão: 8h. O que passar disso — com tolerância de 10 min — conta como hora extra.
      </p>
      {erro && <p className="text-sm text-rose-600">{erro}</p>}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {funcionarios.map((f) => {
          const valor = valores[f.id] ?? paraHoras(f.jornadaDiariaMinutos);
          const mudou = valores[f.id] !== undefined && valores[f.id] !== paraHoras(f.jornadaDiariaMinutos);
          return (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
              <div>
                <p className="font-bold text-gray-900">{f.nome}</p>
                <p className="text-xs text-gray-500">{obterPerfil(f.role).nome}</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="time" value={valor} onChange={(e) => setValores((v) => ({ ...v, [f.id]: e.target.value }))} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
                <span className="text-xs text-gray-500">por dia</span>
                <button type="button" onClick={() => salvar(f)} disabled={!mudou} className="btn-primary px-3 py-1.5 text-sm disabled:opacity-40">
                  {salvo === f.id ? "Salvo ✓" : "Salvar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Página ----------------
export function ControlePonto() {
  const [aba, setAba] = useState("agora");
  const [funcionarios, setFuncionarios] = useState([]);
  const [locais, setLocais] = useState([]);
  const [periodo, setPeriodo] = useState(() => PERIODOS_RAPIDOS[2].calcular(hojeEmBrasilia()));
  const [usuarioEspelho, setUsuarioEspelho] = useState("");

  const recarregarFuncionarios = useCallback(async () => {
    const { data } = await api.get("/ponto/admin/painel");
    setFuncionarios(data.funcionarios.map((f) => f.usuario));
  }, []);
  const recarregarLocais = useCallback(async () => {
    const { data } = await api.get("/ponto/admin/locais");
    setLocais(data);
  }, []);

  useEffect(() => {
    recarregarFuncionarios().catch(() => {});
    recarregarLocais().catch(() => {});
  }, [recarregarFuncionarios, recarregarLocais]);

  const abrirEspelho = (usuarioId) => {
    setUsuarioEspelho(usuarioId);
    setAba("espelho");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Controle de Ponto" subtitle="Entradas, intervalos, saídas, horas extras e onde cada batida foi feita" icon="⏱️" />

        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
          {ABAS.map((item) => (
            <button
              key={item.chave}
              type="button"
              onClick={() => setAba(item.chave)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition ${
                aba === item.chave ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span>{item.icone}</span>
              {item.rotulo}
            </button>
          ))}
        </div>

        {aba === "agora" && <AbaAgora abrirEspelho={abrirEspelho} />}
        {aba === "horas" && <AbaHoras periodo={periodo} setPeriodo={setPeriodo} abrirEspelho={abrirEspelho} />}
        {aba === "espelho" && (
          <AbaEspelho funcionarios={funcionarios} usuarioId={usuarioEspelho} setUsuarioId={setUsuarioEspelho} periodo={periodo} setPeriodo={setPeriodo} />
        )}
        {aba === "batidas" && <AbaBatidas funcionarios={funcionarios} locais={locais} periodo={periodo} setPeriodo={setPeriodo} />}
        {aba === "locais" && <AbaLocais locais={locais} recarregarLocais={recarregarLocais} />}
        {aba === "jornadas" && <AbaJornadas funcionarios={funcionarios} recarregarFuncionarios={recarregarFuncionarios} />}
      </div>
      <Footer />
    </div>
  );
}

export default ControlePonto;
