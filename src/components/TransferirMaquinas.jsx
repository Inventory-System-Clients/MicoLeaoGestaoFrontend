import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Modal } from "./UIComponents";
import { SelectBusca } from "./SelectBusca";
import { SeletorPessoas } from "./SeletorPessoas";

// Transferir uma ou várias máquinas para uma loja (ou o depósito).
// - Sem "quem vai transferir" e para hoje: transfere na hora.
// - Com pessoas (ou para outro dia): vira a tarefa "Transferir máquina" para
//   essas pessoas (uma por máquina, no Calendário/Tarefas); quando alguém
//   marca Feito, a máquina é transferida.
const DEPOSITO = "__DEPOSITO__";
const hojeBrasilia = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
const mensagemDeErro = (erro, padrao) => erro?.response?.data?.error || padrao;

export function TransferirMaquinas({ aberto, onFechar, onFeito }) {
  const [opcoes, setOpcoes] = useState(null);
  const [form, setForm] = useState({ maquinasIds: [], destino: "", data: hojeBrasilia(), pessoasIds: [], observacao: "" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    // Montado só quando abre (o estado já começa limpo)
    if (!aberto) return;
    api
      .get("/tarefas/opcoes")
      .then(({ data }) => setOpcoes(data || {}))
      .catch((e) => setErro(mensagemDeErro(e, "Erro ao carregar máquinas e lojas.")));
  }, [aberto]);

  const lojas = useMemo(() => opcoes?.lojas || [], [opcoes]);
  const maquinas = useMemo(() => opcoes?.maquinas || [], [opcoes]);
  const nomeLoja = (id) => (id ? lojas.find((l) => l.id === id)?.nome || "Loja" : "Depósito");
  const escolhidas = form.maquinasIds.map((id) => maquinas.find((m) => m.id === id)).filter(Boolean);
  const lojaDestinoId = form.destino === DEPOSITO ? null : form.destino || null;
  const agendar = form.pessoasIds.length > 0 || form.data !== hojeBrasilia();

  const salvar = async (evento) => {
    evento.preventDefault();
    setErro("");
    if (!escolhidas.length) return setErro("Escolha pelo menos uma máquina.");
    if (!form.destino) return setErro("Escolha para onde vão as máquinas.");
    const jaEstao = escolhidas.filter((m) => (m.lojaId || null) === lojaDestinoId);
    if (jaEstao.length) return setErro(`Já estão no destino: ${jaEstao.map((m) => m.codigo).join(", ")}. Tire da lista.`);
    setSalvando(true);
    const ok = [];
    const falhas = [];
    for (const maquina of escolhidas) {
      try {
        if (agendar) {
          await api.post("/tarefas", {
            tipo: "TRANSFERIR_MAQUINA",
            dados: { maquinaId: maquina.id, lojaDestinoId },
            data: form.data,
            responsaveisIds: form.pessoasIds,
            descricao: form.observacao.trim() || null,
          });
        } else {
          await api.post(`/maquinas/${maquina.id}/transferir`, {
            lojaDestinoId,
            dataTransferencia: form.data,
            observacao: form.observacao.trim() || null,
          });
        }
        ok.push(maquina.codigo);
      } catch (e) {
        falhas.push(`${maquina.codigo}: ${mensagemDeErro(e, "erro")}`);
      }
    }
    setSalvando(false);
    setResultado({ agendar, ok, falhas });
    if (ok.length) onFeito?.();
  };

  return (
    <Modal isOpen={aberto} onClose={() => !salvando && onFechar()} title="🔁 Transferir máquinas" size="md">
      {!opcoes && !erro && <p className="py-6 text-center text-gray-500">Carregando...</p>}
      {resultado ? (
        <div className="space-y-3">
          {resultado.ok.length > 0 && (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              {resultado.agendar
                ? `✅ Tarefa criada para ${resultado.ok.length} máquina(s): ${resultado.ok.join(", ")}. Quando marcarem Feito, a máquina é transferida.`
                : `✅ Transferida(s): ${resultado.ok.join(", ")}.`}
            </p>
          )}
          {resultado.falhas.length > 0 && (
            <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
              <p className="font-bold">Não deu certo:</p>
              {resultado.falhas.map((f) => (
                <p key={f}>• {f}</p>
              ))}
            </div>
          )}
          <button type="button" onClick={onFechar} className="btn-primary w-full">Fechar</button>
        </div>
      ) : (
        opcoes && (
          <form onSubmit={salvar} className="space-y-4">
            <div>
              <p className="mb-1 text-sm font-bold text-gray-700">🎰 Quais máquinas?</p>
              <SelectBusca
                opcoes={maquinas
                  .filter((m) => !form.maquinasIds.includes(m.id))
                  .map((m) => ({ valor: m.id, rotulo: `${m.codigo}${m.nome ? ` – ${m.nome}` : ""}`, detalhe: nomeLoja(m.lojaId) }))}
                valor=""
                aoMudar={(id) => id && setForm((f) => ({ ...f, maquinasIds: [...f.maquinasIds, id] }))}
                placeholder="Adicionar máquina (pode ser mais de uma)..."
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {escolhidas.length === 0 && <span className="text-sm text-gray-500">Nenhuma máquina escolhida.</span>}
                {escolhidas.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-800">
                    {m.codigo}
                    <span className="text-xs font-normal text-sky-600">({nomeLoja(m.lojaId)})</span>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, maquinasIds: f.maquinasIds.filter((x) => x !== m.id) }))}
                      className="ml-1 text-sky-500 hover:text-red-600"
                      aria-label={`Tirar ${m.codigo}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-bold text-gray-700">📍 Para onde?</p>
              <SelectBusca
                opcoes={[{ valor: DEPOSITO, rotulo: "📦 Depósito (sem loja)" }, ...lojas.map((l) => ({ valor: l.id, rotulo: l.nome }))]}
                valor={form.destino}
                aoMudar={(destino) => setForm((f) => ({ ...f, destino }))}
                placeholder="Buscar loja ou depósito"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold text-gray-700">
                📅 Quando
                <input
                  type="date"
                  value={form.data}
                  min={hojeBrasilia()}
                  onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                  className="input-field mt-1 w-full"
                  required
                />
              </label>
              <label className="text-sm font-bold text-gray-700">
                📝 Observação
                <input
                  value={form.observacao}
                  onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
                  placeholder="Opcional"
                  className="input-field mt-1 w-full"
                />
              </label>
            </div>

            <div>
              <p className="mb-1 text-sm font-bold text-gray-700">👥 Quem vai transferir (opcional)</p>
              <SeletorPessoas
                opcoes={opcoes.usuarios || []}
                valor={form.pessoasIds}
                aoMudar={(pessoasIds) => setForm((f) => ({ ...f, pessoasIds }))}
                placeholder="Adicionar pessoa (pode ser mais de uma)..."
                vazio="Ninguém: transfere agora"
              />
            </div>

            <p className={`rounded-lg p-3 text-sm ${agendar ? "bg-violet-50 text-violet-800" : "bg-amber-50 text-amber-900"}`}>
              {agendar
                ? `📋 Vira tarefa "Transferir máquina"${form.pessoasIds.length ? " para as pessoas escolhidas" : ""} no dia ${form.data.split("-").reverse().join("/")} (aparece no Calendário). Quando alguém marcar Feito, a máquina é transferida.`
                : "⚡ As máquinas são transferidas agora."}
            </p>

            {erro && <p className="text-sm text-rose-600">{erro}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={onFechar} disabled={salvando} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={salvando} className="btn-primary">
                {salvando ? "Salvando..." : agendar ? `Agendar (${escolhidas.length})` : `Transferir (${escolhidas.length})`}
              </button>
            </div>
          </form>
        )
      )}
      {!opcoes && erro && <p className="text-sm text-rose-600">{erro}</p>}
    </Modal>
  );
}

export default TransferirMaquinas;
