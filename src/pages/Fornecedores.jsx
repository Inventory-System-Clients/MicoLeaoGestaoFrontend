import { useEffect, useMemo, useState } from "react";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { Navbar } from "../components/Navbar";
import { AlertBox } from "../components/UIComponents";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";

const produtoVazio = {
  produtoNome: "",
  quantidade: "",
  unidade: "un",
  preco: "",
  observacoes: "",
};

const anexoVazio = {
  titulo: "",
  url: "",
  tipo: "ORCAMENTO",
};

const fornecedorVazio = {
  nome: "",
  contato: "",
  telefoneWhatsapp: "",
  cidade: "",
  observacoes: "",
  ativo: true,
  produtos: [{ ...produtoVazio }],
  anexos: [],
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numero = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const calcularUnitario = (produto) => {
  const quantidade = Number(produto.quantidade);
  const preco = Number(produto.preco);
  if (!quantidade || quantidade <= 0) return 0;
  return preco / quantidade;
};

const limparPayload = (form) => ({
  ...form,
  produtos: form.produtos.map((produto) => ({
    ...produto,
    quantidade: Number(produto.quantidade),
    preco: Number(produto.preco),
  })),
  anexos: form.anexos.filter((anexo) => anexo.url.trim()),
});

export function Fornecedores() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === "ADMIN";
  const [loading, setLoading] = useState(true);
  const [fornecedores, setFornecedores] = useState([]);
  const [comparacoes, setComparacoes] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(fornecedorVazio);
  const [filtros, setFiltros] = useState({ busca: "", produto: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [fornecedoresRes, comparacoesRes] = await Promise.all([
        api.get("/fornecedores"),
        api.get("/fornecedores/comparacoes"),
      ]);
      setFornecedores(fornecedoresRes.data || []);
      setComparacoes(comparacoesRes.data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao carregar fornecedores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const abrirNovo = () => {
    setEditando(null);
    setForm({
      ...fornecedorVazio,
      produtos: [{ ...produtoVazio }],
      anexos: [],
    });
    setMostrarModal(true);
  };

  const abrirEdicao = (fornecedor) => {
    setEditando(fornecedor);
    setForm({
      nome: fornecedor.nome || "",
      contato: fornecedor.contato || "",
      telefoneWhatsapp: fornecedor.telefoneWhatsapp || "",
      cidade: fornecedor.cidade || "",
      observacoes: fornecedor.observacoes || "",
      ativo: fornecedor.ativo !== false,
      produtos:
        fornecedor.produtos?.length > 0
          ? fornecedor.produtos.map((produto) => ({
              produtoNome: produto.produtoNome || "",
              quantidade: produto.quantidade || "",
              unidade: produto.unidade || "un",
              preco: produto.preco || "",
              observacoes: produto.observacoes || "",
            }))
          : [{ ...produtoVazio }],
      anexos:
        fornecedor.anexos?.map((anexo) => ({
          titulo: anexo.titulo || "",
          url: anexo.url || "",
          tipo: anexo.tipo || "ORCAMENTO",
        })) || [],
    });
    setMostrarModal(true);
  };

  const salvarFornecedor = async (event) => {
    event.preventDefault();
    try {
      setError("");
      const payload = limparPayload(form);
      if (editando) {
        await api.put(`/fornecedores/${editando.id}`, payload);
        setSuccess("Fornecedor atualizado.");
      } else {
        await api.post("/fornecedores", payload);
        setSuccess("Fornecedor cadastrado.");
      }
      setMostrarModal(false);
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao salvar fornecedor.");
    }
  };

  const excluirFornecedor = async (fornecedor) => {
    if (!window.confirm(`Remover fornecedor ${fornecedor.nome}?`)) return;
    try {
      await api.delete(`/fornecedores/${fornecedor.id}`);
      setSuccess("Fornecedor removido.");
      await carregarDados();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao remover fornecedor.");
    }
  };

  const atualizarProduto = (index, campo, valor) => {
    setForm((prev) => ({
      ...prev,
      produtos: prev.produtos.map((produto, produtoIndex) =>
        produtoIndex === index ? { ...produto, [campo]: valor } : produto,
      ),
    }));
  };

  const atualizarAnexo = (index, campo, valor) => {
    setForm((prev) => ({
      ...prev,
      anexos: prev.anexos.map((anexo, anexoIndex) =>
        anexoIndex === index ? { ...anexo, [campo]: valor } : anexo,
      ),
    }));
  };

  const fornecedoresFiltrados = useMemo(() => {
    const busca = filtros.busca.trim().toLowerCase();
    const produtoBusca = filtros.produto.trim().toLowerCase();
    return fornecedores.filter((fornecedor) => {
      const textoFornecedor = [
        fornecedor.nome,
        fornecedor.contato,
        fornecedor.telefoneWhatsapp,
        fornecedor.cidade,
      ]
        .join(" ")
        .toLowerCase();
      const produtosTexto = fornecedor.produtos
        ?.map((produto) => produto.produtoNome)
        .join(" ")
        .toLowerCase();

      if (busca && !textoFornecedor.includes(busca)) return false;
      if (produtoBusca && !produtosTexto?.includes(produtoBusca)) return false;
      return true;
    });
  }, [fornecedores, filtros]);

  const comparacoesFiltradas = useMemo(() => {
    const produtoBusca = filtros.produto.trim().toLowerCase();
    if (!produtoBusca) return comparacoes;
    return comparacoes.filter((item) =>
      String(item.produto || "").toLowerCase().includes(produtoBusca),
    );
  }, [comparacoes, filtros.produto]);

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fornecedores</h1>
            <p className="mt-2 text-gray-600">
              Cadastro de fornecedores, produtos, orcamentos e comparacao de precos.
            </p>
          </div>
          {isAdmin && (
            <button type="button" className="btn-primary" onClick={abrirNovo}>
              Cadastrar fornecedor
            </button>
          )}
        </div>

        {error && <AlertBox type="error" message={error} onClose={() => setError("")} />}
        {success && (
          <AlertBox type="success" message={success} onClose={() => setSuccess("")} />
        )}

        <section className="mb-6 rounded-lg border border-orange-100 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Filtros</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Fornecedor, contato ou cidade
              </label>
              <input
                className="input-field"
                value={filtros.busca}
                onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
                placeholder="Ex: Atacado Centro"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Produto
              </label>
              <input
                className="input-field"
                value={filtros.produto}
                onChange={(e) => setFiltros({ ...filtros, produto: e.target.value })}
                placeholder="Ex: pelucia panda"
              />
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-lg border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Comparacao de precos</h2>
              <p className="text-sm text-gray-600">
                Produtos com nomes iguais sao comparados por preco unitario.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
              {comparacoesFiltradas.length} produtos
            </span>
          </div>
          <div className="space-y-4">
            {comparacoesFiltradas.map((comparacao) => (
              <article key={comparacao.produto} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-gray-900">{comparacao.produto}</h3>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
                    Melhor: {moeda.format(Number(comparacao.melhorPrecoUnitario || 0))}/un
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {comparacao.fornecedores.map((item, index) => (
                    <div
                      key={`${item.fornecedorId}-${item.produtoId}`}
                      className={`rounded-lg border p-4 ${
                        index === 0
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-gray-900">{item.fornecedorNome}</p>
                          <p className="text-sm text-gray-600">
                            {numero.format(item.quantidade)} {item.unidade} por{" "}
                            {moeda.format(Number(item.preco || 0))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold uppercase text-gray-500">
                            Unitario
                          </p>
                          <p className="font-bold text-gray-900">
                            {moeda.format(Number(item.precoUnitario || 0))}
                          </p>
                        </div>
                      </div>
                      {(item.cidade || item.telefoneWhatsapp) && (
                        <p className="mt-2 text-sm text-gray-600">
                          {item.cidade || "Sem cidade"} -{" "}
                          {item.telefoneWhatsapp || "Sem WhatsApp"}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {comparacoesFiltradas.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-gray-500">
                Nenhum produto para comparar ainda.
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Fornecedores cadastrados</h2>
            <span className="text-sm font-semibold text-gray-500">
              {fornecedoresFiltrados.length} encontrados
            </span>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {fornecedoresFiltrados.map((fornecedor) => (
              <article
                key={fornecedor.id}
                className="rounded-lg border border-orange-100 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-bold text-gray-900">{fornecedor.nome}</h3>
                      {!fornecedor.ativo && (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {fornecedor.contato || "Sem contato"} -{" "}
                      {fornecedor.telefoneWhatsapp || "Sem WhatsApp"}
                    </p>
                    {fornecedor.cidade && (
                      <p className="text-sm text-gray-600">{fornecedor.cidade}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() => abrirEdicao(fornecedor)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-danger text-sm"
                        onClick={() => excluirFornecedor(fornecedor)}
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {fornecedor.produtos?.map((produto) => (
                    <div
                      key={produto.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-gray-900">{produto.produtoNome}</p>
                          <p className="text-sm text-gray-600">
                            {numero.format(Number(produto.quantidade || 0))}{" "}
                            {produto.unidade} por {moeda.format(Number(produto.preco || 0))}
                          </p>
                        </div>
                        <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-700">
                          {moeda.format(calcularUnitario(produto))}/un
                        </span>
                      </div>
                      {produto.observacoes && (
                        <p className="mt-2 text-sm text-gray-600">{produto.observacoes}</p>
                      )}
                    </div>
                  ))}
                </div>

                {fornecedor.anexos?.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-bold text-gray-700">
                      Fotos e orcamentos
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {fornecedor.anexos.map((anexo) => (
                        <a
                          key={anexo.id}
                          href={anexo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-bold text-orange-700"
                        >
                          {anexo.titulo || anexo.tipo || "Anexo"}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {fornecedor.observacoes && (
                  <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">
                    {fornecedor.observacoes}
                  </p>
                )}
              </article>
            ))}
          </div>
          {fornecedoresFiltrados.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-gray-600">
              Nenhum fornecedor encontrado.
            </div>
          )}
        </section>

        {isAdmin && mostrarModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <form
              onSubmit={salvarFornecedor}
              className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-orange-100 bg-white p-5 shadow-2xl"
            >
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editando ? "Editar fornecedor" : "Cadastrar fornecedor"}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Obrigatorio: nome, produto, quantidade e preco.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMostrarModal(false)}
                >
                  Fechar
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Nome *
                  </label>
                  <input
                    className="input-field"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Nome do fornecedor"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Contato
                  </label>
                  <input
                    className="input-field"
                    value={form.contato}
                    onChange={(e) => setForm({ ...form, contato: e.target.value })}
                    placeholder="Pessoa responsavel"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Telefone/WhatsApp
                  </label>
                  <input
                    className="input-field"
                    value={form.telefoneWhatsapp}
                    onChange={(e) =>
                      setForm({ ...form, telefoneWhatsapp: e.target.value })
                    }
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Cidade
                  </label>
                  <input
                    className="input-field"
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    placeholder="Sao Paulo"
                  />
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-orange-100 bg-orange-50/60 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900">Produtos e precos</h3>
                    <p className="text-sm text-gray-600">
                      Exemplo: produto 1, quantidade 10, preco 100 reais.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() =>
                      setForm({ ...form, produtos: [...form.produtos, { ...produtoVazio }] })
                    }
                  >
                    Adicionar produto
                  </button>
                </div>
                <div className="space-y-3">
                  {form.produtos.map((produto, index) => (
                    <div
                      key={`produto-${index}`}
                      className="grid grid-cols-1 gap-3 rounded-lg border border-orange-100 bg-white p-3 md:grid-cols-12"
                    >
                      <div className="md:col-span-4">
                        <label className="mb-2 block text-sm font-semibold text-gray-700">
                          Produto *
                        </label>
                        <input
                          className="input-field"
                          value={produto.produtoNome}
                          onChange={(e) =>
                            atualizarProduto(index, "produtoNome", e.target.value)
                          }
                          placeholder="Nome do produto"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-semibold text-gray-700">
                          Qtd *
                        </label>
                        <input
                          className="input-field"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={produto.quantidade}
                          onChange={(e) =>
                            atualizarProduto(index, "quantidade", e.target.value)
                          }
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-semibold text-gray-700">
                          Unidade
                        </label>
                        <input
                          className="input-field"
                          value={produto.unidade}
                          onChange={(e) => atualizarProduto(index, "unidade", e.target.value)}
                          placeholder="un"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-semibold text-gray-700">
                          Preco *
                        </label>
                        <input
                          className="input-field"
                          type="number"
                          min="0"
                          step="0.01"
                          value={produto.preco}
                          onChange={(e) => atualizarProduto(index, "preco", e.target.value)}
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-semibold text-gray-700">
                          Unitario
                        </label>
                        <div className="flex h-[50px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-gray-900">
                          {moeda.format(calcularUnitario(produto))}
                        </div>
                      </div>
                      <div className="md:col-span-10">
                        <input
                          className="input-field"
                          value={produto.observacoes}
                          onChange={(e) =>
                            atualizarProduto(index, "observacoes", e.target.value)
                          }
                          placeholder="Observacao do preco, marca ou condicao"
                        />
                      </div>
                      <div className="flex items-end md:col-span-2">
                        <button
                          type="button"
                          className="btn-danger w-full text-sm"
                          disabled={form.produtos.length === 1}
                          onClick={() =>
                            setForm({
                              ...form,
                              produtos: form.produtos.filter((_, itemIndex) => itemIndex !== index),
                            })
                          }
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900">Fotos e orcamentos</h3>
                    <p className="text-sm text-gray-600">
                      Vincule links de fotos, PDFs ou orcamentos recebidos.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    onClick={() =>
                      setForm({ ...form, anexos: [...form.anexos, { ...anexoVazio }] })
                    }
                  >
                    Adicionar anexo
                  </button>
                </div>
                <div className="space-y-3">
                  {form.anexos.map((anexo, index) => (
                    <div
                      key={`anexo-${index}`}
                      className="grid grid-cols-1 gap-3 rounded-lg border border-blue-100 bg-white p-3 md:grid-cols-12"
                    >
                      <input
                        className="input-field md:col-span-3"
                        value={anexo.titulo}
                        onChange={(e) => atualizarAnexo(index, "titulo", e.target.value)}
                        placeholder="Titulo"
                      />
                      <input
                        className="input-field md:col-span-6"
                        value={anexo.url}
                        onChange={(e) => atualizarAnexo(index, "url", e.target.value)}
                        placeholder="Link do arquivo ou foto"
                      />
                      <select
                        className="select-field md:col-span-2"
                        value={anexo.tipo}
                        onChange={(e) => atualizarAnexo(index, "tipo", e.target.value)}
                      >
                        <option value="ORCAMENTO">Orcamento</option>
                        <option value="FOTO">Foto</option>
                        <option value="NOTA">Nota</option>
                      </select>
                      <button
                        type="button"
                        className="btn-danger text-sm md:col-span-1"
                        onClick={() =>
                          setForm({
                            ...form,
                            anexos: form.anexos.filter((_, itemIndex) => itemIndex !== index),
                          })
                        }
                      >
                        X
                      </button>
                    </div>
                  ))}
                  {form.anexos.length === 0 && (
                    <p className="text-sm text-gray-500">Nenhum anexo vinculado.</p>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Observacoes
                </label>
                <textarea
                  className="input-field min-h-24"
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Condicoes de entrega, prazo, pagamento, qualidade..."
                />
              </div>

              <label className="mt-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                />
                Fornecedor ativo
              </label>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMostrarModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar fornecedor
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
