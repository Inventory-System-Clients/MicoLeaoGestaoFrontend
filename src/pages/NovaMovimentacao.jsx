import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { SelectBusca } from "../components/SelectBusca";
import { PontoRapido } from "../components/PontoRapido";
import { MinhasMetas } from "../components/MinhasMetas";
import { useAuth } from "../contexts/AuthContext";
import { enviarImagemParaCloudinary } from "../utils/cloudinary";

// Movimentação em passos (Consultor de Vendas): loja → máquina → checklist
// F Foto do relógio (IN/OUT, contagem e cálculo automático) · A Abastecimento ·
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
  recolheuFichas: false,
  limpezaPiso: false,
  portas: false,
  cadeados: false,
  chaves: false,
  observacoes: "",
};

const marca = (ok) => (ok ? "✅" : "❌");

// Mensagem da movimentação pro WhatsApp: tudo o que foi feito na visita
const montarMensagemWhatsapp = (v) => {
  const linhas = [
    "🎰 *MOVIMENTAÇÃO DE MÁQUINA*",
    "",
    `👤 *Quem fez:* ${v.usuario}`,
    `📅 *Data/hora:* ${v.dataHora}`,
    `🏪 *Loja:* ${v.loja}`,
    `🎮 *Máquina:* ${v.maquina}`,
    "",
    "📸 *Relógio*",
    `-> IN: ${v.contadorIn}${v.inAnterior !== null ? ` (anterior ${v.inAnterior})` : ""}`,
    `-> OUT: ${v.contadorOut}${v.outAnterior !== null ? ` (anterior ${v.outAnterior})` : ""}`,
    "",
    "🧸 *Pelúcias*",
    `-> Tinha na máquina: ${v.totalPre}`,
    ...(v.sairam !== null ? [`-> Saíram desde a última: ${v.sairam}`] : []),
    `-> Abastecido: ${v.abastecidas}${v.produto ? ` (${v.produto})` : ""}`,
    ...(v.retirada ? [`-> Retirada: ${v.retirada}`] : []),
    `-> Ficou com: ${v.totalPos}${v.capacidade ? ` de ${v.capacidade}` : ""}`,
    "",
    "🪙 *Fichas*",
    `-> Entre a movimentação anterior e a atual: ${v.fichasDoDia}`,
    ...(v.fichasPendentes ? [`-> Não recolhidas antes: ${v.fichasPendentes}`] : []),
    v.recolheu
      ? `-> ✅ Recolhidas: ${v.fichasDoDia + v.fichasPendentes}`
      : `-> ❌ Não recolhidas (acumulado na máquina: ${v.fichasDoDia + v.fichasPendentes})`,
    "",
    "🧾 *Checklist*",
    `🧽 Limpeza do vidro ${marca(v.limpezaVidro)}`,
    `🧹 Limpeza do piso ${marca(v.limpezaPiso)}`,
    `🚪 Portas ${marca(v.portas)}  🔒 Cadeados ${marca(v.cadeados)}  🔑 Chaves ${marca(v.chaves)}`,
    ...(v.observacoes ? ["", `📝 *Observação:* ${v.observacoes}`] : []),
    ...(v.fotoUrl ? ["", `📷 Foto do relógio: ${v.fotoUrl}`] : []),
  ];
  return linhas.join("\n");
};

const abrirWhatsapp = (mensagem) =>
  window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener,noreferrer");

const inteiro = (valor) => (valor === "" || valor === null || valor === undefined ? null : Math.max(0, Math.floor(Number(valor))));
const mensagemDeErro = (erro, padrao) => erro?.response?.data?.error || erro?.message || padrao;

// Passo do checklist. Com conteúdo (campos pra preencher) abre e fecha, e o
// ✓ aparece sozinho quando tudo está preenchido. `simples`: só marcar feito —
// um toque na linha marca/desmarca, sem abrir nada.
function Passo({ icone, titulo, feito, aberto, aoAbrir, simples = false, aoMarcar, children }) {
  return (
    <div className={`rounded-2xl border bg-white shadow-sm transition ${feito ? "border-emerald-300 bg-emerald-50/40" : "border-gray-200"}`}>
      <button
        type="button"
        onClick={simples ? () => aoMarcar(!feito) : aoAbrir}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-2xl">{icone}</span>
        <span className={`flex-1 font-black ${feito ? "text-emerald-800" : "text-gray-900"}`}>{titulo}</span>
        {simples ? (
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 text-lg font-black transition ${
              feito ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 bg-white text-transparent"
            }`}
          >
            ✓
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {feito && (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-sm font-black text-white">✓</span>
            )}
            <span className="text-gray-400">{aberto ? "▲" : "▼"}</span>
          </span>
        )}
      </button>
      {!simples && aberto && <div className="space-y-3 border-t border-gray-100 p-4">{children}</div>}
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
  const [mensagemWhatsapp, setMensagemWhatsapp] = useState("");

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
    // No celular, leva a máquina escolhida pro topo da tela
    requestAnimationFrame(() =>
      document.getElementById(`maquina-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    try {
      const { data } = await api.get(`/visitas/maquinas/${id}`);
      setContexto(data);
      // Produto cadastrado na máquina já vem escolhido
      if (data.produtoSugeridoId) {
        setForm((f) => ({ ...f, produtoId: data.produtoSugeridoId }));
      }
    } catch (e) {
      setErro(mensagemDeErro(e, "Erro ao carregar a máquina"));
    }
  };

  const mudar = (campo) => (valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const ultima = contexto?.ultima;
  const inAnterior = ultima?.contadorIn != null ? Number(ultima.contadorIn) : null;
  const outAnterior = ultima?.contadorOut != null ? Number(ultima.contadorOut) : null;
  const diferenca = (atual, anterior) =>
    anterior !== null && atual !== "" && Number(atual) >= anterior ? Number(atual) - anterior : null;

  // Cálculo automático com o relógio e a contagem (aparece na Foto do relógio)
  const fichasPeloRelogio = diferenca(form.contadorIn, inAnterior);
  const premiosPeloRelogio = diferenca(form.contadorOut, outAnterior);
  const totalPreNumero = inteiro(form.totalPre);
  const saiuPelaContagem =
    totalPreNumero !== null && ultima?.totalPos != null ? Math.max(0, Number(ultima.totalPos) - totalPreNumero) : null;
  const relogioNaoBate =
    premiosPeloRelogio !== null && saiuPelaContagem !== null && premiosPeloRelogio !== saiuPelaContagem;

  // Contador IN preenche as fichas sozinho (dá pra corrigir no Recolhimento)
  const mudarContadorIn = (valor) =>
    setForm((f) => {
      const fichas = diferenca(valor, inAnterior);
      return { ...f, contadorIn: valor, fichas: f.fichasEditadas || fichas === null ? f.fichas : String(fichas) };
    });

  const produtoEscolhido = contexto?.estoque.find((e) => e.produtoId === form.produtoId);
  const abastecidas = inteiro(form.abastecidas) ?? 0;

  // Sugestão de abastecimento: completar até a capacidade padrão da máquina,
  // com o que tem nela agora (menos a retirada). Limitada ao estoque da loja.
  const capacidadePadrao = Number(contexto?.maquina?.capacidadePadrao) || 0;
  const sugestaoAbastecer =
    capacidadePadrao > 0 && totalPreNumero !== null
      ? Math.min(
          Math.max(0, capacidadePadrao - (totalPreNumero - (inteiro(form.retirada) ?? 0))),
          produtoEscolhido ? produtoEscolhido.quantidade : Infinity,
        )
      : null;

  const feito = {
    F: form.contadorIn !== "" && form.contadorOut !== "" && form.totalPre !== "" && Boolean(form.fotoUrl),
    A: form.abastecidas !== "" && (abastecidas === 0 || (Boolean(form.produtoId) && abastecidas <= (produtoEscolhido?.quantidade ?? 0))),
    Lv: form.limpezaVidro,
    Lp: form.limpezaPiso,
    C: form.portas && form.cadeados && form.chaves,
  };
  // Recolhimento de fichas é opcional: fica fora da conta dos passos
  const ordem = ["F", "A", "Lv", "Lp", "C"];
  const feitos = ordem.filter((p) => feito[p]).length;
  const tudoPronto = feitos === ordem.length;

  // Ao completar um passo, abre o próximo que falta
  // Só os passos com campos abrem; os simples (limpezas) são um toque
  const proximoQueFalta = ["F", "A", "C"].find((p) => !feito[p]);
  const concluirPasso = (passo) => {
    if (feito[passo]) setAberto(proximoQueFalta || "");
  };

  // Fichas: as do dia vêm do contador IN (dá pra corrigir); as que ficaram
  // sem recolher em movimentações anteriores somam no recolhimento
  const fichasDoDia = form.fichas !== "" ? (inteiro(form.fichas) ?? 0) : (fichasPeloRelogio ?? 0);
  const fichasPendentes = contexto?.fichasPendentes?.total ?? 0;
  const fichasNaMaquina = fichasDoDia + fichasPendentes;

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
        fichas: fichasDoDia,
        contadorIn: inteiro(form.contadorIn),
        contadorOut: inteiro(form.contadorOut),
        retiradaEstoque: false,
        observacoes: form.observacoes.trim() || null,
        fotoRelogioUrl: form.fotoUrl,
        checklist: {
          limpezaVidro: form.limpezaVidro,
          recolhimentoFichas: form.recolheuFichas,
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
      const mensagem = montarMensagemWhatsapp({
        usuario: usuario?.nome || "",
        dataHora: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }),
        loja: loja?.nome || "",
        maquina: `${maquina?.codigo || ""}${maquina?.tipo ? ` – ${maquina.tipo}` : ""}`,
        contadorIn: inteiro(form.contadorIn),
        contadorOut: inteiro(form.contadorOut),
        inAnterior,
        outAnterior,
        totalPre,
        sairam: ultima?.totalPos != null ? sairam : null,
        abastecidas,
        produto: abastecidas && produtoEscolhido
          ? `${produtoEscolhido.nome}${produtoEscolhido.codigo ? ` · SKU ${produtoEscolhido.codigo}` : ""}`
          : "",
        retirada,
        totalPos: Math.max(0, totalPre + abastecidas - retirada),
        capacidade: capacidadePadrao,
        fichasDoDia,
        fichasPendentes,
        recolheu: form.recolheuFichas,
        limpezaVidro: form.limpezaVidro,
        limpezaPiso: form.limpezaPiso,
        portas: form.portas,
        cadeados: form.cadeados,
        chaves: form.chaves,
        observacoes: form.observacoes.trim(),
        fotoUrl: form.fotoUrl,
      });
      setMensagemWhatsapp(mensagem);
      abrirWhatsapp(mensagem);
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

  // Formulário da máquina escolhida: abre embaixo dela (fica bom no celular)
  const formularioDaMaquina = contexto ? (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(feitos / ordem.length) * 100}%` }} />
          </div>
          <span className="text-xs font-bold text-gray-500">{feitos}/{ordem.length}</span>
        </div>

        <Passo icone="📸" titulo="Foto do relógio" feito={feito.F} aberto={aberto === "F"} aoAbrir={() => setAberto(aberto === "F" ? "" : "F")}>
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
          <div className="grid grid-cols-2 gap-3">
            <CampoNumero rotulo="Contador IN" valor={form.contadorIn} aoMudar={mudarContadorIn} dica={inAnterior !== null ? `Última: ${inAnterior}` : null} />
            <CampoNumero rotulo="Contador OUT" valor={form.contadorOut} aoMudar={mudar("contadorOut")} dica={outAnterior !== null ? `Última: ${outAnterior}` : null} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CampoNumero
              rotulo="Pelúcias na máquina agora"
              valor={form.totalPre}
              aoMudar={mudar("totalPre")}
              dica={ultima?.totalPos != null ? `Ficaram ${ultima.totalPos} na última` : "Antes de abastecer"}
            />
            <CampoNumero rotulo="Retirada (opcional)" valor={form.retirada} aoMudar={mudar("retirada")} dica="Pelúcias tiradas" />
          </div>
          {(fichasPeloRelogio !== null || premiosPeloRelogio !== null || saiuPelaContagem !== null) && (
            <div className="rounded-xl bg-gray-900 p-3 text-white">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Cálculo automático</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-2xl font-black">{fichasPeloRelogio ?? "-"}</p>
                  <p className="text-[11px] text-gray-300">fichas (IN)</p>
                </div>
                <div>
                  <p className="text-2xl font-black">{premiosPeloRelogio ?? "-"}</p>
                  <p className="text-[11px] text-gray-300">prêmios (OUT)</p>
                </div>
                <div>
                  <p className="text-2xl font-black">{saiuPelaContagem ?? "-"}</p>
                  <p className="text-[11px] text-gray-300">saíram (contagem)</p>
                </div>
              </div>
              {relogioNaoBate && (
                <p className="mt-2 rounded-lg bg-amber-400/20 p-2 text-xs text-amber-200">
                  ⚠️ O relógio diz {premiosPeloRelogio} prêmio(s), mas pela contagem saíram {saiuPelaContagem}. Confira a quantidade na máquina.
                </p>
              )}
            </div>
          )}
          <button type="button" onClick={() => concluirPasso("F")} disabled={!feito.F} className="btn-primary w-full disabled:opacity-40">Próximo</button>
        </Passo>

        <Passo icone="🧸" titulo="Abastecimento" feito={feito.A} aberto={aberto === "A"} aoAbrir={() => setAberto(aberto === "A" ? "" : "A")}>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <CampoNumero
                rotulo="Quantidade"
                valor={form.abastecidas}
                aoMudar={mudar("abastecidas")}
                dica={
                  <>
                    {capacidadePadrao > 0 && <span className="block">Padrão: {capacidadePadrao}</span>}
                    {sugestaoAbastecer !== null ? (
                      <button
                        type="button"
                        onClick={() => mudar("abastecidas")(String(sugestaoAbastecer))}
                        className="block font-bold text-blue-600"
                      >
                        Sugestão: {sugestaoAbastecer}
                        {produtoEscolhido && sugestaoAbastecer === produtoEscolhido.quantidade && sugestaoAbastecer > 0 && (
                          <span className="font-normal text-gray-500"> (tudo que tem na loja)</span>
                        )}
                      </button>
                    ) : (
                      <span className="block">0 se não abasteceu</span>
                    )}
                  </>
                }
              />
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
          {produtoEscolhido && produtoEscolhido.quantidade === 0 && (
            <p className="text-xs text-amber-700">A loja está sem estoque deste produto: só dá para lançar 0, ou escolha outro.</p>
          )}
          {(contexto.estoque || []).length === 0 && <p className="text-xs text-amber-700">A loja está sem estoque de produtos.</p>}
          {form.totalPre !== "" && (
            <p className="rounded-lg bg-emerald-50 p-2 text-center text-sm text-emerald-800">
              A máquina vai ficar com <b>{Math.max(0, (totalPreNumero ?? 0) + abastecidas - (inteiro(form.retirada) ?? 0))}</b> pelúcias
              {capacidadePadrao ? ` de ${capacidadePadrao}` : ""}.
            </p>
          )}
          <button type="button" onClick={() => concluirPasso("A")} disabled={!feito.A} className="btn-primary w-full disabled:opacity-40">Próximo</button>
        </Passo>

        <Passo
          icone="🧽"
          titulo="Limpeza do vidro"
          simples
          feito={feito.Lv}
          aoMarcar={mudar("limpezaVidro")}
        />

        <Passo
          icone="🧹"
          titulo="Limpeza do piso"
          simples
          feito={feito.Lp}
          aoMarcar={mudar("limpezaPiso")}
        />

        <Passo icone="🔐" titulo="Conferência final" feito={feito.C} aberto={aberto === "C"} aoAbrir={() => setAberto(aberto === "C" ? "" : "C")}>
          <Marcar rotulo="🚪 Portas" marcado={form.portas} aoMudar={mudar("portas")} />
          <Marcar rotulo="🔒 Cadeados" marcado={form.cadeados} aoMudar={mudar("cadeados")} />
          <Marcar rotulo="🔑 Chaves" marcado={form.chaves} aoMudar={mudar("chaves")} />
        </Passo>

        <Passo
          icone="🪙"
          titulo={
            <>
              Recolhimento de fichas{" "}
              <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 align-middle text-[11px] font-bold text-gray-500">opcional</span>
            </>
          }
          feito={form.recolheuFichas}
          aberto={aberto === "Rf"}
          aoAbrir={() => setAberto(aberto === "Rf" ? "" : "Rf")}
        >
          <CampoNumero
            rotulo="Fichas entre a movimentação anterior e a atual"
            valor={form.fichas !== "" ? form.fichas : fichasPeloRelogio ?? ""}
            aoMudar={(valor) => setForm((f) => ({ ...f, fichas: valor, fichasEditadas: true }))}
            dica={fichasPeloRelogio !== null ? `Pelo contador IN: ${fichasPeloRelogio}` : "Sem leitura anterior do IN: informe as fichas"}
          />
          {fichasPendentes > 0 && (
            <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
              ⚠️ Ficaram <b>{fichasPendentes}</b> fichas sem recolher em {contexto.fichasPendentes.movimentacoes} movimentação(ões) anterior(es).
            </p>
          )}
          <div className="rounded-xl bg-gray-900 p-3 text-center text-white">
            <p className="text-3xl font-black">{fichasNaMaquina}</p>
            <p className="text-xs text-gray-300">fichas na máquina agora</p>
          </div>
          <Marcar rotulo={`🪙 Recolhi as fichas (${fichasNaMaquina})`} marcado={form.recolheuFichas} aoMudar={mudar("recolheuFichas")} />
          {!form.recolheuFichas && (
            <p className="text-xs text-gray-500">Se não recolher, as fichas ficam somando para a próxima movimentação.</p>
          )}
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
  ) : (
    <div className="flex justify-center py-8">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern pb-24">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <PontoRapido />

        <h1 className="mb-1 text-3xl font-black text-gray-900">Movimentação</h1>
        <p className="mb-5 text-sm text-gray-500">Olá, {usuario?.nome?.split(" ")[0]}! Escolha a loja e a máquina e siga os passos.</p>

        {sucesso && (
          <div className="mb-4 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
            <div className="flex items-center justify-between">
              <span>{sucesso}</span>
              <button type="button" onClick={() => { setSucesso(""); setMensagemWhatsapp(""); }}>✕</button>
            </div>
            {mensagemWhatsapp && (
              <button
                type="button"
                onClick={() => abrirWhatsapp(mensagemWhatsapp)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-500 py-3 text-base font-black text-white shadow hover:bg-green-600"
              >
                📲 Enviar no WhatsApp
              </button>
            )}
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
            <div className="space-y-2">
              {loja.maquinas.map((m) => {
                const escolhida = maquinaId === m.id;
                return (
                  <div
                    key={m.id}
                    id={`maquina-${m.id}`}
                    className={`scroll-mt-20 rounded-2xl border-2 transition ${
                      escolhida
                        ? "border-orange-500 bg-orange-50/40"
                        : m.feitaHoje
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-gray-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => escolherMaquina(escolhida ? "" : m.id)}
                      className="flex w-full items-center gap-3 p-3 text-left"
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg ${
                          m.feitaHoje ? "bg-emerald-500 text-white" : "bg-gray-100"
                        }`}
                      >
                        {m.feitaHoje ? "✓" : "🎰"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-black text-gray-900">{m.codigo}</span>
                        <span className="block truncate text-xs text-gray-500">
                          {m.tipo || m.nome || "Máquina"}
                          {m.feitaHoje && " · feita hoje"}
                        </span>
                      </span>
                      <span className="text-gray-400">{escolhida ? "▲" : "▼"}</span>
                    </button>
                    {escolhida && <div className="border-t border-orange-200 p-3">{formularioDaMaquina}</div>}
                  </div>
                );
              })}
            </div>
            {loja.maquinas.length === 0 && <p className="text-sm text-gray-500">Essa loja não tem máquinas.</p>}
          </div>
        )}

        <MinhasMetas className="mt-8" />
      </main>
    </div>
  );
}

export default NovaMovimentacao;
