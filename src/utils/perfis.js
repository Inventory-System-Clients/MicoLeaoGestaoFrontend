// Fonte única dos perfis de usuário na tela: nome, nome curto, cor do selo e
// descrição. O valor (FUNCIONARIO_ESTOQUE etc.) é o que fica gravado; aqui só
// muda como aparece.
export const PERFIS = [
  {
    valor: "FUNCIONARIO",
    nome: "Funcionário",
    curto: "Funcionário",
    cor: "bg-blue-100 text-blue-800",
    descricao: "Funcionários têm acesso limitado às lojas autorizadas",
  },
  {
    valor: "FUNCIONARIO_ESTOQUE",
    nome: "Chefe de Expedição",
    curto: "Chefe Exped.",
    cor: "bg-orange-100 text-orange-800",
    descricao:
      "Além do acesso de funcionário, também vê estoque, monta envios/carrinhos, vê a lista de compras, cuida da Fabricação de Pelúcia (insumos, receitas, pedidos) e acessa todas as lojas — sem acesso a financeiro ou edição de usuários/lojas",
  },
  {
    valor: "FUNCIONARIO_CADASTRO",
    nome: "Funcionário de Cadastro",
    curto: "Func. Cadastro",
    cor: "bg-teal-100 text-teal-800",
    descricao:
      "Acesso quase total ao sistema (lojas, máquinas, produtos, estoque, roteiros, manutenção etc) — sem acesso a financeiro, gráficos, relatórios ou gestão de usuários",
  },
  {
    valor: "CONSULTOR_VENDAS",
    restrito: true,
    nome: "Consultor de Vendas",
    curto: "Consultor",
    cor: "bg-pink-100 text-pink-800",
    descricao:
      "Começa sem acesso: libere o que a pessoa precisa em Acessos, logo abaixo.",
  },
  {
    valor: "MOTORISTA",
    restrito: true,
    nome: "Motorista",
    curto: "Motorista",
    cor: "bg-yellow-100 text-yellow-800",
    descricao:
      "Começa sem acesso: libere o que a pessoa precisa em Acessos, logo abaixo.",
  },
  {
    valor: "ABASTECEDOR",
    restrito: true,
    nome: "Abastecedor",
    curto: "Abastecedor",
    cor: "bg-green-100 text-green-800",
    descricao:
      "Começa sem acesso: libere o que a pessoa precisa em Acessos, logo abaixo.",
  },
  {
    valor: "FINANCEIRO",
    restrito: true,
    nome: "Financeiro",
    curto: "Financeiro",
    cor: "bg-emerald-100 text-emerald-800",
    descricao:
      "Começa com Metas por Loja (lança o dinheiro que entrou e cadastra metas e comissões). Outros acessos: libere em Acessos, logo abaixo.",
  },
  {
    valor: "ADMIN",
    nome: "Administrador",
    curto: "Admin",
    cor: "bg-primary/20 text-primary",
    descricao: "Administradores têm acesso total ao sistema",
  },
  {
    valor: "DESENVOLVEDOR",
    nome: "Desenvolvedor",
    curto: "Dev",
    cor: "bg-purple-100 text-purple-800",
    descricao:
      "Desenvolvedores têm acesso de admin e controle do desenvolvimento",
  },
];

export const obterPerfil = (valor) =>
  PERFIS.find((perfil) => perfil.valor === valor) || PERFIS[0];

// Acesso às telas. O backend manda em `usuario.acessos` (login e /auth/perfil)
// o que os ajustes do usuário mudaram: telasLiberadas e telasBloqueadas.
// Sem ajuste, vale a regra de perfil de sempre (roles/adminOnly da rota ou do
// item de menu), passada aqui como `regraDoPerfil`. Perfis restritos
// (Consultor, Motorista, Abastecedor) só veem o que foi liberado.
const casaTela = (padrao, caminho) =>
  new RegExp(
    `^${padrao
      .split("/")
      .map((parte) => (parte.startsWith(":") ? "[^/]+" : parte))
      .join("/")}$`,
  ).test(caminho);

const algumaTelaCasa = (lista, caminho) =>
  (lista || []).some((padrao) => casaTela(padrao, caminho));

export const ehAcessoRestrito = (usuario) =>
  usuario?.acessos
    ? Boolean(usuario.acessos.restrito)
    : Boolean(obterPerfil(usuario?.role).restrito);

export const acessoATela = (usuario, caminho, regraDoPerfil) => {
  const acessos = usuario?.acessos;
  if (acessos?.total) return regraDoPerfil;
  if (algumaTelaCasa(acessos?.telasBloqueadas, caminho)) return false;
  if (algumaTelaCasa(acessos?.telasLiberadas, caminho)) return true;
  if (ehAcessoRestrito(usuario)) return false;
  return regraDoPerfil;
};

// Botões e partes de tela ligados a uma ação do catálogo de acessos
// (backend/src/permissoes/catalogo.js). Mesma lógica das telas:
// Admin/Desenvolvedor podem tudo; ação tirada do usuário esconde; ação dada a
// mais mostra; perfis restritos só veem o que está liberado; sem ajuste vale
// `regraDoPerfil` (a regra de perfil que a tela já usava).
export const pode = (usuario, chave, regraDoPerfil = false) => {
  const acessos = usuario?.acessos;
  if (acessos?.total) return true;
  if (acessos?.removidas?.includes(chave)) return false;
  if (acessos?.adicionadas?.includes(chave)) return true;
  if (ehAcessoRestrito(usuario)) return Boolean(acessos?.liberadas?.includes(chave));
  return regraDoPerfil;
};
