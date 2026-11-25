// Soma por shopping (Relatórios > Todas as lojas). Cada linha junta as lojas
// e máquinas avulsas do shopping; "Fora de shopping" = lojas de rua.
// Recebe `porShopping` de /relatorios/todas-lojas.

const reais = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function RelatorioPorShopping({ porShopping, aoEscolher }) {
  if (!Array.isArray(porShopping) || porShopping.length === 0) return null;
  const total = porShopping.reduce(
    (acc, g) => ({
      lucroBruto: acc.lucroBruto + Number(g.lucroBruto || 0),
      custoTotal: acc.custoTotal + Number(g.custoTotal || 0),
      lucroLiquido: acc.lucroLiquido + Number(g.lucroLiquido || 0),
      fichas: acc.fichas + Number(g.fichas || 0),
    }),
    { lucroBruto: 0, custoTotal: 0, lucroLiquido: 0, fichas: 0 },
  );

  return (
    <div className="card mb-6">
      <h3 className="mb-1 text-lg font-bold text-gray-900">🏬 Por shopping</h3>
      <p className="mb-3 text-xs text-gray-500">
        Soma das lojas e máquinas avulsas de cada shopping.{aoEscolher ? " Clique num shopping para ver só ele." : ""}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-gray-500">
              <th className="py-2 pr-2">Shopping</th>
              <th className="py-2 pr-2 text-right">Pontos</th>
              <th className="py-2 pr-2 text-right">Bruto</th>
              <th className="py-2 pr-2 text-right">Custos</th>
              <th className="py-2 pr-2 text-right">Líquido</th>
              <th className="py-2 pr-2 text-right">Fichas</th>
              <th className="py-2 text-right">Participação</th>
            </tr>
          </thead>
          <tbody>
            {porShopping.map((g) => (
              <tr key={g.shoppingId} className="border-b border-gray-100">
                <td className="py-2 pr-2 font-semibold text-gray-900">
                  {aoEscolher ? (
                    <button type="button" className="text-left text-primary hover:underline" onClick={() => aoEscolher(g.shoppingId)}>
                      {g.shoppingNome}
                    </button>
                  ) : (
                    g.shoppingNome
                  )}
                </td>
                <td className="py-2 pr-2 text-right text-gray-600">
                  {g.lojas} 🏪{g.avulsas ? ` · ${g.avulsas} 🎮` : ""}
                </td>
                <td className="py-2 pr-2 text-right">{reais(g.lucroBruto)}</td>
                <td className="py-2 pr-2 text-right text-red-700">{reais(g.custoTotal)}</td>
                <td className={`py-2 pr-2 text-right font-bold ${Number(g.lucroLiquido) < 0 ? "text-red-700" : "text-green-700"}`}>
                  {reais(g.lucroLiquido)}
                </td>
                <td className="py-2 pr-2 text-right">{Number(g.fichas || 0).toLocaleString("pt-BR")}</td>
                <td className="py-2 text-right">{Number(g.participacaoLucroBruto || 0).toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="py-2 pr-2">Total</td>
              <td />
              <td className="py-2 pr-2 text-right">{reais(total.lucroBruto)}</td>
              <td className="py-2 pr-2 text-right text-red-700">{reais(total.custoTotal)}</td>
              <td className="py-2 pr-2 text-right">{reais(total.lucroLiquido)}</td>
              <td className="py-2 pr-2 text-right">{total.fichas.toLocaleString("pt-BR")}</td>
              <td className="py-2 text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RelatorioPorShopping;
