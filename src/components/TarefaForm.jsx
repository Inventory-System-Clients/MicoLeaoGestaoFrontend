import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Modal } from "./UIComponents";
import { SelectBusca } from "./SelectBusca";
import { obterPerfil } from "../utils/perfis";
import { ICONE_TIPO, dataBr, hojeBrasilia, mensagemDeErro, reais } from "../utils/tarefas";
import { rotuloPonto } from "../utils/lojas";

// Nova tarefa (Tarefas e Calendário). `inicial` pode vir com { data, tipo,
// dados } — ex.: do calendário, "Agendar pagamento" de uma conta.
// O tipo escolhido define o que acontece sozinho no "Feito".

const VAZIO = { titulo: "", descricao: "", tipo: "LIVRE", dados: {}, data: "", dataFim: "", responsavelId: "" };

export function TarefaForm({ aberto, onFechar, onSalva, inicial }) {
  const [opcoes, setOpcoes] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [variosDias, setVariosDias] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErro("");
    setVariosDias(Boolean(inicial?.dataFim));
    setForm({ ...VAZIO, data: hojeBrasilia(), ...inicial, dados: { ...(inicial?.dados || {}) } });
    api
      .get("/tarefas/opcoes")
      .then(({ data }) => setOpcoes(data))
      .catch((error) => setErro(mensagemDeErro(error, "Erro ao carregar as opções.")));
  }, [aberto, inicial]);

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));
  const mudarDado = (campo, valor) => setForm((atual) => ({ ...atual, dados: { ...atual.dados, [campo]: valor } }));

  const lojas = useMemo(() => opcoes?.lojas || [], [opcoes]);
  const nomeDaLoja = useMemo(() => new Map(lojas.map((loja) => [loja.id, loja.nome])), [lojas]);
  const opcoesMaquinas = useMemo(
    () =>
      (opcoes?.maquinas || []).map((maquina) => ({
        valor: maquina.id,
        rotulo: `${maquina.codigo}${maquina.nome ? ` · ${maquina.nome}` : ""}`,
        detalhe: maquina.lojaId ? nomeDaLoja.get(maquina.lojaId) || "" : "Depósito",
      })),
    [opcoes, nomeDaLoja],
  );
  const opcoesLojas = lojas.map((loja) => ({ valor: loja.id, rotulo: rotuloPonto(loja) }));
  const opcoesUsuarios = (opcoes?.usuarios || []).map((usuario) => ({
    valor: usuario.id,
    rotulo: usuario.nome,
    detalhe: obterPerfil(usuario.role).curto,
  }));
  const opcoesContas = (opcoes?.contas || []).map((conta) => ({
    valor: conta.id,
    rotulo: `${conta.descricao}${conta.totalParcelas > 1 ? ` (${conta.numeroParcela}/${conta.totalParcelas})` : ""}`,
    detalhe: `${reais(conta.valorBrl ?? conta.valor)} · vence ${dataBr(conta.vencimento)}`,
  }));
  const opcoesExtintores = (opcoes?.extintores || []).map((extintor) => ({
    valor: String(extintor.id),
    rotulo: `${nomeDaLoja.get(extintor.lojaId) || "Loja"}${extintor.identificacao ? ` · ${extintor.identificacao}` : ""}`,
    detalhe: `vence ${dataBr(extintor.dataVencimento)}`,
  }));
  const maquinaEscolhida = (opcoes?.maquinas || []).find((maquina) => maquina.id === form.dados.maquinaId);
  const tipoEscolhido = (opcoes?.tipos || []).find((tipo) => tipo.tipo === form.tipo);

  const salvar = async (evento) => {
    evento.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      const { data } = await api.post("/tarefas", { ...form, dataFim: variosDias ? form.dataFim : "" });
      onSalva?.(data);
      onFechar();
    } catch (error) {
      setErro(mensagemDeErro(error, "Erro ao criar a tarefa."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen={aberto} onClose={() => !salvando && onFechar()} title="Nova tarefa" size="md">
      {!opcoes && !erro && <p className="py-6 text-center text-gray-500">Carregando...</p>}
      {opcoes && (
        <form onSubmit={salvar} className="space-y-4 text-left">
          {/* Tipo */}
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-700">O que vai ser feito?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {opcoes.tipos.map((tipo) => (
                <button
                  key={tipo.tipo}
                  type="button"
                  onClick={() => setForm((atual) => ({ ...atual, tipo: tipo.tipo, dados: {} }))}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition ${
                    form.tipo === tipo.tipo
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <span className="mr-1">{ICONE_TIPO[tipo.tipo]}</span>
                  {tipo.nome}
                </button>
              ))}
            </div>
            {form.tipo !== "LIVRE" && (
              <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                ⚡ Quando o responsável marcar <b>Feito</b>, o sistema faz isso sozinho
                {tipoEscolhido?.pedeNoFeito ? ` (na hora ele informa: ${tipoEscolhido.pedeNoFeito.rotulo.toLowerCase()})` : ""}.
              </p>
            )}
          </div>

          {/* Campos da ação */}
          {["TRANSFERIR_MAQUINA", "STATUS_MAQUINA", "PRECO_MAQUINA"].includes(form.tipo) && (
            <label className="block text-sm font-semibold text-gray-700">
              Máquina *
              <div className="mt-1">
                <SelectBusca opcoes={opcoesMaquinas} valor={form.dados.maquinaId || ""} aoMudar={(valor) => mudarDado("maquinaId", valor)} placeholder="Buscar máquina..." required />
              </div>
              {maquinaEscolhida && (
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  Hoje: {maquinaEscolhida.lojaId ? nomeDaLoja.get(maquinaEscolhida.lojaId) : "no depósito"} ·{" "}
                  {maquinaEscolhida.statusOperacao === "PARADA" ? "parada" : "em operação"} ·{" "}
                  {maquinaEscolhida.categoriaGeradora === "MAQUINA"
                    ? `jogada ${reais(maquinaEscolhida.valorJogada)}`
                    : `ficha ${reais(maquinaEscolhida.valorFicha)}`}
                </span>
              )}
            </label>
          )}

          {form.tipo === "TRANSFERIR_MAQUINA" && (
            <label className="block text-sm font-semibold text-gray-700">
              Para onde *
              <div className="mt-1">
                <SelectBusca opcoes={opcoesLojas} valor={form.dados.lojaDestinoId || ""} aoMudar={(valor) => mudarDado("lojaDestinoId", valor || null)} opcaoVazia="📦 Depósito" placeholder="Buscar loja..." />
              </div>
            </label>
          )}

          {form.tipo === "STATUS_MAQUINA" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                {[
                  ["PARADA", "⏸️ Parar"],
                  ["EM_OPERACAO", "▶️ Ligar (voltar a operar)"],
                ].map(([valor, rotulo]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => mudarDado("statusOperacao", valor)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
                      form.dados.statusOperacao === valor ? "border-primary bg-primary/10 text-primary" : "border-gray-200 text-gray-700"
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              {form.dados.statusOperacao === "PARADA" && (
                <input className="input-field" placeholder="Motivo (ex.: reforma do shopping)" value={form.dados.motivoParada || ""} onChange={(e) => mudarDado("motivoParada", e.target.value)} />
              )}
            </div>
          )}

          {form.tipo === "PRECO_MAQUINA" && (
            <label className="block text-sm font-semibold text-gray-700">
              Novo valor da {maquinaEscolhida?.categoriaGeradora === "MAQUINA" ? "jogada" : "ficha"} (R$) *
              <input type="number" min="0.01" step="0.01" required className="input-field mt-1" value={form.dados.valor || ""} onChange={(e) => mudarDado("valor", e.target.value)} />
            </label>
          )}

          {form.tipo === "PAGAR_CONTA" && (
            <label className="block text-sm font-semibold text-gray-700">
              Conta a pagar *
              <div className="mt-1">
                <SelectBusca
                  opcoes={opcoesContas}
                  valor={form.dados.contaPagarId || ""}
                  aoMudar={(valor) => {
                    const conta = opcoes.contas.find((c) => c.id === valor);
                    setForm((atual) => ({ ...atual, data: conta?.vencimento || atual.data, dados: { contaPagarId: valor } }));
                  }}
                  placeholder="Buscar conta..."
                  required
                />
              </div>
            </label>
          )}

          {form.tipo === "TROCAR_EXTINTOR" && (
            <label className="block text-sm font-semibold text-gray-700">
              Extintor *
              <div className="mt-1">
                <SelectBusca opcoes={opcoesExtintores} valor={form.dados.extintorId ? String(form.dados.extintorId) : ""} aoMudar={(valor) => mudarDado("extintorId", valor)} placeholder="Buscar loja..." required />
              </div>
            </label>
          )}

          {form.tipo === "RENOVAR_CONTRATO" && (
            <label className="block text-sm font-semibold text-gray-700">
              Loja *
              <div className="mt-1">
                <SelectBusca opcoes={opcoesLojas} valor={form.dados.lojaId || ""} aoMudar={(valor) => mudarDado("lojaId", valor)} placeholder="Buscar loja..." required />
              </div>
            </label>
          )}

          {/* Comum */}
          <label className="block text-sm font-semibold text-gray-700">
            {form.tipo === "LIVRE" ? "O que precisa ser feito? *" : "Título (opcional)"}
            <input
              className="input-field mt-1"
              required={form.tipo === "LIVRE"}
              maxLength={200}
              placeholder={form.tipo === "LIVRE" ? "Ex.: Montar a decoração de Natal no Shopping X" : "Em branco: o sistema escreve sozinho"}
              value={form.titulo}
              onChange={(e) => mudar("titulo", e.target.value)}
            />
          </label>

          <label className="block text-sm font-semibold text-gray-700">
            Para quem
            <div className="mt-1">
              <SelectBusca opcoes={opcoesUsuarios} valor={form.responsavelId} aoMudar={(valor) => mudar("responsavelId", valor)} opcaoVazia="👥 Ninguém em especial" placeholder="Buscar pessoa..." />
            </div>
          </label>

          <div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-gray-700">
                {variosDias ? "Do dia *" : "Dia *"}
                <input type="date" required className="input-field mt-1" value={form.data} onChange={(e) => mudar("data", e.target.value)} />
              </label>
              {variosDias && (
                <label className="block text-sm font-semibold text-gray-700">
                  Até o dia *
                  <input type="date" required min={form.data || undefined} className="input-field mt-1" value={form.dataFim} onChange={(e) => mudar("dataFim", e.target.value)} />
                </label>
              )}
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={variosDias}
                onChange={(e) => {
                  setVariosDias(e.target.checked);
                  if (e.target.checked && !form.dataFim) mudar("dataFim", form.data);
                }}
              />
              Dura vários dias (ex.: decoração de Natal de 01/12 a 31/12)
            </label>
          </div>

          <label className="block text-sm font-semibold text-gray-700">
            Detalhes
            <textarea className="input-field mt-1" rows={2} value={form.descricao} onChange={(e) => mudar("descricao", e.target.value)} placeholder="Opcional" />
          </label>

          <p className="text-xs text-gray-500">
            {form.responsavelId
              ? "A pessoa escolhida precisa aceitar a tarefa e, quando fizer, marcar Feito."
              : "Sem responsável: você pode marcar Feito, pegar para você ou escolher alguém depois."}
            {variosDias ? " O prazo é o último dia." : ""}
          </p>

          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onFechar} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={salvando}>
              {salvando ? "Salvando..." : "Criar tarefa"}
            </button>
          </div>
        </form>
      )}
      {!opcoes && erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
    </Modal>
  );
}

export default TarefaForm;
