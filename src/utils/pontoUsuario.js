// Campos do ponto no cadastro do usuário (components/CamposPontoUsuario.jsx)
export const PONTO_VAZIO = {
  escala: "DIARIA",
  diasTrabalho: [1, 2, 3, 4, 5, 6],
  escalaInicio: "",
  jornada: "08:00",
  salario: "",
  valorDiaria: "",
};

const paraHoras = (minutos) =>
  `${String(Math.floor((minutos ?? 480) / 60)).padStart(2, "0")}:${String((minutos ?? 480) % 60).padStart(2, "0")}`;

// Usuário da API -> campos do formulário
export const pontoDoUsuario = (usuario) => ({
  escala: usuario?.escala || "DIARIA",
  diasTrabalho: Array.isArray(usuario?.diasTrabalho) && usuario.diasTrabalho.length ? usuario.diasTrabalho : [1, 2, 3, 4, 5, 6],
  escalaInicio: usuario?.escalaInicio || "",
  jornada: paraHoras(usuario?.jornadaDiariaMinutos),
  salario: usuario?.salario != null ? String(usuario.salario).replace(".", ",") : "",
  valorDiaria: usuario?.valorDiaria != null ? String(usuario.valorDiaria).replace(".", ",") : "",
});

// Campos do formulário -> corpo da API
export const pontoParaApi = (ponto) => {
  const [h, m] = String(ponto.jornada || "08:00").split(":").map(Number);
  return {
    escala: ponto.escala,
    diasTrabalho: ponto.diasTrabalho,
    escalaInicio: ponto.escala === "12X36" ? ponto.escalaInicio : ponto.escalaInicio || null,
    jornadaDiariaMinutos: (h || 0) * 60 + (m || 0),
    salario: ponto.salario === "" ? null : ponto.salario,
    valorDiaria: ponto.valorDiaria === "" ? null : ponto.valorDiaria,
  };
};
