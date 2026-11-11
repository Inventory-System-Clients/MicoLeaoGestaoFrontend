import { Link } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { PageHeader } from "../components/UIComponents";
import { useAuth } from "../contexts/AuthContext";
import { obterPerfil } from "../utils/perfis";
import { MinhasMetas } from "../components/MinhasMetas";

// Início de quem não tem o Dashboard (perfis restritos ou acesso tirado):
// mostra só as telas liberadas por ajuste de acesso.
export function InicioPerfilRestrito() {
  const { usuario } = useAuth();
  const telas = usuario?.acessos?.menuLiberado || [];

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title={`Olá, ${usuario?.nome || ""}`}
          subtitle={`Perfil: ${obterPerfil(usuario?.role).nome}`}
          icon="👋"
        />

        <MinhasMetas className="mb-6" />

        <div className="card space-y-3">
          {telas.length === 0 ? (
            <>
              <h3 className="text-lg font-bold text-gray-900">
                Seu acesso ainda está sendo configurado
              </h3>
              <p className="text-sm text-gray-600">
                Por enquanto seu perfil não tem nenhuma área liberada. Fale com
                o administrador para liberar o que você precisa usar.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-gray-900">
                O que você pode acessar
              </h3>
              <ul className="space-y-2">
                {telas.map((item) => (
                  <li key={item.tela}>
                    <Link
                      to={item.tela}
                      className="font-semibold text-blue-600 hover:text-blue-800"
                    >
                      {item.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default InicioPerfilRestrito;
