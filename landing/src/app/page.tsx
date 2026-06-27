const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const features = [
  {
    title: "Métricas Raiz",
    desc: "Defina o que importa medir e a unidade certa. Tudo começa por aqui.",
    color: "orange",
  },
  {
    title: "Metas com Alvo",
    desc: "Associe uma métrica a um período e estabeleça o número que você vai bater.",
    color: "purple",
  },
  {
    title: "Check-in Diário",
    desc: "Lance seus resultados todo dia e veja a evolução acontecer em tempo real.",
    color: "green",
  },
];

const colorMap: Record<string, string> = {
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  purple: "bg-purple-500/20 text-purple-400 border-purple-500/40",
  green: "bg-green-500/20 text-green-400 border-green-500/40",
};

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen items-center p-6 sm:p-24 relative overflow-hidden bg-[#0a0a0a] text-white">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[0%] left-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[150px]" />
        <div className="absolute bottom-[0%] right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[150px]" />
      </div>

      <main className="relative z-10 w-full max-w-6xl flex flex-col items-center text-center mt-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 text-sm font-medium text-blue-300 rounded-full glass animate-fade-in-up">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          the_monitor — Alta Performance
        </div>

        <h1 className="max-w-4xl text-5xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Transforme Disciplina em <span className="text-gradient">Resultado</span>
        </h1>

        <p className="max-w-2xl text-lg sm:text-xl text-zinc-400 mb-10 leading-relaxed">
          O painel definitivo para medir suas métricas, criar desafios e registrar
          cada vitória. Pare de torcer pelo progresso — meça-o.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-20">
          <a
            href={`${APP_URL}/login`}
            className="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-all duration-300 hover:-translate-y-1 shadow-lg shadow-blue-600/30"
          >
            Começar agora
          </a>
          <a
            href={`${APP_URL}/dashboard`}
            className="px-8 py-4 rounded-2xl glass border border-white/10 text-zinc-200 font-semibold text-lg hover:bg-white/[0.05] transition-all duration-300"
          >
            Ver o Dashboard
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl text-left">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex flex-col p-8 glass rounded-3xl border border-white/5"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border ${colorMap[f.color]}`}
              >
                <span className="text-xl font-bold">★</span>
              </div>
              <h2 className="text-2xl font-bold mb-2 text-white">{f.title}</h2>
              <p className="text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 w-full max-w-3xl glass rounded-3xl border border-white/10 p-10 flex flex-col items-center">
          <h3 className="text-3xl font-bold mb-3">Pronto para a Alta Performance?</h3>
          <p className="text-zinc-400 mb-8 max-w-xl">
            Crie sua conta e comece a medir o que realmente move seus objetivos.
          </p>
          <a
            href={`${APP_URL}/login`}
            className="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg transition-all duration-300 hover:-translate-y-1 shadow-lg shadow-blue-600/30"
          >
            Começar agora
          </a>
        </div>
      </main>

      <footer className="mt-20 mb-8 text-sm text-zinc-500 whitespace-nowrap z-10 text-center">
        Desenvolvido para <span className="text-zinc-300">Alta Performance</span>.
      </footer>
    </div>
  );
}
