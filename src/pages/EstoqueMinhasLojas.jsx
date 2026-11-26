import { useEffect, useState } from "react";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageLoader } from "../components/Loading";
import { PageHeader } from "../components/UIComponents";

// Estoque das lojas do usuário (as do cadastro dele), só para consultar.
// Loja que usa o estoque de outra mostra esse estoque (avisando de quem é).
export default function EstoqueMinhasLojas() {
  const [lojas, setLojas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [lojaAberta, setLojaAberta] = useState(null);

  useEffect(() => {
    api
      .get("/estoque-lojas/minhas")
      .then(({ data }) => {
        const lista = Array.isArray(data) ? data : [];
        setLojas(lista);
        if (lista.length === 1) setLojaAberta(lista[0].loja.id);
      })
      .catch((e) => setErro(e?.response?.data?.error || "Erro ao carregar o estoque"))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) return <PageLoader />;

  const termo = busca.trim().toLowerCase();
  const filtrar = (itens) =>
    itens.filter((item) => !termo || [item.nome, item.codigo].filter(Boolean).some((t) => String(t).toLowerCase().includes(termo)));

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader title="Estoque das minhas lojas" subtitle="O que tem em cada loja sua (só consulta)" icon="📦" />

        {erro && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{erro}</div>}

        {lojas.length === 0 && !erro && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 p-8 text-center text-sm text-gray-500">
            Nenhuma loja no seu cadastro. Peça ao admin para incluir suas lojas.
          </div>
        )}

        {lojas.length > 0 && (
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔍 Buscar produto"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        )}

        {lojas.map(({ loja, estoqueDe, itens }) => {
          const aberta = lojaAberta === loja.id || Boolean(termo);
          const total = itens.reduce((soma, item) => soma + item.quantidade, 0);
          const baixos = itens.filter((item) => item.estoqueMinimo > 0 && item.quantidade <= item.estoqueMinimo).length;
          const visiveis = filtrar(itens);
          return (
            <section key={loja.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setLojaAberta(aberta && !termo ? null : loja.id)}
                className="flex w-full flex-wrap items-center justify-between gap-2 p-4 text-left"
              >
                <span>
                  <span className="block text-lg font-black text-gray-900">🏪 {loja.nome}</span>
                  {estoqueDe && <span className="block text-xs font-semibold text-violet-700">Usa o estoque de {estoqueDe.nome}</span>}
                </span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 font-bold text-gray-700">{total} un.</span>
                  {baixos > 0 && <span className="rounded-full bg-rose-100 px-2.5 py-1 font-bold text-rose-700">⚠️ {baixos} baixo{baixos > 1 ? "s" : ""}</span>}
                  <span className="text-gray-400">{aberta ? "▲" : "▼"}</span>
                </span>
              </button>
              {aberta && (
                <div className="border-t border-gray-100 p-4">
                  {visiveis.length === 0 ? (
                    <p className="text-sm text-gray-500">{itens.length ? "Nenhum produto com essa busca." : "Sem produtos no estoque."}</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {visiveis.map((item) => {
                        const baixo = item.estoqueMinimo > 0 && item.quantidade <= item.estoqueMinimo;
                        return (
                          <li key={item.produtoId} className="flex items-center justify-between gap-2 py-2 text-sm">
                            <span className="min-w-0">
                              {item.emoji || "🧸"} <b>{item.nome}</b>
                              {item.codigo && <span className="text-xs text-gray-400"> · {item.codigo}</span>}
                            </span>
                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-black ${baixo ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-800"}`}>
                              {item.quantidade}
                              {item.estoqueMinimo > 0 && <span className="font-normal text-gray-500"> / mín. {item.estoqueMinimo}</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </main>
      <Footer />
    </div>
  );
}
