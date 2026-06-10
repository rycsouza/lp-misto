import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import morenaoImg from "@/assets/news/misto-corinthians-morenao.jpg";
import mistoContrataTecnicoImg from "@/assets/news/tecnico-oliveira.webp";
import patrocinadores2026Img from "@/assets/news/patrocinadores-2026.jpg";
import chargeCarcaraImg from "@/assets/news/charge-carcara.jpeg";
import novaDiretoriaImg from "@/assets/news/nova-diretoria.jpeg";
import mistoRepresentanteImg from "@/assets/news/misto-representante-tl.jpeg";
import mistoDesisteImg from "@/assets/news/misto-desiste-serie-b.jpg";
import mistoEleicaoImg from "@/assets/news/misto-eleicao-diretoria.jpg";
import mistoApresentaDiretoriaImg from "@/assets/news/misto-nova-diretoria-prefeitura.jpg";
import mistoCorinthiansCVImg from "@/assets/news/misto-corinthians-cidadeverde.jpg";

const categories = ["Todos", "Futebol Profissional", "Base", "Institucional", "Sócio Torcedor", "Patrocinadores"];

const news = [
  // 2026
  {
    id: 16,
    category: "Futebol Profissional",
    title: "Misto contrata técnico José Oliveira para a Série B 2026",
    summary: "O Misto Esporte Clube anuncia a contratação do técnico José Oliveira para comandar a equipe na disputa do Campeonato Sul-Mato-Grossense Série B de 2026.",
    date: "2026",
    image: mistoContrataTecnicoImg,
    link: "https://www.campograndenews.com.br/esportes/misto-de-tres-lagoas-anuncia-contratacao-de-tecnico-para-serie-b-de-ms",
    source: "Campo Grande News",
  },
  {
    id: 17,
    category: "Patrocinadores",
    title: "Patrocinadores que acreditam no projeto do Misto em 2026",
    summary: "Sicredi, Supermercado Nova Estrela, Tiete III, Concreluz, Unopar e Daikin se unem ao Carcará e fortalecem o projeto de reestruturação do clube para a Série B 2026.",
    date: "2026",
    image: patrocinadores2026Img,
    link: "https://www.instagram.com/p/DYr0PF4BQ2y/",
    source: "Instagram @misto.esporteclube",
  },
  {
    id: 9,
    category: "Institucional",
    title: "Charge: Carcará de volta!",
    summary: "O chargista Gerson Henrique retrata a força e união para reerguer o Carcará. 'Força Joaquim! Vamos tirar o Carcará do buraco!'",
    date: "2026",
    image: chargeCarcaraImg,
    link: "https://hojemais.com.br/tres-lagoas/noticia/charge/charge-carcara-de-volta",
    source: "HojeMais Três Lagoas",
  },
  {
    id: 10,
    category: "Institucional",
    title: "Teixeira é novamente o novo presidente do Misto",
    summary: "Antônio Carlos Teixeira de Freitas assume novamente a presidência do Misto Esporte Clube, trazendo experiência e compromisso para reerguer o Carcará.",
    date: "2026",
    image: novaDiretoriaImg,
    link: "https://www.hojemais.com.br/tres-lagoas/noticia/esporte/teixeira-e-novamente-o-novo-presidente-do-misto",
    source: "HojeMais Três Lagoas",
  },
  // 2025
  {
    id: 13,
    category: "Institucional",
    title: "Misto elege nova diretoria na Quarta-feira de Cinzas",
    summary: "O Misto Esporte Clube realizou eleição e elegeu sua nova diretoria, reforçando o compromisso com a reestruturação do clube em Três Lagoas.",
    date: "2025",
    image: mistoEleicaoImg,
    link: "https://www.rcn67.com.br/tres-lagoas/jpnews/misto-elege-nova-diretoria-na-quarta-feira-de-cinzas/",
    source: "RCN67",
  },
  {
    id: 14,
    category: "Institucional",
    title: "Misto apresenta nova diretoria",
    summary: "O Misto Esporte Clube apresentou oficialmente sua nova diretoria em evento realizado na Câmara Municipal de Três Lagoas.",
    date: "2025",
    image: mistoApresentaDiretoriaImg,
    link: "https://www.treslagoas.ms.gov.br/misto-apresenta-nova-diretoria/",
    source: "Prefeitura de Três Lagoas",
  },
  // 2024
  {
    id: 12,
    category: "Futebol Profissional",
    title: "Misto desiste da disputa do Sul-Mato-Grossense Série B em 2024",
    summary: "O presidente do clube de Três Lagoas alegou falta de recursos financeiros para a desistência da competição estadual.",
    date: "30 Ago 2024",
    image: mistoDesisteImg,
    link: "https://www.campograndenews.com.br/esportes/misto-desiste-da-disputa-do-sul-mato-grossense-serie-b-em-2024",
    source: "Campo Grande News",
  },
  {
    id: 11,
    category: "Institucional",
    title: "Misto EC é escolhido para representar Três Lagoas no futebol profissional",
    summary: "O Misto Esporte Clube foi escolhido para representar a cidade de Três Lagoas no futebol profissional de Mato Grosso do Sul, reafirmando sua tradição e importância para o esporte local.",
    date: "2024",
    image: mistoRepresentanteImg,
    link: "https://www.hojemais.com.br/tres-lagoas/noticia/esporte/misto-ec-e-escolhido-para-representar-tres-lagoas-no-futebol-profissional",
    source: "HojeMais Três Lagoas",
  },
  // 2009
  {
    id: 15,
    category: "Futebol Profissional",
    title: "Corinthians bate Misto e elimina jogo de volta pela Copa do Brasil",
    summary: "Com placar elástico, o Corinthians eliminou o Misto ainda no jogo de ida da Copa do Brasil 2009, dispensando a partida de volta.",
    date: "15 Abr 2009",
    image: mistoCorinthiansCVImg,
    link: "https://cidadeverde.com/noticias/36123/corinthians-bate-misto-e-elimina-jogo-de-volta-pela-copa-do-brasil",
    source: "Cidade Verde",
  },
  {
    id: 7,
    category: "Futebol Profissional",
    title: "Jogo do Misto contra o Corinthians será no Morenão",
    summary: "A partida do Misto Esporte Clube contra o Corinthians pela Copa do Brasil será realizada no Estádio Morenão, em Campo Grande/MS.",
    date: "09 Mar 2009",
    image: morenaoImg,
    link: "https://www.treslagoas.ms.gov.br/jogo-do-misto-contra-o-corinthians-sera-no-morenao/",
    source: "Prefeitura de Três Lagoas",
  },
];

const NewsSection = () => {
  const [active, setActive] = useState("Todos");
  const featured = news[0];
  const rest = news.slice(1);
  const filtered = active === "Todos" ? rest : rest.filter((n) => n.category === active);

  return (
    <section id="noticias" className="py-20 sm:py-28">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
          <h2 className="font-display text-4xl sm:text-5xl tracking-wider text-foreground mb-4">NOTÍCIAS DO CLUBE</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Acompanhe as últimas novidades do Misto Esporte Clube.</p>
        </motion.div>

        {/* Featured news */}
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 bg-card border border-primary/40 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-0 hover:gold-glow-lg transition-all duration-300 group"
        >
          <div className="h-64 lg:h-auto bg-secondary overflow-hidden">
            <img src={featured.image} alt={featured.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          </div>
          <div className="p-6 sm:p-8 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground px-3 py-1 rounded-full">Destaque</span>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">{featured.category}</span>
              <span className="text-xs text-muted-foreground ml-auto">{featured.date}</span>
            </div>
            <h3 className="font-display text-2xl sm:text-3xl tracking-wide text-foreground mb-3">{featured.title}</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">{featured.summary}</p>
            {featured.source && (
              <p className="text-xs text-muted-foreground mb-4">Fonte: {featured.source}</p>
            )}
            {featured.link && (
              <a href={featured.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all w-fit">
                Leia Mais <ArrowRight size={14} />
              </a>
            )}
          </div>
        </motion.article>

        {/* Category filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                active === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* News grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item, i) => (
            <motion.article
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border rounded-2xl overflow-hidden group hover:border-primary hover:gold-glow-lg transition-all duration-300 hover:-translate-y-1"
            >
              <div className="h-48 bg-secondary overflow-hidden">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">{item.category}</span>
                  <span className="text-xs text-muted-foreground">{item.date}</span>
                </div>
                <h3 className="font-display text-xl tracking-wide text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{item.summary}</p>
                {item.source && (
                  <p className="text-xs text-muted-foreground mb-3">Fonte: {item.source}</p>
                )}
                {item.link ? (
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all">
                    Leia Mais <ArrowRight size={14} />
                  </a>
                ) : (
                  <button className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:gap-3 transition-all">
                    Leia Mais <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewsSection;
