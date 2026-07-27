import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";

const toNumber = (value) => Number(value || 0);

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const getApiErrorMessage = (err, fallback) => {
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (typeof data?.message === "string" && data.message.trim())
    return data.message;
  if (typeof data?.error === "string" && data.error.trim()) return data.error;
  return fallback;
};

const normalizeIdentifier = (value) =>
  normalizeText(value).replace(/\s+/g, " ");

// Converte o shape da API para o shape usado pelo frontend
const normalizarPendente = (lista) => ({
  id: lista.id,
  criadoEm: lista.criadoEm,
  lojas: (lista.lojas || []).map((l) => ({
    lojaId: l.lojaId,
    lojaNome: l.lojaNome,
    produtos: (l.produtos || []).map((p) => ({
      key: p.produtoKey,
      produtoId: p.produtoId ?? null,
      produtoNome: p.produtoNome,
      produtoEmoji: p.produtoEmoji || "📦",
      produtoCodigo: p.produtoCodigo || "",
      quantidade: p.quantidade,
    })),
  })),
});

const getProductKey = (produto, fallback = "") => {
  const codigoKey = normalizeIdentifier(produto?.codigo);
  if (codigoKey) return codigoKey;
  const nomeKey = normalizeIdentifier(produto?.nome);
  if (nomeKey) return nomeKey;
  const id = produto?.id ?? produto?.produtoId ?? produto?.idProduto;
  if (id !== undefined && id !== null && String(id).trim()) return `id-${id}`;
  return `fallback-${fallback}`;
};

// Tenta associar um produto do estoque a uma entrada no mapa de déficit (por código ou nome)
const takeCapacityForProduct = (capacidadePorProduto, produto, fallback) => {
  const primaryKey = getProductKey(produto, fallback);
  const primaryValue = capacidadePorProduto.get(primaryKey);
  if (primaryValue) {
    capacidadePorProduto.delete(primaryKey);
    return toNumber(primaryValue.faltaCapacidade);
  }
  const codigo = normalizeIdentifier(produto?.codigo);
  const nome = normalizeIdentifier(produto?.nome);
  for (const [key, value] of capacidadePorProduto.entries()) {
    const nomeMap = normalizeIdentifier(value?.produto?.nome);
    const codigoMap = normalizeIdentifier(value?.produto?.codigo);
    const codigoMatch =
      !!codigo && (codigo === codigoMap || codigo === nomeMap);
    const nomeMatch = !!nome && (nome === nomeMap || nome === codigoMap);
    if (codigoMatch || nomeMatch) {
      capacidadePorProduto.delete(key);
      return toNumber(value?.faltaCapacidade);
    }
  }
  return 0;
};

export function ProdutosAComprar() {
  const { usuario } = useAuth();
  const [lojas, setLojas] = useState([]);
  const [lojasSelecionadas, setLojasSelecionadas] = useState(new Set());
  const [estoquePorLoja, setEstoquePorLoja] = useState(new Map());
  const [carregandoLoja, setCarregandoLoja] = useState(new Set());
  // Map<lojaId, Map<productKey, {produto, faltaCapacidade}>>
  const [deficitPorLoja, setDeficitPorLoja] = useState(new Map());
  const [quantidadesLevar, setQuantidadesLevar] = useState({});
  const [produtos, setProdutos] = useState([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [erro, setErro] = useState("");
  const [pendentes, setPendentes] = useState([]);
  const [carregandoPendentes, setCarregandoPendentes] = useState(true);
  const [confirmandoPendente, setConfirmandoPendente] = useState(null);
  const [erroConfirmar, setErroConfirmar] = useState("");

  // ── cálculo de produtos por loja ─────────────────────────────────────────
  const listaPorLoja = useMemo(() => {
    return Array.from(lojasSelecionadas)
      .map((lojaId) => {
        const loja = lojas.find((l) => String(l.id) === String(lojaId));
        if (!loja) return null;
        const estoque = estoquePorLoja.get(String(lojaId)) || [];
        // Cópia rasa para que takeCapacityForProduct possa deletar chaves sem mutar o estado
        const capacidadePorProduto = new Map(
          deficitPorLoja.get(String(lojaId)) || new Map(),
        );
        const produtosMap = new Map();

        estoque.forEach((item, index) => {
          const produto = item?.produto || {};
          const key = getProductKey(produto, `estoque-${index}`);
          const quantidadeAtual = Math.max(0, toNumber(item?.quantidade));
          const estoqueMinimo = Math.max(0, toNumber(item?.estoqueMinimo));
          const faltaMinimo = Math.max(0, estoqueMinimo - quantidadeAtual);
          const faltaCapacidade = takeCapacityForProduct(
            capacidadePorProduto,
            produto,
            `estoque-${index}`,
          );
          const quantidadeComprar = faltaMinimo + faltaCapacidade;
          const levarKey = `${lojaId}:${key}`;
          const quantidadeLevar = Math.max(
            0,
            toNumber(quantidadesLevar[levarKey] ?? quantidadeComprar),
          );
          produtosMap.set(key, {
            key,
            produto,
            quantidadeAtual,
            estoqueMinimo,
            faltaMinimo,
            faltaCapacidade,
            quantidadeComprar,
            quantidadeLevar,
          });
        });

        // Produtos com déficit de capacidade mas não listados no estoque mínimo
        capacidadePorProduto.forEach((value, key) => {
          const quantidadeComprar = Math.max(
            0,
            toNumber(value?.faltaCapacidade),
          );
          produtosMap.set(key, {
            key,
            produto: value?.produto || {
              nome: "Produto sem nome",
              emoji: "📦",
            },
            quantidadeAtual: 0,
            estoqueMinimo: 0,
            faltaMinimo: 0,
            faltaCapacidade: quantidadeComprar,
            quantidadeComprar,
            quantidadeLevar: Math.max(
              0,
              toNumber(
                quantidadesLevar[`${lojaId}:${key}`] ?? quantidadeComprar,
              ),
            ),
          });
        });

        const ps = Array.from(produtosMap.values())
          .filter((p) => p.quantidadeComprar > 0)
          .sort((a, b) => b.quantidadeComprar - a.quantidadeComprar);
        return { loja, produtos: ps };
      })
      .filter(Boolean);
  }, [
    lojasSelecionadas,
    estoquePorLoja,
    deficitPorLoja,
    lojas,
    quantidadesLevar,
  ]);

  const totalGeral = useMemo(
    () =>
      listaPorLoja.reduce(
        (acc, { produtos: ps }) =>
          acc + ps.reduce((s, p) => s + p.quantidadeLevar, 0),
        0,
      ),
    [listaPorLoja],
  );

  const handleQuantidadeLevarChange = useCallback((lojaId, itemKey, value) => {
    const parsedValue = value === "" ? "" : Math.max(0, toNumber(value));
    setQuantidadesLevar((prev) => ({
      ...prev,
      [`${lojaId}:${itemKey}`]: parsedValue,
    }));
  }, []);

  // ── buscar estoque + déficit de capacidade de uma loja ───────────────────
  const fetchEstoqueLoja = useCallback(
    async (lojaId) => {
      const key = String(lojaId);
      if (estoquePorLoja.has(key) || carregandoLoja.has(key)) return;
      setCarregandoLoja((prev) => new Set(prev).add(key));
      try {
        const [estoqueRes, maquinasRes] = await Promise.all([
          api.get(`/estoque-lojas/${lojaId}`),
          api.get(`/maquinas`),
        ]);

        setEstoquePorLoja((prev) => {
          const next = new Map(prev);
          next.set(key, Array.isArray(estoqueRes.data) ? estoqueRes.data : []);
          return next;
        });

        const maquinasDaLoja = (maquinasRes.data || []).filter(
          (m) => String(m.lojaId) === key,
        );

        const deficitMap = new Map();
        await Promise.all(
          maquinasDaLoja.map(async (maquina) => {
            try {
              const [estoqRes, movRes] = await Promise.all([
                api.get(`/maquinas/${maquina.id}/estoque`),
                api.get(`/movimentacoes?maquinaId=${maquina.id}`),
              ]);
              const estoqueAtual = estoqRes.data.estoqueAtual ?? 0;
              const capacidade = maquina.capacidadePadrao || 0;
              const deficit = Math.max(0, capacidade - estoqueAtual);
              if (deficit <= 0) return;

              // Produto da última movimentação
              const movs = (movRes.data || []).sort(
                (a, b) =>
                  new Date(b.dataColeta || b.createdAt) -
                  new Date(a.dataColeta || a.createdAt),
              );
              let produto = null;
              if (movs.length > 0) {
                const produtoId = movs[0].detalhesProdutos?.[0]?.produtoId;
                if (produtoId) {
                  const found = produtos.find((p) => p.id === produtoId);
                  if (found) {
                    produto = {
                      id: found.id,
                      codigo: found.codigo || "",
                      nome: found.nome || "Produto sem nome",
                      emoji: found.emoji || "📦",
                    };
                  }
                }
              }
              // Fallback: tipo da máquina
              if (!produto) {
                produto = {
                  nome: maquina.tipo || `Máquina ${maquina.codigo}`,
                  codigo: maquina.codigo || "",
                  emoji: "📦",
                };
              }

              const pKey = getProductKey(produto, `maq-${maquina.id}`);
              const existing = deficitMap.get(pKey) || {
                produto,
                faltaCapacidade: 0,
              };
              existing.faltaCapacidade += deficit;
              deficitMap.set(pKey, existing);
            } catch {
              // ignora falha individual de máquina
            }
          }),
        );

        setDeficitPorLoja((prev) => {
          const next = new Map(prev);
          next.set(key, deficitMap);
          return next;
        });
      } catch (err) {
        console.error("Erro ao carregar estoque da loja:", err);
        setEstoquePorLoja((prev) => {
          const next = new Map(prev);
          next.set(key, []);
          return next;
        });
        setDeficitPorLoja((prev) => {
          const next = new Map(prev);
          next.set(key, new Map());
          return next;
        });
      } finally {
        setCarregandoLoja((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [estoquePorLoja, carregandoLoja, produtos],
  );

  const toggleLoja = useCallback(
    (lojaId) => {
      const key = String(lojaId);
      setLojasSelecionadas((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
          fetchEstoqueLoja(key);
        }
        return next;
      });
    },
    [fetchEstoqueLoja],
  );

  // ── sync pendentes to localStorage ──────────────────────────────────────
  useEffect(() => {
    const fetchPendentes = async () => {
      try {
        setCarregandoPendentes(true);
        const res = await api.get("/lista-compras-pendentes");
        // Normaliza para o mesmo formato que o frontend usa
        const normalizado = (res.data || []).map(normalizarPendente);
        setPendentes(normalizado);
      } catch (err) {
        console.error("Erro ao carregar pendentes:", err);
      } finally {
        setCarregandoPendentes(false);
      }
    };
    fetchPendentes();
  }, []);

  // ── pendentes helpers ────────────────────────────────────────────────────
  const removerProdutoPendente = useCallback(
    async (pendingId, lojaId, produtoKey) => {
      try {
        const res = await api.delete(
          `/lista-compras-pendentes/${pendingId}/produto/${encodeURIComponent(produtoKey)}`,
          { params: { lojaId } },
        );
        if (res.status === 204) {
          // Lista inteiramente removida
          setPendentes((prev) => prev.filter((p) => p.id !== pendingId));
        } else {
          setPendentes((prev) =>
            prev.map((p) =>
              p.id === pendingId ? normalizarPendente(res.data) : p,
            ),
          );
        }
      } catch (err) {
        console.error("Erro ao remover produto do pendente:", err);
      }
    },
    [],
  );

  const excluirPendente = useCallback(async (pendingId) => {
    try {
      await api.delete(`/lista-compras-pendentes/${pendingId}`);
      setPendentes((prev) => prev.filter((p) => p.id !== pendingId));
    } catch (err) {
      console.error("Erro ao excluir pendente:", err);
    }
  }, []);

  const confirmarPendente = useCallback(
    async (pendingId) => {
      const pendente = pendentes.find((p) => p.id === pendingId);
      if (!pendente) return;
      setConfirmandoPendente(pendingId);
      setErroConfirmar("");
      try {
        await Promise.all(
          pendente.lojas.map((loja) =>
            api.post("/movimentacao-estoque-loja", {
              lojaId: loja.lojaId,
              produtos: loja.produtos
                .filter((p) => p.produtoId !== null)
                .map((p) => ({
                  produtoId: p.produtoId,
                  quantidade: p.quantidade,
                  tipoMovimentacao: "entrada",
                })),
              usuarioId: usuario?.id,
              observacao: "Abastecimento via lista de compras",
            }),
          ),
        );
        await api.delete(`/lista-compras-pendentes/${pendingId}`);
        setPendentes((prev) => prev.filter((p) => p.id !== pendingId));
      } catch (err) {
        setErroConfirmar(
          getApiErrorMessage(err, "Erro ao confirmar movimentação."),
        );
      } finally {
        setConfirmandoPendente(null);
      }
    },
    [pendentes, usuario],
  );

  // ── carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    const carregar = async () => {
      try {
        setLoadingInicial(true);
        setErro("");
        const [lojasRes, produtosRes] = await Promise.all([
          api.get("/lojas"),
          api.get("/produtos"),
        ]);
        setLojas(Array.isArray(lojasRes.data) ? lojasRes.data : []);
        setProdutos(Array.isArray(produtosRes.data) ? produtosRes.data : []);
      } catch (err) {
        setErro(getApiErrorMessage(err, "Erro ao carregar lojas."));
      } finally {
        setLoadingInicial(false);
      }
    };
    carregar();
  }, []);

  const handlePrint = async () => {
    if (listaPorLoja.length === 0) return;

    // Cria pré-movimentação pendente
    const lojasComProdutos = listaPorLoja
      .filter(({ produtos: ps }) => ps.some((p) => p.quantidadeLevar > 0))
      .map(({ loja, produtos: ps }) => ({
        lojaId: loja.id,
        lojaNome: loja.nome,
        produtos: ps
          .filter((p) => p.quantidadeLevar > 0)
          .map((p) => ({
            key: p.key,
            produtoId: p.produto.id ?? null,
            produtoNome: p.produto.nome,
            produtoEmoji: p.produto.emoji || "📦",
            produtoCodigo: p.produto.codigo || "",
            quantidade: p.quantidadeLevar,
          })),
      }))
      .filter((l) => l.produtos.length > 0);

    if (lojasComProdutos.length > 0) {
      try {
        const res = await api.post("/lista-compras-pendentes", {
          lojas: lojasComProdutos,
          usuarioId: usuario?.id ?? null,
        });
        setPendentes((prev) => [normalizarPendente(res.data), ...prev]);
      } catch (err) {
        console.error("Erro ao salvar pendente:", err);
      }
    }

    const hoje = new Date().toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const lojasSectionsHtml = listaPorLoja
      .map(({ loja, produtos: ps }) => {
        const rowsHtml = ps
          .map(
            (item, idx) => `
          <tr style="border-bottom:1px solid #ddd;background:${idx % 2 === 0 ? "#fff" : "#f9f9f9"}">
            <td style="padding:7px 8px">
              ${item.produto.emoji ? `<span style="margin-right:5px">${item.produto.emoji}</span>` : ""}
              <strong>${item.produto.nome}</strong>
              ${item.produto.codigo ? `<span style="font-size:11px;color:#888;margin-left:6px">(${item.produto.codigo})</span>` : ""}
            </td>
            <td style="text-align:center;padding:7px 8px;font-weight:bold;font-size:15px">${item.quantidadeLevar}</td>
            <td style="text-align:center;padding:7px 8px">
              <span style="display:inline-block;width:18px;height:18px;border:2px solid #333;border-radius:3px;vertical-align:middle"></span>
            </td>
          </tr>`,
          )
          .join("");

        const total = ps.reduce((s, p) => s + p.quantidadeLevar, 0);

        const tableHtml =
          ps.length === 0
            ? `<p style="font-style:italic;color:#666">Nenhuma compra necessária.</p>`
            : `
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:1px solid #333">
                <th style="text-align:left;padding:6px 8px;font-weight:bold">Produto</th>
                <th style="text-align:center;padding:6px 8px;font-weight:bold;width:80px">Levar</th>
                <th style="text-align:center;padding:6px 8px;font-weight:bold;width:90px">Levou ✓</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
            <tfoot>
              <tr style="border-top:2px solid #333">
                <td style="padding:6px 8px;font-weight:bold">Total</td>
                <td style="text-align:center;padding:6px 8px;font-weight:bold;font-size:15px">${total}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>`;

        return `
        <div class="store-section">
          <div style="border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px">
            <h1 style="font-size:20px;font-weight:bold;margin:0">Lista de Compra — ${loja.nome}</h1>
            <p style="font-size:12px;color:#555;margin:2px 0 0">${hoje}</p>
          </div>
          ${tableHtml}
          <div style="margin-top:32px;display:flex;gap:40px">
            <div style="flex:1"><div style="border-top:1px solid #333;padding-top:4px"><span style="font-size:11px;color:#555">Responsável</span></div></div>
            <div style="flex:1"><div style="border-top:1px solid #333;padding-top:4px"><span style="font-size:11px;color:#555">Data de entrega</span></div></div>
          </div>
        </div>`;
      })
      .join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>Lista de Compra</title>
          <style>
            body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #111827; background: #fff; }
            .store-section { page-break-after: always; }
            .store-section:last-child { page-break-after: avoid; }
          </style>
        </head>
        <body>
          ${lojasSectionsHtml}
          <script>window.onload = function() { window.print(); };<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  };

  if (loadingInicial || carregandoPendentes) return <PageLoader />;

  const algumCarregando = carregandoLoja.size > 0;

  return (
    <>
      <style>{`
				@media print {
					.no-print { display: none !important; }
					.print-only { display: block !important; }
					body { background: white !important; }
					.print-area { padding: 0 !important; margin: 0 !important; }
					.print-store-section { page-break-after: always; }
					.print-store-section:last-child { page-break-after: avoid; }
				}
				@media screen { .print-only { display: none !important; } }
			`}</style>

      <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
        <div className="no-print">
          <Navbar />
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print-area">
          <div className="no-print">
            <PageHeader
              title="Produtos a Comprar"
              subtitle="Selecione as lojas e imprima a lista de reposição"
              icon="🛒"
            />

            {erro && (
              <div className="mb-6 p-4 rounded-xl border border-red-300 bg-red-50 text-red-800 font-medium">
                {erro}
              </div>
            )}

            {/* ── Pendentes ── */}
            {pendentes.length > 0 && (
              <section className="mb-6">
                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  ⏳ Pendentes
                  <span className="bg-orange-100 text-orange-700 border border-orange-300 rounded-full px-2 py-0.5 text-sm font-semibold">
                    {pendentes.length}
                  </span>
                </h2>

                {erroConfirmar && (
                  <div className="mb-3 p-3 rounded-xl border border-red-300 bg-red-50 text-red-800 text-sm font-medium">
                    {erroConfirmar}
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  {pendentes.map((pendente) => {
                    const totalPendente = pendente.lojas.reduce(
                      (acc, l) =>
                        acc + l.produtos.reduce((s, p) => s + p.quantidade, 0),
                      0,
                    );
                    const isConfirmando = confirmandoPendente === pendente.id;
                    return (
                      <div
                        key={pendente.id}
                        className="card border-2 border-orange-200 bg-orange-50/30"
                      >
                        {/* Header do pendente */}
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-xs text-gray-500">
                              {new Date(pendente.criadoEm).toLocaleString(
                                "pt-BR",
                              )}
                            </p>
                            <p className="text-sm font-semibold text-gray-700">
                              {pendente.lojas.length}{" "}
                              {pendente.lojas.length === 1 ? "loja" : "lojas"} ·{" "}
                              {totalPendente} unidades
                            </p>
                          </div>
                          <button
                            onClick={() => excluirPendente(pendente.id)}
                            disabled={isConfirmando}
                            className="text-sm text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            Descartar
                          </button>
                        </div>

                        {/* Lojas e produtos */}
                        <div className="flex flex-col gap-4">
                          {pendente.lojas.map((loja) => (
                            <div key={loja.lojaId}>
                              <p className="font-semibold text-gray-800 mb-2">
                                🏪 {loja.lojaNome}
                              </p>
                              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                      <th className="text-left px-4 py-2 font-semibold text-gray-700">
                                        Produto
                                      </th>
                                      <th className="text-center px-4 py-2 font-semibold text-blue-700">
                                        Qtd
                                      </th>
                                      <th className="px-4 py-2 w-10" />
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {loja.produtos.map((prod, idx) => (
                                      <tr
                                        key={prod.key}
                                        className={
                                          idx % 2 === 0
                                            ? "bg-white"
                                            : "bg-gray-50"
                                        }
                                      >
                                        <td className="px-4 py-2">
                                          <div className="flex items-center gap-2">
                                            <span>{prod.produtoEmoji}</span>
                                            <div>
                                              <p className="font-medium text-gray-900">
                                                {prod.produtoNome}
                                              </p>
                                              {prod.produtoCodigo && (
                                                <p className="text-xs text-gray-400">
                                                  Cód: {prod.produtoCodigo}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-center font-bold text-blue-700 text-base">
                                          {prod.quantidade}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                          <button
                                            onClick={() =>
                                              removerProdutoPendente(
                                                pendente.id,
                                                loja.lojaId,
                                                prod.key,
                                              )
                                            }
                                            disabled={isConfirmando}
                                            className="text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                            title="Remover produto"
                                          >
                                            ✕
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Ações */}
                        <div className="flex justify-end mt-4">
                          <button
                            onClick={() => confirmarPendente(pendente.id)}
                            disabled={isConfirmando}
                            className="btn-primary flex items-center gap-2 disabled:opacity-60"
                          >
                            {isConfirmando ? (
                              <>
                                <span className="animate-spin">⏳</span>
                                Confirmando...
                              </>
                            ) : (
                              <>✓ Confirmar Movimentação</>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Seleção de lojas ── */}
            <section className="card mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Selecione as lojas
                </h2>
                {lojasSelecionadas.size > 0 && (
                  <button
                    onClick={() => setLojasSelecionadas(new Set())}
                    className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {lojas.map((loja) => {
                  const selecionada = lojasSelecionadas.has(String(loja.id));
                  const carregando = carregandoLoja.has(String(loja.id));
                  return (
                    <label
                      key={loja.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all select-none ${selecionada ? "bg-primary/10 border-primary shadow-sm" : "bg-white border-gray-200 hover:border-gray-300"}`}
                    >
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-primary"
                        checked={selecionada}
                        onChange={() => toggleLoja(loja.id)}
                      />
                      <span className="font-medium text-gray-900 flex-1">
                        {loja.nome}
                      </span>
                      {carregando && (
                        <span className="text-xs text-gray-400 animate-pulse">
                          Carregando...
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </section>

            {lojasSelecionadas.size === 0 && (
              <section className="card text-center py-14">
                <div className="text-5xl mb-3">🏪</div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  Escolha ao menos uma loja
                </h2>
                <p className="text-gray-600">
                  A lista de reposição será calculada automaticamente.
                </p>
              </section>
            )}

            {lojasSelecionadas.size > 0 && !algumCarregando && (
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div className="flex flex-wrap gap-3">
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-center">
                    <p className="text-xs text-red-600 font-medium">Lojas</p>
                    <p className="text-2xl font-bold text-red-700">
                      {listaPorLoja.length}
                    </p>
                  </div>
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 text-center">
                    <p className="text-xs text-orange-600 font-medium">
                      Total a levar
                    </p>
                    <p className="text-2xl font-bold text-orange-700">
                      {totalGeral}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handlePrint}
                  className="btn-primary flex items-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  Imprimir lista
                </button>
              </div>
            )}

            {algumCarregando && lojasSelecionadas.size > 0 && (
              <div className="card text-center py-10 mb-6">
                <div className="text-4xl mb-3 animate-pulse">📦</div>
                <p className="text-gray-600">Carregando estoque das lojas...</p>
              </div>
            )}
          </div>

          {/* ── Lista por loja (tela) ── */}
          {!algumCarregando &&
            listaPorLoja.map(({ loja, produtos: ps }) => (
              <section key={loja.id} className="card mb-6 no-print">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-2xl font-bold text-gray-900">
                    🏪 {loja.nome}
                  </h2>
                  <span className="badge bg-red-100 text-red-700 border-red-300">
                    {ps.reduce((s, p) => s + p.quantidadeLevar, 0)} unidades
                  </span>
                </div>

                {ps.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-4xl mb-2">✅</p>
                    <p className="text-gray-600 font-medium">
                      Nenhuma compra necessária.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-gray-700">
                            Produto
                          </th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-700">
                            Atual
                          </th>
                          <th className="text-center px-4 py-3 font-semibold text-gray-700">
                            Mín.
                          </th>
                          <th className="text-center px-4 py-3 font-semibold text-orange-600">
                            Falta cap.
                          </th>
                          <th className="text-center px-4 py-3 font-semibold text-red-700">
                            Comprar
                          </th>
                          <th className="text-center px-4 py-3 font-semibold text-blue-700">
                            Levar
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ps.map((item, idx) => (
                          <tr
                            key={item.key}
                            className={
                              idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span>{item.produto.emoji || "📦"}</span>
                                <div>
                                  <p className="font-semibold text-gray-900">
                                    {item.produto.nome}
                                  </p>
                                  {item.produto.codigo && (
                                    <p className="text-xs text-gray-400">
                                      Cód: {item.produto.codigo}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              {item.quantidadeAtual}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              {item.estoqueMinimo}
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-orange-600">
                              {item.faltaCapacidade > 0
                                ? item.faltaCapacidade
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-center font-extrabold text-red-700 text-lg">
                              {item.quantidadeComprar}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                value={item.quantidadeLevar}
                                onChange={(e) =>
                                  handleQuantidadeLevarChange(
                                    loja.id,
                                    item.key,
                                    e.target.value,
                                  )
                                }
                                className="w-24 rounded-lg border border-blue-200 px-3 py-2 text-center font-semibold text-blue-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
        </main>

        <div className="no-print">
          <Footer />
        </div>
      </div>
    </>
  );
}
