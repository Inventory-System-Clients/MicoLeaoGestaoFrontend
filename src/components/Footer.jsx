import selfMachineLogo from "../assets/SelfMachine - Logo.jpg";

export function Footer() {
  return (
    <footer className="bg-gradient-to-r from-black via-neutral-900 to-red-950 text-white mt-12 border-t-4 border-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Branding */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-white p-1 rounded-lg">
                <img
                  src="/LogoMicoLeao.png"
                  alt="Mico Leao"
                  className="h-8 w-8 object-contain"
                />
              </div>
              <span className="text-xl font-bold text-gradient bg-gradient-to-r from-primary via-accent-yellow to-primary bg-clip-text">
                Mico Leao
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              Sistema completo de gestão de estoque para máquinas de pelúcias.
              Controle eficiente e moderno para seu negócio.
            </p>
          </div>

          {/* Links Rápidos */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-accent-cream">
              Links Rápidos
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/"
                  className="text-gray-400 hover:text-primary transition-colors flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  Dashboard
                </a>
              </li>
              <li>
                <a
                  href="/movimentacoes"
                  className="text-gray-400 hover:text-primary transition-colors flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  Histórico de Movimentações
                </a>
              </li>
              <li>
                <a
                  href="/maquinas"
                  className="text-gray-400 hover:text-primary transition-colors flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  Máquinas
                </a>
              </li>
            </ul>
          </div>

          {/* Informações */}
          <div>
            <h3 className="text-lg font-bold mb-4 text-accent-cream">
              Informações
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2 text-gray-400">
                <svg
                  className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                <span>suporte@selfmachine.com.br</span>
              </div>
              <div className="flex items-start gap-2 text-gray-400">
                <svg
                  className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                <span>(11) 97117-9038</span>
              </div>
              <div className="flex items-start gap-2 text-gray-400">
                <svg
                  className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Suporte: Seg-Sex 9h-18h</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              © 2026 Mico Leao. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Versão 1.0.0</span>
              <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
              <span className="flex items-center gap-2">
                Desenvolvido por
                <img
                  src={selfMachineLogo}
                  alt="SelfMachine"
                  className="h-8 w-auto rounded bg-white/90 px-2 py-1"
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
