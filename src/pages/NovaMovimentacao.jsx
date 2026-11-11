import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { SelectBusca } from "../components/SelectBusca";
import { PontoRapido } from "../components/PontoRapido";
import { MinhasMetas } from "../components/MinhasMetas";
import { useAuth } from "../contexts/AuthContext";
import { enviarImagemParaCloudinary } from "../utils/cloudinary";

// Movimentação em passos (Consultor de Vendas): loja → máquina → checklist
// F Foto do relógio (IN/OUT) · A Abastecimento · M Movimentação ·
// Lv Limpeza do vidro · Rf Recolhimento de fichas · Lp Limpeza do piso ·
// C Conferência final (portas, cadeados, chaves). Salva quando tudo está ✓.

const FORM_VAZIO = {
  contadorIn: "",
  contadorOut: "",
  fotoUrl: "",
  abastecidas: "",
  produtoId: "",
  totalPre: "",
  retirada: "",
  limpezaVidro: false,
  fichas: "",
  notas: "",
  pix: "",
  limpezaPiso: false,
  portas: false,
  cadeados: false,
  chaves: false,
  observacoes: "",
};

const inteiro = (valor) => (valor === "" || valor === null || valor === undefined ? null : Math.max(0, Math.floor(Number(valor))));
const mensagemDeErro = (erro, padrao) => erro?.response?.data?.error || erro?.message || padrao;

function Passo({ sigla, titulo, feito, aberto, aoAbrir, children }) {
  return (
    <div className={`rounded-2xl border bg-white shadow-sm transition ${feito ? "border-emerald-200" : "border-gray-200"}`}>
      <button type="button" onClick={aoAbrir} className="flex w-full items-center gap-3 p-3 text-left">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black transition ${
            feito ? "bg-emerald-500 text-white shadow-md" : "bg-gray-100 text-gray-400"
          }`}
        >
          {feito ? "✓" : sigla}
        </span>
        <span className="flex-1 font-black text-gray-900">{titulo}</span>
        <span className="text-gray-400">{aberto ? "▲" : "▼"}</span>
      </button>
      {aberto && <div className="space-y-3 border-t border-gray-100 p-4">{children}</div>}
    </div>
  );
}

function CampoNumero({ rotulo, valor, aoMudar, dica, autoFocus }) {
  return (
    <label className="block text-sm font-semibold text-gray-700">
      {rotulo}
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={valor}
        autoFocus={autoFocus}
        onChange={(e) => aoMudar(e.target.value)}
        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-3 text-lg font-bold outline-none focus:border-orange-400"
      />
      {dica && <span className="mt-0.5 block text-xs font-normal text-gray-500">{dica}</span>}
    </label>
  );
}

function Marcar({ rotulo, marcado, aoMudar }) {
  return (
    <button
      type="button"
      onClick={() => aoMudar(!marcado)}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left font-bold transition ${
        marcado ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-white text-gray-700"
      }`}
    >
      {rotulo}
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${marcado ? "bg-emerald-500" : "bg-gray-200"}`}>
        {marcado ? "✓" : ""}
      </span>
    </button>
  );
}

export function NovaMovimentacao() {
  const { usuario } = useAuth();
  const [lojas, setLojas] = useState(null);
  const [lojaId, setLojaId] = useState("");
  const [maquinaId, setMaquinaId] = useState("");
  const [contexto, setContexto] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [aberto, setAberto] = useState("F");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  const carregarLojas = useCallback(async () => {
    try {
      const { data } = await api.get("/visitas/lojas");
      setLojas(data);
      if (data.length === 1) setLojaId((atual) => atual || data[0].id);
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao carregar as lojas"));
      setLojas([]);
    }
  }, []);

  useEffect(() => {
    carregarLojas();
  }, [carregarLojas]);

  const loja = lojas?.find((l) => l.id === lojaId);

  const escolherMaquina = async (id) => {
    setMaquinaId(id);
    setContexto(null);
    setForm(FORM_VAZIO);
    setAberto("F");
    setErro("");
    setSucesso("");
    if (!id) return;
    try {
      const { data } = await api.get(`/visitas/maquinas/${id}`);
      setContexto(data);
      if (data.produtoSugeridoId && data.estoque.some((e) => e.produtoId === data.produtoSugeridoId)) {
        setForm((f) => ({ ...f, produtoId: data.produtoSugeridoId }));
      }
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao carregar a máquina"));
    }
  };

  const mudar = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const ultima = contexto?.ultima;
  const inAnterior = ultima?.contadorIn != null ? Number(ultima.contadorIn) : null;

  // Fichas sugeridas pelo relógio: IN de agora - IN da última visita
  const fichasPeloRelogio =
    inAnterior !== null && form.contadorIn !== "" && Number(form.contadorIn) >= inAnterior
      ? Number(form.contadorIn) - inAnterior
      : null;

  const produtoEscolhido = contexto?.estoque.find((e) => e.produtoId === form.produtoId);
  const abastecidas = inteiro(form.abastecidas) ?? 0;

  const feito = {
    F: form.contadorIn !== "" && form.contadorOut !== "" && Boolean(form.fotoUrl),
    A: form.abastecidas !== "" && (abastecidas === 0 || (Boolean(form.produtoId) && abastecidas <= (produtoEscolhido?.quantidade ?? 0))),
    M: form.totalPre !== "",
    Lv: form.limpezaVidro,
    Rf: form.fichas !== "",
    Lp: form.limpezaPiso,
    C: form.portas && form.cadeados && form.chaves,
  };
  const ordem = ["F", "A", "M", "Lv", "Rf", "Lp", "C"];
  const feitos = ordem.filter((p) => feito[p]).length;
  const tudoPronto = feitos === ordem.length;

  // Ao completar um passo, abre o próximo que falta
  const proximoQueFalta = ordem.find((p) => !feito[p]);
  const concluirPasso = (passo) => {
    if (feito[passo] && proximoQueFalta) setAberto(proximoQueFalta);
  };

  const enviarFoto = async (arquivo) => {
    if (!arquivo) return;
    setEnviandoFoto(true);
    setErro("");
    try {
      const url = await enviarImagemParaCloudinary(arquivo);
      setForm((f) => ({ ...f, fotoUrl: url }));
    } catch {
      setErro("Não foi possível enviar a foto. Verifique a internet e tente de novo.");
    } finally {
      setEnviandoFoto(false);
    }
  };

  const salvar = async () => {
    if (!tudoPronto) return;
    setSalvando(true);
    setErro("");
    try {
      const totalPre = inteiro(form.totalPre);
      const retirada = inteiro(form.retirada) ?? 0;
      const ultimoTotal = Number(ultima?.totalPos ?? totalPre);
      const sairam = Math.max(0, ultimoTotal - totalPre);
      await api.post("/visitas", {
        maquinaId,
        totalPre,
        sairam,
        abastecidas,
        totalPos: Math.max(0, totalPre + abastecidas - retirada),
        fichas: inteiro(form.fichas),
        contadorIn: inteiro(form.contadorIn),
        contadorOut: inteiro(form.contadorOut),
        quantidade_notas_entrada: inteiro(form.notas),
        valor_entrada_maquininha_pix: form.pix === "" ? null : Number(form.pix),
        retiradaEstoque: false,
        observacoes: form.observacoes.trim() || null,
        fotoRelogioUrl: form.fotoUrl,
        checklist: {
          limpezaVidro: form.limpezaVidro,
          recolhimentoFichas: true,
          limpezaPiso: form.limpezaPiso,
          portas: form.portas,
          cadeados: form.cadeados,
          chaves: form.chaves,
        },
        produtos: form.produtoId
          ? [{ produtoId: form.produtoId, quantidadeSaiu: sairam, quantidadeAbastecida: abastecidas, retiradaProduto: retirada }]
          : [],
      });
      const maquina = loja?.maquinas.find((m) => m.id === maquinaId);
      setSucesso(`Movimentação da máquina ${maquina?.codigo || ""} salva! ✅`);
      setMaquinaId("");
      setContexto(null);
      setForm(FORM_VAZIO);
      await carregarLojas();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível salvar a movimentação"));
    } finally {
      setSalvando(false);
    }
  };

  const feitasNaLoja = loja?.maquinas.filter((m) => m.feitaHoje).length || 0;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern pb-24">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <PontoRapido />

        <h1 className="mb-1 text-3xl font-black text-gray-900">Movimentação</h1>
        <p className="mb-5 text-sm text-gray-500">Olá, {usuario?.nome?.split(" ")[0]}! Escolha a loja e a máquina e siga os passos.</p>

        {sucesso && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
            <span>{sucesso}</span>
            <button type="button" onClick={() => setSucesso("")}>✕</button>
          </div>
        )}
        {erro && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{erro}</div>}

        {/* Lojas */}
        <div className="mb-3">
          <SelectBusca
            opcoes={(lojas || []).map((l) => ({ valor: l.id, rotulo: l.nome, detalhe: `${l.maquinas.filter((m) => m.feitaHoje).length}/${l.maquinas.length}` }))}
            valor={lojaId}
            aoMudar={(id) => {
              setLojaId(id);
              escolherMaquina("");
            }}
            placeholder="🏪 Lojas"
            className="py-3 text-lg font-bold"
          />
          {lojas && lojas.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">Nenhuma loja liberada para você. Fale com o administrador.</p>
          )}
        </div>

        {/* Máquinas */}
        {loja && (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-black text-gray-700">🎰 Máquinas</p>
              <p className="text-xs text-gray-500">{feitasNaLoja} de {loja.maquinas.length} feitas hoje</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {loja.maquinas.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => escolherMaquina(m.id)}
                  className={`rounded-xl border-2 p-3 text-left transition ${
                    maquinaId === m.id
                      ? "border-orange-500 bg-orange-50"
                      : m.feitaHoje
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <p className="flex items-center justify-between font-black text-gray-900">
                    {m.codigo}
                    {m.feitaHoje && <span className="text-emerald-600">✓</span>}
                  </p>
                  <p className="truncate text-xs text-gray-500">{m.tipo || m.nome || "Máquina"}</p>
                </button>
              ))}
            </div>
            {loja.maquinas.length === 0 && <p className="text-sm text-gray-500">Essa loja não tem máquinas.</p>}
          </div>
        )}

        {/* Checklist */}
        {maquinaId && !contexto && !erro && (
          <div className="flex justify-center py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        )}
        {contexto && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(feitos / ordem.length) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-gray-500">{feitos}/{ordem.length}</span>
            </div>

            <Passo sigla="F" titulo="Foto do relógio" feito={feito.F} aberto={aberto === "F"} aoAbrir={() => setAberto(aberto === "F" ? "" : "F")}>
              <div className="grid grid-cols-2 gap-3">
                <CampoNumero rotulo="Contador IN" valor={form.contadorIn} aoMudar={mudar("contadorIn")} dica={inAnterior !== null ? `Última: ${inAnterior}` : null} />
                <CampoNumero rotulo="Contador OUT" valor={form.contadorOut} aoMudar={mudar("contadorOut")} dica={ultima?.contadorOut != null ? `Última: ${ultima.contadorOut}` : null} />
              </div>
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-3 ${form.fotoUrl ? "border-emerald-300 bg-emerald-50" : "border-gray-300 bg-gray-50"}`}>
                {form.fotoUrl ? (
                  <img src={form.fotoUrl} alt="Relógio" className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-white text-3xl">📷</span>
                )}
                <span className="text-sm font-bold text-gray-700">
                  {enviandoFoto ? "Enviando foto..." : form.fotoUrl ? "Foto enviada ✓ (toque para trocar)" : "Tirar foto do relógio"}
                </span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => enviarFoto(e.target.files?.[0])} />
              </label>
              <button type="button" onClick={() => concluirPasso("F")} disabled={!feito.F} className="btn-primary w-full disabled:opacity-40">Próximo</button>
            </Passo>

            <Passo sigla="A" titulo="Abastecimento" feito={feito.A} aberto={aberto === "A"} aoAbrir={() => setAberto(aberto === "A" ? "" : "A")}>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <CampoNumero rotulo="Quantidade" valor={form.abastecidas} aoMudar={mudar("abastecidas")} dica="0 se não abasteceu" />
                </div>
                <div className="col-span-2 text-sm font-semibold text-gray-700">
                  Produto (SKU)
                  <div className="mt-1">
                    <SelectBusca
                      opcoes={(contexto.estoque || []).map((e) => ({ valor: e.produtoId, rotulo: e.nome, detalhe: `${e.codigo ? `SKU ${e.codigo} · ` : ""}${e.quantidade} na loja` }))}
                      valor={form.produtoId}
                      aoMudar={mudar("produtoId")}
                      placeholder="Buscar produto ou SKU"
                      className="py-3"
                    />
                  </div>
                </div>
              </div>
              {produtoEscolhido && abastecidas > produtoEscolhido.quantidade && (
                <p className="text-sm text-rose-600">A loja só tem {produtoEscolhido.quantidade} desse produto.</p>
              )}
              {(contexto.estoque || []).length === 0 && <p className="text-xs text-amber-700">A loja está sem estoque de produtos.</p>}
              <button type="button" onClick={() => concluirPasso("A")} disabled={!feito.A} className="btn-primary w-full disabled:opacity-40">Próximo</button>
            </Passo>

            <Passo sigla="M" titulo="Movimentação" feito={feito.M} aberto={aberto === "M"} aoAbrir={() => setAberto(aberto === "M" ? "" : "M")}>
              <CampoNumero
                rotulo="Quantas pelúcias tinha na máquina (antes de abastecer)"
                valor={form.totalPre}
                aoMudar={mudar("totalPre")}
                dica={ultima?.totalPos != null ? `Na última visita ficaram ${ultima.totalPos}` : null}
              />
              <CampoNumero rotulo="Retirada de pelúcias (opcional)" valor={form.retirada} aoMudar={mudar("retirada")} />
              {form.totalPre !== "" && (
                <p className="rounded-lg bg-gray-50 p-2 text-sm text-gray-600">
                  Vai ficar com <b>{Math.max(0, (inteiro(form.totalPre) ?? 0) + abastecidas - (inteiro(form.retirada) ?? 0))}</b> pelúcias
                  {contexto.maquina?.capacidadePadrao ? ` de ${contexto.maquina.capacidadePadrao}` : ""}.
                </p>
              )}
              <button type="button" onClick={() => concluirPasso("M")} disabled={!feito.M} className="btn-primary w-full disabled:opacity-40">Próximo</button>
            </Passo>

            <Passo sigla="Lv" titulo="Limpeza do vidro" feito={feito.Lv} aberto={aberto === "Lv"} aoAbrir={() => setAberto(aberto === "Lv" ? "" : "Lv")}>
              <Marcar rotulo="Vidro limpo" marcado={form.limpezaVidro} aoMudar={(v) => { mudar("limpezaVidro")(v); if (v) setAberto("Rf"); }} />
            </Passo>

            <Passo sigla="Rf" titulo="Recolhimento de fichas" feito={feito.Rf} aberto={aberto === "Rf"} aoAbrir={() => setAberto(aberto === "Rf" ? "" : "Rf")}>
              <CampoNumero
                rotulo="Fichas recolhidas"
                valor={form.fichas}
                aoMudar={mudar("fichas")}
                dica={fichasPeloRelogio !== null ? `Pelo relógio: ${fichasPeloRelogio}` : null}
              />
              {fichasPeloRelogio !== null && form.fichas === "" && (
                <button type="button" onClick={() => mudar("fichas")(String(fichasPeloRelogio))} className="text-sm font-bold text-blue-600">
                  Usar {fichasPeloRelogio} (pelo relógio)
                </button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <CampoNumero rotulo="Notas (opcional)" valor={form.notas} aoMudar={mudar("notas")} />
                <label className="block text-sm font-semibold text-gray-700">
                  PIX / cartão (R$, opcional)
                  <input type="number" step="0.01" inputMode="decimal" value={form.pix} onChange={(e) => mudar("pix")(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-3 text-lg font-bold" />
                </label>
              </div>
              <button type="button" onClick={() => concluirPasso("Rf")} disabled={!feito.Rf} className="btn-primary w-full disabled:opacity-40">Próximo</button>
            </Passo>

            <Passo sigla="Lp" titulo="Limpeza do piso" feito={feito.Lp} aberto={aberto === "Lp"} aoAbrir={() => setAberto(aberto === "Lp" ? "" : "Lp")}>
              <Marcar rotulo="Piso limpo" marcado={form.limpezaPiso} aoMudar={(v) => { mudar("limpezaPiso")(v); if (v) setAberto("C"); }} />
            </Passo>

            <Passo sigla="C" titulo="Conferência final" feito={feito.C} aberto={aberto === "C"} aoAbrir={() => setAberto(aberto === "C" ? "" : "C")}>
              <Marcar rotulo="🚪 Portas" marcado={form.portas} aoMudar={mudar("portas")} />
              <Marcar rotulo="🔒 Cadeados" marcado={form.cadeados} aoMudar={mudar("cadeados")} />
              <Marcar rotulo="🔑 Chaves" marcado={form.chaves} aoMudar={mudar("chaves")} />
            </Passo>

            <textarea
              value={form.observacoes}
              onChange={(e) => mudar("observacoes")(e.target.value)}
              rows={2}
              placeholder="Observação (opcional)"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            />

            <button
              type="button"
              onClick={salvar}
              disabled={!tudoPronto || salvando}
              className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 py-4 text-lg font-black text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {salvando ? "Salvando..." : tudoPronto ? "Salvar movimentação" : `Faltam ${ordem.length - feitos} passo(s)`}
            </button>
          </div>
        )}

        <MinhasMetas className="mt-8" />
      </main>
    </div>
  );
}

export default NovaMovimentacao;
