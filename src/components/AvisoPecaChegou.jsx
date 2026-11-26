import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Aviso no topo (todas as telas) para quem vai fazer a manutenção: a peça
// pedida para compra chegou no estoque. Some quando a pessoa toca em "Ver" ou
// fecha; volta a avisar se for pedida outra peça para a mesma manutenção.
const CHAVE = "avisosPecaChegouVistos";

const lerVistos = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) || "[]");
  } catch {
    return [];
  }
};

// Identifica o aviso pela manutenção + as compras pedidas (nova compra = novo aviso)
const chaveDoAviso = (m) =>
  `${m.id}:${(m.pecasNecessarias || [])
    .filter((p) => p.situacao === "COMPRA_SOLICITADA")
    .map((p) => p.id)
    .sort()
    .join(",")}`;

export function AvisoPecaChegou() {
  const { avisosPecaChegou = [] } = useAuth();
  const [vistos, setVistos] = useState(lerVistos);

  const pendentes = avisosPecaChegou.filter((m) => !vistos.includes(chaveDoAviso(m)));
  if (!pendentes.length) return null;

  const dispensar = (m) => {
    const novos = [...vistos, chaveDoAviso(m)].slice(-200);
    setVistos(novos);
    try {
      localStorage.setItem(CHAVE, JSON.stringify(novos));
    } catch {
      // Sem armazenamento: o aviso só some até recarregar
    }
  };

  return (
    <div className="border-b border-emerald-300 bg-emerald-50">
      <div className="mx-auto max-w-7xl space-y-1 px-4 py-2 sm:px-6 lg:px-8">
        {pendentes.map((m) => {
          const pecas = (m.pecasNecessarias || [])
            .filter((p) => p.situacao === "COMPRA_SOLICITADA")
            .map((p) => `${p.quantidade}× ${p.nome}`)
            .join(", ");
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-2 text-sm text-emerald-900">
              <span className="font-bold">✅ A peça chegou!</span>
              <span className="min-w-0 flex-1">
                {pecas} para a manutenção <b>{m.titulo}</b>
                {m.loja?.nome ? ` (${m.loja.nome})` : ""}
                {m.status === "PENDENTE" ? " — aceite e diga o dia que vai fazer." : " — já pode fazer."}
              </span>
              <Link
                to="/manutencao"
                onClick={() => dispensar(m)}
                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-700"
              >
                Ver
              </Link>
              <button
                type="button"
                onClick={() => dispensar(m)}
                className="px-1 text-emerald-700 hover:text-emerald-950"
                aria-label="Fechar aviso"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AvisoPecaChegou;
