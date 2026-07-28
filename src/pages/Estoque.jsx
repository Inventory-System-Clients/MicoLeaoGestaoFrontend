import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { Navbar } from "../components/Navbar";
import { AlertBox, Badge, PageHeader } from "../components/UIComponents";
import api from "../services/api";

const ehGaragem = (loja) =>
  ["deposito principal", "depósito principal"].includes(
    String(loja?.nome || "").trim().toLowerCase(),
  );

const itemAtivo = (item) => item.ativo !== false;
const somarUnidades = (estoque = []) =>
  estoque.reduce((total, item) => total + Number(item.quantidade || 0), 0);

function ProdutoResumo({ item }) {
  const quantidade = Number(item.quantidade || 0);
  const minimo = Number(item.estoqueMinimo || item.produto?.estoqueMinimo || 0);
  const abaixoDoMinimo = minimo > 0 && quantidade < minimo;

  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${
        abaixoDoMinimo
          ? "border-red-300 bg-red-50 text-red-800"
          : "border-orange-200 bg-white text-gray-800"
      }`}
    >
      <span>{item.produto?.emoji || "📦"}</span>
      <span className="max-w-40 truncate font-medium">
        {item.produto?.nome || "Produto"}
      </span>
      <strong className={abaixoDoMinimo ? "text-red-700" : "text-primary"}>
        {quantidade}
      </strong>
    </div>
  );
}

function ProdutoDetalhe({ item }) {
  const quantidade = Number(item.quantidade || 0);
  const minimo = Number(item.estoqueMinimo || item.produto?.estoqueMinimo || 0);
  const abaixoDoMinimo = minimo > 0 && quantidade < minimo;

  return (
    <div
      className={`rounded-lg border-2 p-4 ${
        abaixoDoMinimo
          ? "border-red-300 bg-red-50"
          : "border-orange-100 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{item.produto?.emoji || "📦"}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-gray-900">
            {item.produto?.nome || "Produto"}
          </p>
          {item.produto?.codigo && (
            <p className="text-xs text-gray-500">Código: {item.produto.codigo}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-orange-100 pt-3">
        <div>
          <p className="text-xs text-gray-500">Quantidade</p>
          <p
            className={`text-3xl font-black ${
              abaixoDoMinimo ? "text-red-600" : "text-primary"
            }`}
          >
            {quantidade}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Estoque mínimo</p>
          <p className="text-lg font-bold text-gray-700">{minimo}</p>
        </div>
      </div>

      {abaixoDoMinimo && (
        <p className="mt-3 rounded-lg bg-red-100 p-2 text-xs font-bold text-red-800">
          ⚠️ Estoque abaixo do mínimo
        </p>
      )}
    </div>
  );
}

function MaquinaCard({ maquina }) {
  const estoque = Number(maquina.estoqueAtual || 0);
  const capacidade = Number(maquina.capacidadePadrao || 0);
  const percentual =
    capacidade > 0 ? Math.min(100, (estoque / capacidade) * 100) : 0;

  return (
    <Link
      to={`/maquinas/${maquina.id}`}
      className={`block rounded-lg border-2 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
        maquina.alertaEstoqueBaixo
          ? "border-red-300 bg-red-50"
          : "border-orange-100 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-gray-900">
            {maquina.nome || maquina.codigo}
          </p>
          <p className="text-xs text-gray-500">{maquina.codigo}</p>
        </div>
        <span className="text-2xl">🎰</span>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-xs text-gray-500">Na máquina</p>
          <p className="text-2xl font-black text-primary">{estoque}</p>
        </div>
        <p className="text-sm font-semibold text-gray-600">
          de {capacidade || "-"}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percentual}%`,
            minWidth: percentual > 0 ? "6px" : 0,
            backgroundColor: maquina.alertaEstoqueBaixo ? "#EF4444" : "#F97316",
          }}
        />
      </div>
    </Link>
  );
}

function DepositoCard({ loja, destaque, expandido, onToggle, onEdit }) {
  const estoqueVisivel = (loja.estoque || []).filter(itemAtivo);

  return (
    <section
      className={`overflow-hidden rounded-lg border-2 shadow-sm ${
        destaque ? "border-primary text-white" : "border-orange-100 bg-white"
      }`}
      style={
        destaque
          ? {
              background:
                "linear-gradient(135deg, #111827 0%, #991B1B 55%, #F97316 100%)",
            }
          : undefined
      }
    >
      <div className="p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onToggle}
            className="flex flex-1 items-center gap-4 text-left"
            aria-expanded={expandido}
          >
            <span className="text-4xl">{destaque ? "🏭" : "🏪"}</span>
            <div>
              <h2 className="text-xl font-black">
                {destaque ? "Depósito Principal" : loja.nome}
              </h2>
              <p
                className={`text-sm ${
                  destaque ? "text-orange-50" : "text-gray-500"
                }`}
              >
                {estoqueVisivel.length} produtos · {loja.totalUnidades} unidades
              </p>
            </div>
          </button>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={onEdit}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                destaque
                  ? "bg-white text-red-700 hover:bg-orange-50"
                  : "bg-primary text-white hover:bg-primary/90"
              }`}
            >
              ✏️ Editar
            </button>
            <button
              type="button"
              onClick={onToggle}
              className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-bold transition ${
                destaque
                  ? "text-white hover:bg-white/10"
                  : "text-primary hover:bg-orange-50"
              }`}
            >
              {expandido ? "Fechar detalhes ▲" : "Ver todo o estoque ▼"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {estoqueVisivel.length > 0 ? (
            estoqueVisivel.map((item) => (
              <ProdutoResumo key={item.id || item.produtoId} item={item} />
            ))
          ) : (
            <p className={`text-sm ${destaque ? "text-orange-50" : "text-gray-500"}`}>
              Nenhum produto registrado neste estoque.
            </p>
          )}
        </div>
      </div>

      {expandido && (
        <div
          className={`border-t p-5 ${
            destaque
              ? "border-white/20 bg-white text-gray-900"
              : "border-orange-100 bg-orange-50/30"
          }`}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {estoqueVisivel.map((item) => (
              <ProdutoDetalhe key={item.id || item.produtoId} item={item} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function Estoque() {
  const [lojas, setLojas] = useState([]);
  const [maquinas, setMaquinas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [expandidos, setExpandidos] = useState({});
  const [estoqueEditando, setEstoqueEditando] = useState(null);
  const [salvandoEstoque, setSalvandoEstoque] = useState(false);
  const [modalCompra, setModalCompra] = useState(false);
  const [salvandoCompra, setSalvandoCompra] = useState(false);
  const [modalMovimentacao, setModalMovimentacao] = useState(false);
  const [salvandoMovimentacao, setSalvandoMovimentacao] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [compra, setCompra] = useState({
    fornecedorId: "",
    destinoLojaId: "",
    observacao: "",
    produtos: [{ produtoId: "", quantidade: "" }],
  });
  const [movimentacaoLojaId, setMovimentacaoLojaId] = useState("");
  const [produtosMovimentacao, setProdutosMovimentacao] = useState([
    { produtoId: "", quantidade: "" },
  ]);

  const carregarDados = useCallback(async ({ exibirLoading = true } = {}) => {
    try {
      if (exibirLoading) setLoading(true);
      setError("");

      const [lojasRes, maquinasRes, produtosRes, fornecedoresRes] =
        await Promise.all([
          api.get("/lojas"),
          api.get("/maquinas"),
          api.get("/produtos"),
          api.get("/fornecedores").catch(() => ({ data: [] })),
        ]);

      const lojasData = lojasRes.data || [];
      const maquinasData = maquinasRes.data || [];

      const [estoques, estoquesMaquinas] = await Promise.all([
        Promise.all(
          lojasData.map(async (loja) => {
            try {
              const response = await api.get(`/estoque-lojas/${loja.id}`);
              return [loja.id, response.data || []];
            } catch {
              return [loja.id, []];
            }
          }),
        ),
        Promise.all(
          maquinasData.map(async (maquina) => {
            try {
              const response = await api.get(`/maquinas/${maquina.id}/estoque`);
              return [maquina.id, response.data || {}];
            } catch {
              return [maquina.id, {}];
            }
          }),
        ),
      ]);

      const estoquePorLoja = Object.fromEntries(estoques);
      const estoquePorMaquina = Object.fromEntries(estoquesMaquinas);

      setLojas(
        lojasData.map((loja) => {
          const estoque = estoquePorLoja[loja.id] || [];
          return {
            ...loja,
            estoque,
            totalUnidades: somarUnidades(estoque.filter(itemAtivo)),
          };
        }),
      );
      setMaquinas(
        maquinasData.map((maquina) => ({
          ...maquina,
          ...(estoquePorMaquina[maquina.id] || {}),
        })),
      );
      setProdutos(produtosRes.data || []);
      setFornecedores(fornecedoresRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar estoque:", err);
      setError(err.response?.data?.error || "Não foi possível carregar o estoque.");
    } finally {
      if (exibirLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const garagem = useMemo(() => lojas.find(ehGaragem), [lojas]);
  const lojasOperacionais = useMemo(
    () => lojas.filter((loja) => !ehGaragem(loja)),
    [lojas],
  );

  const totalDepositos = lojas.reduce(
    (total, loja) => total + loja.totalUnidades,
    0,
  );
  const totalMaquinas = maquinas.reduce(
    (total, maquina) => total + Number(maquina.estoqueAtual || 0),
    0,
  );
  const alertasDepositos = useMemo(
    () =>
      lojas.flatMap((loja) =>
        (loja.estoque || [])
          .filter((item) => {
            const minimo = Number(item.estoqueMinimo || item.produto?.estoqueMinimo || 0);
            return itemAtivo(item) && minimo > 0 && Number(item.quantidade || 0) < minimo;
          })
          .map((item) => ({
            id: `${loja.id}-${item.produtoId}`,
            lojaNome: ehGaragem(loja) ? "Depósito Principal" : loja.nome,
            produtoNome: item.produto?.nome || "Produto",
            quantidade: Number(item.quantidade || 0),
            minimo: Number(item.estoqueMinimo || item.produto?.estoqueMinimo || 0),
          })),
      ),
    [lojas],
  );
  const alertasMaquinas = useMemo(
    () =>
      maquinas
        .filter(
          (maquina) =>
            Number(maquina.capacidadePadrao || 0) > 0 &&
            Number(maquina.estoqueAtual || 0) < Number(maquina.capacidadePadrao || 0),
        )
        .map((maquina) => ({
          ...maquina,
          lojaNome:
            lojas.find((loja) => String(loja.id) === String(maquina.lojaId))
              ?.nome || "Loja não informada",
        })),
    [lojas, maquinas],
  );
  const possuiAlertas = alertasDepositos.length > 0 || alertasMaquinas.length > 0;

  const alternarExpandido = (lojaId) => {
    setExpandidos((atual) => ({ ...atual, [lojaId]: !atual[lojaId] }));
  };

  const abrirEdicaoEstoque = (loja) => {
    const estoquePorProduto = new Map(
      (loja.estoque || []).map((item) => [String(item.produtoId), item]),
    );

    setEstoqueEditando({
      lojaId: loja.id,
      lojaNome: loja.nome,
      itens: produtos.map((produto) => {
        const existente = estoquePorProduto.get(String(produto.id));
        return {
          produtoId: produto.id,
          nome: produto.nome,
          codigo: produto.codigo,
          emoji: produto.emoji,
          quantidade: Number(existente?.quantidade || 0),
          estoqueMinimo: Number(existente?.estoqueMinimo || produto.estoqueMinimo || 0),
          ativo: existente?.ativo ?? Boolean(existente),
        };
      }),
    });
    setError("");
    setSuccess("");
  };

  const alterarItemEstoque = (produtoId, campo, valor) => {
    const numero = Math.max(0, Number.parseInt(valor || "0", 10) || 0);
    setEstoqueEditando((atual) => ({
      ...atual,
      itens: atual.itens.map((item) =>
        item.produtoId === produtoId ? { ...item, [campo]: numero } : item,
      ),
    }));
  };

  const alternarAtivoItem = (produtoId) => {
    setEstoqueEditando((atual) => ({
      ...atual,
      itens: atual.itens.map((item) =>
        item.produtoId === produtoId ? { ...item, ativo: !item.ativo } : item,
      ),
    }));
  };

  const salvarEdicaoEstoque = async () => {
    try {
      setSalvandoEstoque(true);
      setError("");
      await api.put(`/estoque-lojas/${estoqueEditando.lojaId}/varios`, {
        estoques: estoqueEditando.itens
          .map((item) => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            estoqueMinimo: item.estoqueMinimo,
            ativo: item.ativo,
          })),
      });
      setEstoqueEditando(null);
      setSuccess("Estoque atualizado com sucesso.");
      await carregarDados({ exibirLoading: false });
    } catch (err) {
      console.error("Erro ao editar estoque:", err);
      setError(err.response?.data?.error || "Não foi possível salvar o estoque.");
    } finally {
      setSalvandoEstoque(false);
    }
  };

  const abrirCompra = () => {
    setCompra({
      fornecedorId: "",
      destinoLojaId: garagem?.id || lojas[0]?.id || "",
      observacao: "",
      produtos: [{ produtoId: "", quantidade: "" }],
    });
    setModalCompra(true);
    setError("");
    setSuccess("");
  };

  const alterarProdutoCompra = (index, campo, valor) => {
    setCompra((atual) => ({
      ...atual,
      produtos: atual.produtos.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [campo]: valor } : item,
      ),
    }));
  };

  const adicionarProdutoCompra = () => {
    setCompra((atual) => ({
      ...atual,
      produtos: [...atual.produtos, { produtoId: "", quantidade: "" }],
    }));
  };

  const removerProdutoCompra = (index) => {
    setCompra((atual) => ({
      ...atual,
      produtos:
        atual.produtos.length === 1
          ? atual.produtos
          : atual.produtos.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const salvarCompra = async (event) => {
    event.preventDefault();
    const itensValidos = compra.produtos.filter(
      (item) => item.produtoId && Number(item.quantidade) > 0,
    );

    if (!compra.destinoLojaId || itensValidos.length === 0) {
      setError("Selecione o destino e informe pelo menos um produto.");
      return;
    }

    try {
      setSalvandoCompra(true);
      setError("");
      const fornecedor = fornecedores.find(
        (item) => String(item.id) === String(compra.fornecedorId),
      );

      await api.post("/movimentacao-estoque-loja", {
        lojaId: compra.destinoLojaId,
        observacao:
          compra.observacao ||
          `Entrada de compra${fornecedor?.nome ? ` - ${fornecedor.nome}` : ""}`,
        produtos: itensValidos.map((item) => ({
          produtoId: item.produtoId,
          quantidade: Number(item.quantidade),
          tipoMovimentacao: "entrada",
        })),
      });

      setModalCompra(false);
      setSuccess("Entrada de compra registrada com sucesso.");
      await carregarDados({ exibirLoading: false });
    } catch (err) {
      console.error("Erro ao registrar compra:", err);
      setError(err.response?.data?.error || "Não foi possível registrar a compra.");
    } finally {
      setSalvandoCompra(false);
    }
  };

  const abrirMovimentacao = () => {
    setMovimentacaoLojaId("");
    setProdutosMovimentacao([{ produtoId: "", quantidade: "" }]);
    setModalMovimentacao(true);
    setError("");
    setSuccess("");
  };

  const alterarProdutoMovimentacao = (index, campo, valor) => {
    setProdutosMovimentacao((atual) =>
      atual.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [campo]: valor } : item,
      ),
    );
  };

  const adicionarProdutoMovimentacao = () => {
    setProdutosMovimentacao((atual) => [
      ...atual,
      { produtoId: "", quantidade: "" },
    ]);
  };

  const removerProdutoMovimentacao = (index) => {
    setProdutosMovimentacao((atual) =>
      atual.length === 1
        ? atual
        : atual.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const salvarMovimentacao = async (event) => {
    event.preventDefault();
    const itensValidos = produtosMovimentacao.filter(
      (item) => item.produtoId && Number(item.quantidade) > 0,
    );

    if (!garagem?.id) {
      setError("Cadastre uma loja chamada Depósito Principal.");
      return;
    }

    if (!movimentacaoLojaId || itensValidos.length === 0) {
      setError("Selecione a loja de destino e informe pelo menos um produto.");
      return;
    }

    try {
      setSalvandoMovimentacao(true);
      setError("");

      await api.post("/movimentacao-estoque-loja/transferir-do-deposito-principal", {
        lojaDestinoId: movimentacaoLojaId,
        produtos: itensValidos.map((item) => ({
          produtoId: item.produtoId,
          quantidade: Number(item.quantidade),
        })),
      });

      setModalMovimentacao(false);
      setSuccess("Produtos transferidos com sucesso.");
      await carregarDados({ exibirLoading: false });
    } catch (err) {
      console.error("Erro ao movimentar estoque:", err);
      setError(err.response?.data?.error || "Não foi possível registrar a movimentação.");
    } finally {
      setSalvandoMovimentacao(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Estoque"
          subtitle="Depósito Principal, lojas e máquinas em um só lugar"
          icon="📦"
        />

        <div className="mb-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={abrirMovimentacao}
            className="inline-flex items-center gap-3 rounded-lg bg-green-600 px-6 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-green-700"
          >
            <span className="text-xl">🔄</span>
            Movimentação de Estoque
          </button>
          <button
            type="button"
            onClick={abrirCompra}
            className="inline-flex items-center gap-3 rounded-lg bg-primary px-6 py-3 font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-primary/90"
          >
            <span className="text-xl">🛒</span>
            Fazer compra
          </button>
        </div>

        {error && (
          <div className="mb-4">
            <AlertBox type="error" message={error} onClose={() => setError("")} />
          </div>
        )}
        {success && (
          <div className="mb-4">
            <AlertBox type="success" message={success} onClose={() => setSuccess("")} />
          </div>
        )}

        {possuiAlertas && (
          <section className="mb-8 overflow-hidden rounded-lg border-2 border-orange-300 bg-white shadow-lg">
            <div className="flex flex-col gap-3 bg-gradient-to-r from-orange-500 to-red-500 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚠️</span>
                <div>
                  <h2 className="text-lg font-black">Alertas de estoque</h2>
                  <p className="text-sm text-orange-50">
                    Existem itens que precisam de reposição.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-white/20 px-3 py-1.5">
                  📦 {alertasDepositos.length} em lojas
                </span>
                <span className="rounded-full bg-white/20 px-3 py-1.5">
                  🎰 {alertasMaquinas.length} em máquinas
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
              {alertasDepositos.length > 0 && (
                <div>
                  <h3 className="mb-3 font-black text-gray-900">
                    📦 Estoques abaixo do mínimo
                  </h3>
                  <div className="space-y-2">
                    {alertasDepositos.map((alerta) => (
                      <div
                        key={alerta.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
                      >
                        <div>
                          <p className="font-bold text-gray-900">{alerta.produtoNome}</p>
                          <p className="text-xs text-gray-600">{alerta.lojaNome}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-red-600">
                            {alerta.quantidade} unidades
                          </p>
                          <p className="text-xs text-red-700">mínimo: {alerta.minimo}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {alertasMaquinas.length > 0 && (
                <div>
                  <h3 className="mb-3 font-black text-gray-900">
                    🎰 Máquinas abaixo da capacidade
                  </h3>
                  <div className="space-y-2">
                    {alertasMaquinas.map((maquina) => (
                      <Link
                        key={maquina.id}
                        to={`/maquinas/${maquina.id}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 transition hover:border-orange-400 hover:shadow-sm"
                      >
                        <div>
                          <p className="font-bold text-gray-900">
                            {maquina.nome || maquina.codigo}
                          </p>
                          <p className="text-xs text-gray-600">
                            {maquina.lojaNome} · {maquina.codigo}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-orange-700">
                            {Number(maquina.estoqueAtual || 0)} de{" "}
                            {Number(maquina.capacidadePadrao || 0)}
                          </p>
                          <p className="text-xs text-orange-700">ver máquina</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="stat-card bg-gradient-to-br from-orange-500 to-red-600">
            <p className="text-sm opacity-90">Estoque das lojas</p>
            <p className="text-3xl font-bold">{totalDepositos}</p>
            <p className="mt-1 text-xs opacity-75">{lojas.length} estoque(s)</p>
          </div>
          <div className="stat-card bg-gradient-to-br from-blue-500 to-blue-700">
            <p className="text-sm opacity-90">Estoque nas máquinas</p>
            <p className="text-3xl font-bold">{totalMaquinas}</p>
            <p className="mt-1 text-xs opacity-75">{maquinas.length} máquina(s)</p>
          </div>
          <div className="stat-card bg-gradient-to-br from-red-500 to-red-700">
            <p className="text-sm opacity-90">Alertas</p>
            <p className="text-3xl font-bold">
              {alertasDepositos.length + alertasMaquinas.length}
            </p>
            <p className="mt-1 text-xs opacity-75">itens para acompanhar</p>
          </div>
        </section>

        <div className="space-y-5">
          {garagem && (
            <DepositoCard
              loja={garagem}
              destaque
              expandido={!!expandidos[garagem.id]}
              onToggle={() => alternarExpandido(garagem.id)}
              onEdit={() => abrirEdicaoEstoque(garagem)}
            />
          )}

          {lojasOperacionais.map((loja) => (
            <DepositoCard
              key={loja.id}
              loja={loja}
              expandido={!!expandidos[loja.id]}
              onToggle={() => alternarExpandido(loja.id)}
              onEdit={() => abrirEdicaoEstoque(loja)}
            />
          ))}
        </div>

        <section className="mt-8 rounded-lg border border-orange-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-gray-900">
                🎰 Estoque das máquinas
              </h2>
              <p className="text-sm text-gray-600">
                Acompanhe capacidade e estoque atual de cada máquina.
              </p>
            </div>
            <Badge variant="info">{maquinas.length} máquina(s)</Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {maquinas.map((maquina) => (
              <MaquinaCard key={maquina.id} maquina={maquina} />
            ))}
          </div>
        </section>
      </main>

      {estoqueEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-neutral-950 to-red-800 p-5 text-white">
              <div>
                <h2 className="text-xl font-black">✏️ Editar estoque</h2>
                <p className="text-sm text-orange-50">{estoqueEditando.lojaNome}</p>
              </div>
              <button
                type="button"
                onClick={() => setEstoqueEditando(null)}
                disabled={salvandoEstoque}
                className="rounded-lg p-2 text-2xl hover:bg-white/10"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <p className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                Marque os produtos que fazem parte deste estoque, corrija a
                quantidade e defina o estoque mínimo.
              </p>

              <div className="space-y-3">
                {estoqueEditando.itens.map((item) => (
                  <div
                    key={item.produtoId}
                    className={`rounded-lg border-2 p-4 ${
                      item.ativo
                        ? "border-gray-200"
                        : "border-gray-200 bg-gray-50 opacity-70"
                    }`}
                  >
                    <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_150px_150px]">
                      <div className="flex min-w-0 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={item.ativo}
                          onChange={() => alternarAtivoItem(item.produtoId)}
                          className="h-5 w-5 shrink-0 cursor-pointer rounded text-primary focus:ring-2 focus:ring-primary"
                          disabled={salvandoEstoque}
                        />
                        <span className="text-3xl">{item.emoji || "📦"}</span>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-gray-900">{item.nome}</p>
                          {item.codigo && (
                            <p className="text-xs text-gray-500">Código: {item.codigo}</p>
                          )}
                        </div>
                      </div>
                      <label className="text-sm font-semibold text-gray-700">
                        Quantidade
                        <input
                          type="number"
                          min="0"
                          value={item.quantidade}
                          onChange={(event) =>
                            alterarItemEstoque(item.produtoId, "quantidade", event.target.value)
                          }
                          className="input-field mt-1"
                          disabled={salvandoEstoque || !item.ativo}
                        />
                      </label>
                      <label className="text-sm font-semibold text-gray-700">
                        Estoque mínimo
                        <input
                          type="number"
                          min="0"
                          value={item.estoqueMinimo}
                          onChange={(event) =>
                            alterarItemEstoque(
                              item.produtoId,
                              "estoqueMinimo",
                              event.target.value,
                            )
                          }
                          className="input-field mt-1"
                          disabled={salvandoEstoque || !item.ativo}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t bg-gray-50 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEstoqueEditando(null)}
                className="btn-secondary"
                disabled={salvandoEstoque}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarEdicaoEstoque}
                className="btn-primary"
                disabled={salvandoEstoque}
              >
                {salvandoEstoque ? "Salvando..." : "Salvar estoque"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalCompra && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={salvarCompra}
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-orange-500 to-red-600 p-5 text-white">
              <div>
                <h2 className="text-xl font-black">🛒 Fazer compra</h2>
                <p className="text-sm text-orange-50">
                  Registra entrada no estoque selecionado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalCompra(false)}
                className="rounded-lg p-2 text-2xl hover:bg-white/10"
                disabled={salvandoCompra}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm font-semibold text-gray-700">
                  Fornecedor
                  <select
                    value={compra.fornecedorId}
                    onChange={(event) =>
                      setCompra((atual) => ({ ...atual, fornecedorId: event.target.value }))
                    }
                    className="select-field mt-2"
                  >
                    <option value="">Sem fornecedor</option>
                    {fornecedores.map((fornecedor) => (
                      <option key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-gray-700">
                  Destino *
                  <select
                    value={compra.destinoLojaId}
                    onChange={(event) =>
                      setCompra((atual) => ({ ...atual, destinoLojaId: event.target.value }))
                    }
                    className="select-field mt-2"
                    required
                  >
                    <option value="">Selecione o destino...</option>
                    {lojas.map((loja) => (
                      <option key={loja.id} value={loja.id}>
                        {ehGaragem(loja) ? "🏭" : "🏪"} {loja.nome}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <ProdutosMovimentacaoEditor
                titulo="Produtos da compra"
                produtos={produtos}
                itens={compra.produtos}
                onAdd={adicionarProdutoCompra}
                onRemove={removerProdutoCompra}
                onChange={alterarProdutoCompra}
              />

              <label className="mt-5 block text-sm font-semibold text-gray-700">
                Observação
                <textarea
                  value={compra.observacao}
                  onChange={(event) =>
                    setCompra((atual) => ({ ...atual, observacao: event.target.value }))
                  }
                  className="input-field mt-2"
                  rows="3"
                  placeholder="Nota fiscal, pedido, observações..."
                />
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t bg-gray-50 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setModalCompra(false)}
                className="btn-secondary"
                disabled={salvandoCompra}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={salvandoCompra}>
                {salvandoCompra ? "Registrando..." : "Confirmar compra"}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalMovimentacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={salvarMovimentacao}
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-green-600 to-green-700 p-5 text-white">
              <div>
                <h2 className="text-xl font-black">🔄 Movimentação de estoque</h2>
                <p className="text-sm text-green-50">
                  Transfira produtos do Depósito Principal para uma loja.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalMovimentacao(false)}
                className="rounded-lg p-2 text-2xl hover:bg-white/10"
                disabled={salvandoMovimentacao}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                <strong>Origem:</strong> {garagem?.nome || "Depósito Principal não encontrado"}.
              </div>

              <label className="text-sm font-semibold text-gray-700">
                Loja de destino *
                <select
                  value={movimentacaoLojaId}
                  onChange={(event) => setMovimentacaoLojaId(event.target.value)}
                  className="select-field mt-2"
                  required
                >
                  <option value="">Selecione a loja...</option>
                  {lojasOperacionais.map((loja) => (
                    <option key={loja.id} value={loja.id}>
                      🏪 {loja.nome}
                    </option>
                  ))}
                </select>
              </label>

              <ProdutosMovimentacaoEditor
                titulo="Produtos"
                produtos={produtos}
                itens={produtosMovimentacao}
                onAdd={adicionarProdutoMovimentacao}
                onRemove={removerProdutoMovimentacao}
                onChange={alterarProdutoMovimentacao}
              />
            </div>

            <div className="flex flex-col-reverse gap-3 border-t bg-gray-50 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setModalMovimentacao(false)}
                className="btn-secondary"
                disabled={salvandoMovimentacao}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={salvandoMovimentacao}
              >
                {salvandoMovimentacao ? "Transferindo..." : "Transferir"}
              </button>
            </div>
          </form>
        </div>
      )}

      <Footer />
    </div>
  );
}

function ProdutosMovimentacaoEditor({
  titulo,
  produtos,
  itens,
  onAdd,
  onRemove,
  onChange,
}) {
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-black text-gray-900">{titulo}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white"
        >
          + Adicionar produto
        </button>
      </div>

      <div className="space-y-3">
        {itens.map((item, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_110px_auto] items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
          >
            <label className="text-sm font-semibold text-gray-700">
              Produto
              <select
                value={item.produtoId}
                onChange={(event) => onChange(index, "produtoId", event.target.value)}
                className="select-field mt-1"
                required
              >
                <option value="">Selecione...</option>
                {produtos.map((produto) => (
                  <option key={produto.id} value={produto.id}>
                    {produto.emoji || "📦"} {produto.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-gray-700">
              Quantidade
              <input
                type="number"
                min="1"
                value={item.quantidade}
                onChange={(event) => onChange(index, "quantidade", event.target.value)}
                className="input-field mt-1"
                required
              />
            </label>
            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={itens.length === 1}
              className="mb-1 rounded-lg px-3 py-3 font-bold text-red-600 hover:bg-red-50 disabled:opacity-30"
              title="Remover produto"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Estoque;
