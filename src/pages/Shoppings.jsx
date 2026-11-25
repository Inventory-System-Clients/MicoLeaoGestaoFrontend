import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader, AlertBox, Modal } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";
import { pode } from "../utils/perfis";

// Cadastros > Shoppings: cada shopping agrupa lojas e máquinas avulsas
// (máquina no shopping sem loja). A loja escolhe o shopping no cadastro dela;
// a máquina avulsa, no cadastro da máquina.

const VAZIO = { nome: "", endereco: "", cidade: "", estado: "", observacoes: "" };
const ESTADOS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const erroDe = (error, padrao) => error?.response?.data?.error || padrao;

function FormShopping({ shopping, onFechar, onSalvo }) {
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setErro("");
    setForm(shopping?.id ? { ...VAZIO, ...Object.fromEntries(Object.keys(VAZIO).map((c) => [c, shopping[c] || ""])) } : VAZIO);
  }, [shopping]);

  const mudar = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const salvar = async (evento) => {
    evento.preventDefault();
    setSalvando(true);
    setErro("");
    try {
      if (shopping?.id) await api.put(`/shoppings/${shopping.id}`, form);
      else await api.post("/shoppings", form);
      onSalvo();
    } catch (error) {
      setErro(erroDe(error, "Erro ao salvar o shopping."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen={Boolean(shopping)} onClose={() => !salvando && onFechar()} title={shopping?.id ? "Editar shopping" : "Novo shopping"} size="md">
      <form onSubmit={salvar} className="space-y-4 text-left">
        <label className="block text-sm font-semibold text-gray-700">
          Nome *
          <input className="input-field mt-1" required maxLength={120} value={form.nome} onChange={(e) => mudar("nome", e.target.value)} placeholder="Ex.: Shopping Center Norte" />
        </label>
        <label className="block text-sm font-semibold text-gray-700">
          Endereço
          <input className="input-field mt-1" maxLength={255} value={form.endereco} onChange={(e) => mudar("endereco", e.target.value)} />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-2 block text-sm font-semibold text-gray-700">
            Cidade
            <input className="input-field mt-1" maxLength={100} value={form.cidade} onChange={(e) => mudar("cidade", e.target.value)} />
          </label>
          <label className="block text-sm font-semibold text-gray-700">
            Estado
            <select className="select-field mt-1" value={form.estado} onChange={(e) => mudar("estado", e.target.value)}>
              <option value="">—</option>
              {ESTADOS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm font-semibold text-gray-700">
          Observações
          <textarea className="input-field mt-1" rows={2} value={form.observacoes} onChange={(e) => mudar("observacoes", e.target.value)} />
        </label>
        {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}

export function Shoppings() {
  const { usuario } = useAuth();
  const regraCadastro = ["ADMIN", "FUNCIONARIO_CADASTRO"].includes(usuario?.role);
  const podeGerenciar = pode(usuario, "shoppings.gerenciar", regraCadastro);

  const [shoppings, setShoppings] = useState(null);
  const [verInativos, setVerInativos] = useState(false);
  const [editando, setEditando] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const carregar = () =>
    api
      .get("/shoppings", { params: verInativos ? { inativos: "true" } : {} })
      .then(({ data }) => setShoppings(data))
      .catch((error) => {
        setErro(erroDe(error, "Erro ao carregar os shoppings."));
        setShoppings([]);
      });

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verInativos]);

  const excluir = async (shopping) => {
    const texto = shopping.ativo
      ? `Desativar o shopping "${shopping.nome}"? As lojas e máquinas dele não mudam.`
      : `Excluir de vez o shopping "${shopping.nome}"?`;
    if (!window.confirm(texto)) return;
    try {
      const { data } = await api.delete(`/shoppings/${shopping.id}`);
      setAviso(data?.message || "Pronto.");
      carregar();
    } catch (error) {
      setErro(erroDe(error, "Erro ao excluir o shopping."));
    }
  };

  const reativar = async (shopping) => {
    try {
      await api.put(`/shoppings/${shopping.id}`, { ativo: true });
      carregar();
    } catch (error) {
      setErro(erroDe(error, "Erro ao reativar o shopping."));
    }
  };

  if (shoppings === null) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Shoppings"
          subtitle="Lojas e máquinas avulsas de cada shopping"
          icon="🏬"
          action={
            podeGerenciar ? (
              <button type="button" className="btn-primary" onClick={() => setEditando({})}>
                + Novo shopping
              </button>
            ) : undefined
          }
        />

        {erro && <AlertBox type="error" message={erro} onClose={() => setErro("")} />}
        {aviso && <AlertBox type="success" message={aviso} onClose={() => setAviso("")} />}

        <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} />
          Mostrar desativados
        </label>

        {shoppings.length === 0 && (
          <div className="rounded-xl bg-white p-10 text-center text-gray-500 shadow-sm">
            Nenhum shopping cadastrado.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shoppings.map((shopping) => {
            const lojas = (shopping.lojas || []).filter((loja) => loja.ativo !== false);
            const avulsas = (shopping.maquinasAvulsas || []).filter((maquina) => maquina.ativo !== false);
            return (
              <div key={shopping.id} className={`rounded-xl border bg-white p-4 shadow-sm ${shopping.ativo ? "border-gray-100" : "border-gray-200 opacity-70"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-gray-900">🏬 {shopping.nome}</p>
                    {(shopping.cidade || shopping.estado) && (
                      <p className="text-sm text-gray-500">{[shopping.cidade, shopping.estado].filter(Boolean).join(" / ")}</p>
                    )}
                    {!shopping.ativo && <span className="mt-1 inline-block rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">Desativado</span>}
                  </div>
                  {podeGerenciar && (
                    <div className="flex shrink-0 gap-1">
                      {shopping.ativo ? (
                        <button type="button" className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100" onClick={() => setEditando(shopping)}>
                          ✏️ Editar
                        </button>
                      ) : (
                        <button type="button" className="rounded-lg px-2 py-1 text-sm text-green-700 hover:bg-green-50" onClick={() => reativar(shopping)}>
                          Reativar
                        </button>
                      )}
                      <button type="button" className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50" onClick={() => excluir(shopping)}>
                        {shopping.ativo ? "Desativar" : "Excluir"}
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <p className="text-xs font-bold uppercase text-gray-500">Lojas ({lojas.length})</p>
                  {lojas.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhuma — escolha o shopping no cadastro da loja.</p>
                  ) : (
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {lojas.map((loja) => (
                        <li key={loja.id}>
                          <Link to={`/lojas/${loja.id}`} className="inline-block rounded-full bg-orange-50 px-2 py-0.5 text-sm text-orange-800 hover:bg-orange-100">
                            🏪 {loja.nome}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-3">
                  <p className="text-xs font-bold uppercase text-gray-500">Máquinas avulsas ({avulsas.length})</p>
                  {avulsas.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhuma.</p>
                  ) : (
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {avulsas.map((maquina) => (
                        <li key={maquina.id} className="rounded-full bg-blue-50 px-2 py-0.5 text-sm text-blue-800">
                          🎮 {maquina.codigo}{maquina.nome ? ` · ${maquina.nome}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {shopping.observacoes && <p className="mt-3 whitespace-pre-line text-sm text-gray-600">{shopping.observacoes}</p>}
              </div>
            );
          })}
        </div>
      </div>
      <Footer />

      <FormShopping
        shopping={editando}
        onFechar={() => setEditando(null)}
        onSalvo={() => {
          setEditando(null);
          carregar();
        }}
      />
    </div>
  );
}

export default Shoppings;
