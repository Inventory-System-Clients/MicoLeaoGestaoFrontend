// Cadastro do usuário: escala do ponto (diária ou 12x36), jornada, salário e
// diária. Usados no controle de ponto (dias de trabalho/folga, hora extra 50%
// e 100%, valor da diária).
const DIAS = [
  [1, "Seg"],
  [2, "Ter"],
  [3, "Qua"],
  [4, "Qui"],
  [5, "Sex"],
  [6, "Sáb"],
  [0, "Dom"],
];

export function CamposPontoUsuario({ valor, aoMudar }) {
  const mudar = (campo, novo) => aoMudar({ ...valor, [campo]: novo });
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Escala</p>
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          {[
            ["DIARIA", "📅 Diária"],
            ["12X36", "🔁 12 x 36"],
          ].map(([escala, rotulo]) => (
            <button
              key={escala}
              type="button"
              onClick={() =>
                aoMudar({
                  ...valor,
                  escala,
                  // 12x36: jornada de 12h por padrão
                  jornada: escala === "12X36" && valor.jornada === "08:00" ? "12:00" : escala === "DIARIA" && valor.jornada === "12:00" ? "08:00" : valor.jornada,
                })
              }
              className={`rounded-lg px-4 py-1.5 text-sm font-bold ${valor.escala === escala ? "bg-white text-gray-900 shadow" : "text-gray-500"}`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {valor.escala === "DIARIA" ? (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Dias de trabalho (os outros são folga)</p>
          <div className="flex flex-wrap gap-2">
            {DIAS.map(([numero, rotulo]) => {
              const marcado = valor.diasTrabalho.includes(numero);
              return (
                <button
                  key={numero}
                  type="button"
                  onClick={() =>
                    mudar("diasTrabalho", marcado ? valor.diasTrabalho.filter((d) => d !== numero) : [...valor.diasTrabalho, numero])
                  }
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                    marcado ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600"
                  }`}
                >
                  {rotulo}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <label className="block text-sm font-medium text-gray-700">
          Um dia de trabalho da escala *
          <input
            type="date"
            value={valor.escalaInicio}
            onChange={(e) => mudar("escalaInicio", e.target.value)}
            className="input-field mt-1"
            required
          />
          <span className="mt-1 block text-xs text-gray-500">A partir desse dia: trabalha um dia, folga o outro (12h de trabalho, 36h de descanso).</span>
        </label>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="block text-sm font-medium text-gray-700">
          Jornada por dia de trabalho
          <input type="time" value={valor.jornada} onChange={(e) => mudar("jornada", e.target.value)} className="input-field mt-1" required />
          <span className="mt-1 block text-xs text-gray-500">Sem contar o almoço.</span>
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Salário (R$)
          <input
            type="text"
            inputMode="decimal"
            value={valor.salario}
            onChange={(e) => mudar("salario", e.target.value)}
            placeholder="Ex: 2200,00"
            className="input-field mt-1"
          />
          <span className="mt-1 block text-xs text-gray-500">Para o valor da hora extra.</span>
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Valor da diária (R$)
          <input
            type="text"
            inputMode="decimal"
            value={valor.valorDiaria}
            onChange={(e) => mudar("valorDiaria", e.target.value)}
            placeholder="Vazio = salário ÷ 30"
            className="input-field mt-1"
          />
          <span className="mt-1 block text-xs text-gray-500">Quando o dia extra é pago como diária.</span>
        </label>
      </div>
      <p className="rounded-lg bg-slate-50 p-3 text-xs text-gray-600">
        Hora extra: <b>50%</b> nos dias normais e <b>100%</b> em domingo e feriado. Almoço não feito não conta como hora extra.
        Trabalhar na folga: todas as horas contam como extra.
      </p>
    </div>
  );
}

export default CamposPontoUsuario;
