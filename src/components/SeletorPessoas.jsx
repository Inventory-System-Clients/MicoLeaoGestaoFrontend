import { SelectBusca } from "./SelectBusca";
import { obterPerfil } from "../utils/perfis";

// Escolher várias pessoas (tarefas, manutenção...). `opcoes`: usuários
// { id, nome, role }; `valor`: lista de ids (a 1ª é a principal);
// `vazio`: texto quando ninguém foi escolhido.
export function SeletorPessoas({ opcoes = [], valor = [], aoMudar, placeholder = "Adicionar pessoa...", vazio = "👥 Ninguém em especial", disabled = false }) {
  const escolhidos = valor.map((id) => opcoes.find((p) => p.id === id) || { id, nome: "Pessoa" });
  return (
    <div>
      {!disabled && (
        <SelectBusca
          opcoes={opcoes
            .filter((pessoa) => !valor.includes(pessoa.id))
            .map((pessoa) => ({ valor: pessoa.id, rotulo: pessoa.nome, detalhe: pessoa.role ? obterPerfil(pessoa.role).curto : "" }))}
          valor=""
          aoMudar={(id) => id && aoMudar([...valor, id])}
          placeholder={placeholder}
        />
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {escolhidos.length === 0 && <span className="text-sm font-normal text-gray-500">{vazio}</span>}
        {escolhidos.map((pessoa) => (
          <span key={pessoa.id} className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-800">
            {pessoa.nome}
            {pessoa.role ? <span className="text-xs font-normal text-orange-600">({obterPerfil(pessoa.role).curto})</span> : null}
            {!disabled && (
              <button
                type="button"
                className="ml-1 text-orange-500 hover:text-red-600"
                onClick={() => aoMudar(valor.filter((x) => x !== pessoa.id))}
                aria-label={`Tirar ${pessoa.nome}`}
              >
                ✕
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export default SeletorPessoas;
