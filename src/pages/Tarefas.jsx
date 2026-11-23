import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, Modal } from "../components/UIComponents";
import { SelectBusca } from "../components/SelectBusca";
import { TarefaForm } from "../components/TarefaForm";
import { obterPerfil } from "../utils/perfis";
import {
  ICONE_TIPO,
  STATUS_TAREFA,
  dataBr,
  dataHoraBr,
  mensagemDeErro,
} from "../utils/tarefas";

// Tarefas (Análise > Tarefas): cada um vê as que criou e as que são para
// ele; o admin vê todas. Fluxo: criada -> o responsável aceita -> faz e
// marca Feito (tarefa com ação faz a ação sozinha nessa hora).

const ABAS = [
  { id: "minhas", nome: "Para mim" },
  { id: "criadas", nome: "Criadas por mim" },
  { id: "todas", nome: "Todas", soGestor: true },
];
const FILTROS = [
  { id: "abertas", nome: "Abertas" },
  { id: "FEITA", nome: "Feitas" },
  { id: "RECUSADA", nome: "Recusadas" },
  { id: "CANCELADA", nome: "Canceladas" },
  { id: "", nome: "Todas" },
];

const normalizar = (texto) =>
  String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function CartaoTarefa({ tarefa, onAcao }) {
  const [aberto, setAberto] = useState(false);
  const status = STATUS_TAREFA[tarefa.status] || { nome: tarefa.status, cor: "bg-gray-100" };
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${tarefa.atrasada ? "border-red-300" : "border-gray-100"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-gray-900 px-1.5 py-0.5 font-mono font-bold text-white">{tarefa.codigo}</span>
            <span className={`rounded-full px-2 py-0.5 font-semibold ${status.cor}`}>{status.nome}</span>
            {tarefa.atrasada && <span className="rounded-full bg-red-600 px-2 py-0.5 font-bold text-white">Atrasada</span>}
            {tarefa.automatica && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">🤖 automática</span>}
            {tarefa.tipo !== "LIVRE" && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-800">⚡ {tarefa.tipoNome}</span>
            )}
          </div>
          <p className="mt-1.5 font-bold text-gray-900">
            <span className="mr-1">{ICONE_TIPO[tarefa.tipo]}</span>
            {tarefa.titulo}
          </p>
          <p className={`mt-0.5 text-sm ${tarefa.atrasada ? "font-semibold text-red-700" : "text-gray-600"}`}>
            📅 {tarefa.dataFim ? `${dataBr(tarefa.data)} a ${dataBr(tarefa.dataFim)}` : dataBr(tarefa.data)}
            {tarefa.loja ? ` · 🏪 ${tarefa.loja.nome}` : ""}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {tarefa.criadoPor ? <b>{tarefa.criadoPor.nome}</b> : <b>Sistema</b>} →{" "}
            {tarefa.responsavel ? (
              <>
                <b>{tarefa.responsavel.nome}</b>{" "}
                <span className="text-xs text-gray-400">({obterPerfil(tarefa.responsavel.role).curto})</span>
              </>
            ) : (
              <span className="font-semibold text-amber-700">ninguém em especial</span>
            )}
          </p>
          {tarefa.descricao && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{tarefa.descricao}</p>}
          {tarefa.status === "RECUSADA" && tarefa.motivoRecusa && (
            <p className="mt-1 rounded bg-red-50 px-2 py-1 text-sm text-red-800">Recusou: {tarefa.motivoRecusa}</p>
          )}
          {tarefa.status === "FEITA" && (
            <p className="mt-1 rounded bg-green-50 px-2 py-1 text-sm text-green-800">
              ✅ Feita por <b>{tarefa.feitaPor?.nome}</b> em {dataHoraBr(tarefa.feitaEm)}
              {tarefa.resultado?.mensagem ? ` · ${tarefa.resultado.mensagem}` : ""}
              {tarefa.resultado?.observacao ? ` · ${tarefa.resultado.observacao}` : ""}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 sm:max-w-xs sm:justify-end">
          {tarefa.pode.aceitar && (
            <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => onAcao("aceitar", tarefa)}>
              {tarefa.responsavel ? "👍 Aceitar" : "🙋 Pegar para mim"}
            </button>
          )}
          {tarefa.pode.feito && (
            <button type="button" className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-green-700" onClick={() => onAcao("feito", tarefa)}>
              ✅ Feito
            </button>
          )}
          {tarefa.pode.recusar && (
            <button type="button" className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50" onClick={() => onAcao("recusar", tarefa)}>
              Recusar
            </button>
          )}
          {tarefa.pode.editar && (
            <button type="button" className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50" onClick={() => onAcao("editar", tarefa)}>
              {tarefa.responsavel ? "✏️ Editar" : "👤 Escolher responsável"}
            </button>
          )}
          {tarefa.pode.cancelar && (
            <button type="button" className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100" onClick={() => onAcao("cancelar", tarefa)}>
              Cancelar
            </button>
          )}
        </div>
      </div>

      <button type="button" onClick={() => setAberto((valor) => !valor)} className="mt-2 text-xs font-semibold text-gray-500 hover:text-gray-800">
        {aberto ? "▲ Esconder histórico" : "▼ Histórico"}
      </button>
      {aberto && (
        <ol className="mt-2 space-y-1 border-l-2 border-gray-200 pl-3 text-xs text-gray-600">
          {(tarefa.historico || []).map((item, indice) => (
            <li key={indice}>
              <b>{dataHoraBr(item.em)}</b> · {item.porNome} · {item.acao.toLowerCase()}
              {item.detalhe ? ` · ${item.detalhe}` : ""}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// Recusar, Feito, Editar e Cancelar
function ModalAcao({ acao, tarefa, usuarios, onFechar, onFeito }) {
  const [campos, setCampos] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setErro("");
    setCampos(
      acao === "editar"
        ? { titulo: tarefa.titulo, descricao: tarefa.descricao || "", data: tarefa.data, dataFim: tarefa.dataFim || "", responsavelId: tarefa.responsavelId || "" }
        : {},
    );
  }, [acao, tarefa]);

  const mudar = (campo, valor) => setCampos((atual) => ({ ...atual, [campo]: valor }));
  const titulos = { feito: "Marcar como feita", recusar: "Recusar tarefa", editar: "Editar tarefa", cancelar: "Cancelar tarefa" };

  const enviar = async (evento) => {
    evento.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const { data } =
        acao === "editar"
          ? await api.put(`/tarefas/${tarefa.id}`, campos)
          : await api.post(`/tarefas/${tarefa.id}/${acao}`, campos);
      onFeito(data);
    } catch (error) {
      setErro(mensagemDeErro(error, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !salvando && onFechar()} title={`${titulos[acao]} · ${tarefa.codigo}`} size="sm">
      <form onSubmit={enviar} className="space-y-3 text-left">
        <p className="text-sm font-semibold text-gray-800">{tarefa.titulo}</p>

        {acao === "feito" && (
          <>
            {tarefa.tipo !== "LIVRE" && (
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                ⚡ Ao confirmar, o sistema faz agora: <b>{tarefa.tipoNome.toLowerCase()}</b>.
              </p>
            )}
            {tarefa.pedeNoFeito && (
              <label className="block text-sm font-semibold text-gray-700">
                {tarefa.pedeNoFeito.rotulo} *
                <input type="date" required className="input-field mt-1" value={campos[tarefa.pedeNoFeito.campo] || ""} onChange={(e) => mudar(tarefa.pedeNoFeito.campo, e.target.value)} />
              </label>
            )}
            <label className="block text-sm font-semibold text-gray-700">
              Observação
              <textarea rows={2} className="input-field mt-1" value={campos.observacao || ""} onChange={(e) => mudar("observacao", e.target.value)} placeholder="Opcional" />
            </label>
          </>
        )}

        {(acao === "recusar" || acao === "cancelar") && (
          <label className="block text-sm font-semibold text-gray-700">
            {acao === "recusar" ? "Por que não vai fazer? *" : "Motivo"}
            <textarea rows={2} required={acao === "recusar"} className="input-field mt-1" value={campos.motivo || ""} onChange={(e) => mudar("motivo", e.target.value)} />
          </label>
        )}

        {acao === "editar" && (
          <>
            <label className="block text-sm font-semibold text-gray-700">
              Título
              <input className="input-field mt-1" required maxLength={200} value={campos.titulo || ""} onChange={(e) => mudar("titulo", e.target.value)} />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
              Para quem
              <div className="mt-1">
                <SelectBusca
                  opcoes={usuarios.map((u) => ({ valor: u.id, rotulo: u.nome, detalhe: obterPerfil(u.role).curto }))}
                  valor={campos.responsavelId || ""}
                  aoMudar={(valor) => mudar("responsavelId", valor)}
                  opcaoVazia="👥 Ninguém em especial"
                  placeholder="Buscar pessoa..."
                />
              </div>
              <span className="mt-1 block text-xs font-normal text-gray-500">Trocando a pessoa, a nova precisa aceitar de novo.</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-gray-700">
                Dia
                <input type="date" required className="input-field mt-1" value={campos.data || ""} onChange={(e) => mudar("data", e.target.value)} />
              </label>
              <label className="block text-sm font-semibold text-gray-700">
                Até o dia
                <input type="date" min={campos.data || undefined} className="input-field mt-1" value={campos.dataFim || ""} onChange={(e) => mudar("dataFim", e.target.value)} />
                <span className="mt-1 block text-xs font-normal text-gray-500">Em branco: um dia só.</span>
              </label>
            </div>
            <label className="block text-sm font-semibold text-gray-700">
              Detalhes
              <textarea rows={2} className="input-field mt-1" value={campos.descricao || ""} onChange={(e) => mudar("descricao", e.target.value)} />
            </label>
          </>
        )}

        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onFechar} disabled={salvando}>
            Voltar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className={acao === "recusar" || acao === "cancelar" ? "btn-danger" : "btn-primary"}
          >
            {salvando ? "Salvando..." : acao === "feito" ? "✅ Confirmar" : acao === "editar" ? "Salvar" : acao === "recusar" ? "Recusar" : "Cancelar tarefa"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Tarefas() {
  const [aba, setAba] = useState("minhas");
  const [filtro, setFiltro] = useState("abertas");
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [criando, setCriando] = useState(false);
  const [acao, setAcao] = useState(null); // { tipo, tarefa }

  // Recarrega mudando a versão; resposta de um filtro antigo é ignorada
  const [versao, setVersao] = useState(0);
  const carregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let ativo = true;
    api
      .get("/tarefas", { params: { escopo: aba, status: filtro || undefined } })
      .then(({ data }) => {
        if (!ativo) return;
        setDados(data);
        setErro("");
      })
      .catch((error) => ativo && setErro(mensagemDeErro(error, "Erro ao carregar as tarefas.")));
    return () => {
      ativo = false;
    };
  }, [aba, filtro, versao]);

  useEffect(() => {
    api
      .get("/tarefas/opcoes")
      .then(({ data }) => {
        setUsuarios(data.usuarios || []);
        // Admin abre direto em "Todas" (vê as automáticas sem responsável)
        if (data.gestor) setAba((atual) => (atual === "minhas" ? "todas" : atual));
      })
      .catch(() => {});
  }, []);

  const tarefas = useMemo(() => {
    const termo = normalizar(busca.trim());
    const lista = dados?.tarefas || [];
    if (!termo) return lista;
    return lista.filter((tarefa) =>
      normalizar(
        [tarefa.codigo, tarefa.titulo, tarefa.descricao, tarefa.responsavel?.nome, tarefa.criadoPor?.nome, tarefa.loja?.nome].join(" "),
      ).includes(termo),
    );
  }, [dados, busca]);

  const executarAcao = async (tipo, tarefa) => {
    setAviso("");
    if (tipo === "aceitar") {
      try {
        await api.post(`/tarefas/${tarefa.id}/aceitar`);
        setAviso(`${tarefa.codigo} aceita. Quando fizer, marque Feito.`);
        carregar();
      } catch (error) {
        setErro(mensagemDeErro(error, "Não foi possível aceitar."));
      }
      return;
    }
    setAcao({ tipo, tarefa });
  };

  const abas = ABAS.filter((item) => !item.soGestor || dados?.gestor);
  const pendentesParaMim = (dados?.tarefas || []).filter((t) => t.pode.aceitar || t.pode.feito).length;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Tarefas"
          subtitle="Quem pediu, para quem, quando: aceite a tarefa e marque Feito quando terminar"
          icon="✅"
          action={
            <button type="button" className="btn-primary" onClick={() => setCriando(true)}>
              ➕ Nova tarefa
            </button>
          }
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {abas.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAba(item.id)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${aba === item.id ? "bg-gray-900 text-white" : "bg-white text-gray-700 shadow-sm hover:bg-gray-100"}`}
            >
              {item.nome}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map((item) => (
              <button
                key={item.id || "todas"}
                type="button"
                onClick={() => setFiltro(item.id)}
                className={`rounded-full px-3 py-1 text-sm font-semibold ${filtro === item.id ? "bg-primary text-white" : "bg-white text-gray-600 shadow-sm hover:bg-gray-100"}`}
              >
                {item.nome}
              </button>
            ))}
          </div>
          <input className="input-field sm:max-w-xs" placeholder="🔍 Buscar (TAR-0001, nome, loja...)" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>

        {aviso && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{aviso}</p>}
        {erro && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        {filtro === "abertas" && pendentesParaMim > 0 && (
          <p className="mb-3 text-sm text-gray-600">
            <b>{pendentesParaMim}</b> esperando você (aceitar ou marcar Feito).
          </p>
        )}

        {!dados && !erro && <p className="py-10 text-center text-gray-500">Carregando...</p>}
        {dados && tarefas.length === 0 && (
          <div className="rounded-xl bg-white p-10 text-center text-gray-500 shadow-sm">Nenhuma tarefa aqui.</div>
        )}
        <div className="space-y-3">
          {tarefas.map((tarefa) => (
            <CartaoTarefa key={tarefa.id} tarefa={tarefa} onAcao={executarAcao} />
          ))}
        </div>
      </div>

      <TarefaForm
        aberto={criando}
        onFechar={() => setCriando(false)}
        onSalva={(tarefa) => {
          setAviso(`${tarefa.codigo} criada${tarefa.responsavel ? ` para ${tarefa.responsavel.nome}` : " (ninguém em especial)"}.`);
          carregar();
        }}
      />
      {acao && (
        <ModalAcao
          acao={acao.tipo}
          tarefa={acao.tarefa}
          usuarios={usuarios}
          onFechar={() => setAcao(null)}
          onFeito={(tarefa) => {
            setAcao(null);
            setAviso(
              acao.tipo === "feito"
                ? `${tarefa.codigo} feita.${tarefa.resultado?.mensagem ? ` ${tarefa.resultado.mensagem}` : ""}`
                : `${tarefa.codigo} atualizada.`,
            );
            carregar();
          }}
        />
      )}
      <Footer />
    </div>
  );
}

export default Tarefas;
