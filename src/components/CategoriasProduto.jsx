import { useEffect, useState } from "react";
import api from "../services/api";
import { Modal } from "./UIComponents";

const mensagemDeErro = (erro, padrao) => erro?.response?.data?.error || padrao;

// Cadastro das categorias de produto: criar, renomear (os produtos da
// categoria passam para o nome novo) e excluir (só sem produtos)
export function CategoriasProduto({ onFechar, onMudou }) {
  const [categorias, setCategorias] = useState(null);
  const [nova, setNova] = useState("");
  const [editando, setEditando] = useState(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    api
      .get("/produtos/categorias/cadastro")
      .then(({ data }) => setCategorias(Array.isArray(data) ? data : []))
      .catch((e) => setErro(mensagemDeErro(e, "Erro ao carregar as categorias.")));
  }, [recarregar]);

  const executar = async (acao) => {
    setSalvando(true);
    setErro("");
    try {
      await acao();
      setRecarregar((n) => n + 1);
      onMudou?.();
      return true;
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível salvar."));
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const criar = async (evento) => {
    evento.preventDefault();
    if (await executar(() => api.post("/produtos/categorias", { nome: nova }))) setNova("");
  };

  return (
    <Modal isOpen onClose={() => !salvando && onFechar()} title="🏷️ Categorias de produto" size="sm">
      <div className="space-y-4">
        <form onSubmit={criar} className="flex gap-2">
          <input
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="Nova categoria (ex.: Ursos)"
            className="input-field flex-1"
            maxLength={50}
            required
            minLength={2}
          />
          <button type="submit" disabled={salvando} className="btn-primary px-4">
            ➕ Criar
          </button>
        </form>

        {erro && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{erro}</p>}
        {!categorias && !erro && <p className="text-sm text-gray-500">Carregando...</p>}
        {categorias && categorias.length === 0 && <p className="text-sm text-gray-500">Nenhuma categoria ainda.</p>}

        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
          {(categorias || []).map((categoria) => (
            <li key={categoria.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              {editando?.id === categoria.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await executar(() => api.put(`/produtos/categorias/${categoria.id}`, { nome: editando.nome }))) setEditando(null);
                  }}
                >
                  <input
                    value={editando.nome}
                    onChange={(e) => setEditando((ed) => ({ ...ed, nome: e.target.value }))}
                    className="input-field flex-1 py-1"
                    maxLength={50}
                    autoFocus
                  />
                  <button type="submit" disabled={salvando} className="btn-primary px-3 py-1 text-xs">Salvar</button>
                  <button type="button" onClick={() => setEditando(null)} className="px-2 text-xs text-gray-500">Cancelar</button>
                </form>
              ) : (
                <>
                  <span className="flex-1">
                    <b>{categoria.nome}</b>{" "}
                    <span className="text-xs text-gray-500">({categoria.produtos} produto{categoria.produtos === 1 ? "" : "s"})</span>
                  </span>
                  <button type="button" onClick={() => setEditando({ id: categoria.id, nome: categoria.nome })} className="text-xs font-semibold text-gray-600 hover:underline">
                    ✏️ Renomear
                  </button>
                  <button
                    type="button"
                    disabled={salvando || categoria.produtos > 0}
                    title={categoria.produtos > 0 ? "Tem produtos nessa categoria" : "Excluir"}
                    onClick={() => {
                      if (window.confirm(`Excluir a categoria "${categoria.nome}"?`)) executar(() => api.delete(`/produtos/categorias/${categoria.id}`));
                    }}
                    className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-30"
                  >
                    Excluir
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500">
          Renomear muda a categoria de todos os produtos dela. Só dá para excluir categoria sem produtos.
        </p>
      </div>
    </Modal>
  );
}

export default CategoriasProduto;
