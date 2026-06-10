import { motion } from "framer-motion";
import { User } from "lucide-react";
import kuesleyImg from "@/assets/board/kuesley-fernandes.png";
import pedroBonfiettiImg from "@/assets/board/pedro-bonfietti.png";
import teixeiraImg from "@/assets/board/teixeira.png";
import joaquimImg from "@/assets/board/joaquim-romero.png";
import orlandoImg from "@/assets/board/orlando-vicente.png";
import noiaImg from "@/assets/board/antonio-noia.png";
import jeffersonImg from "@/assets/board/jefferson.png";
import alessandroImg from "@/assets/board/alessandro.png";
import joaquimPedroImg from "@/assets/board/joaquim-pedro.png";
import donizettImg from "@/assets/board/donizetti.png";
import adilsonImg from "@/assets/board/adilson-popo.jpg";
import adrianoImg from "@/assets/board/adriano-ferreira.jpg";
import joseRobertoImg from "@/assets/board/jose-roberto.jpg";
import fabioCamargoImg from "@/assets/board/fabio-camargo.jpg";

const diretoriaExecutiva = [
  { name: "Antônio Carlos Teixeira de Freitas", role: "Presidente", profession: "Empresário — Tietê Mat Construção", photo: teixeiraImg },
  { name: "Joaquim Romero Barbosa", role: "Vice-Presidente", profession: "Empresário — Nova Estrela Supermercados", photo: joaquimImg },
  { name: "Joaquim Pedro Barbosa Sanches", role: "Tesoureiro", profession: "Empresário — Nova Estrela Supermercados", photo: joaquimPedroImg },
  { name: "Kuesley Fernandes do Nascimento", role: "Secretário", profession: "Empresário — Play55 Tecnologias", photo: kuesleyImg },
  { name: "Jefferson José Gonçalves", role: "Diretor das Categorias de Base", profession: "Empresário — Colégio Unitrês Objetivo", photo: jeffersonImg },
  { name: "Pedro Bonfietti", role: "Diretor Jurídico", profession: "Advogado", photo: pedroBonfiettiImg },
  { name: "Adilson Popó", role: "Diretor de Esportes", profession: "Empresário — Escolinha de Futebol", photo: adilsonImg },
];

const conselhoFiscal = [
  { name: "Orlando Vicente Abate Sacchi", role: "Titular", profession: "Delegado de Polícia Aposentado", photo: orlandoImg },
  { name: "Antonio Carlos Noia", role: "Titular", profession: "Funcionário Público Aposentado", photo: noiaImg },
  { name: "Alessandro Rodrigues dos Santos", role: "Titular", profession: "Empresário", photo: alessandroImg },
  { name: "Adriano Ferreira de Souza", role: "Suplente", profession: "Vendedor", photo: adrianoImg },
  { name: "Donizetti da Silva Lopes", role: "Suplente", profession: "Funcionário Público Aposentado", photo: donizettImg },
  { name: "José Roberto Rodrigues", role: "Suplente", profession: "Aposentado", photo: joseRobertoImg },
  { name: "Fábio de Camargo", role: "Suplente", profession: "Empresário — Brasil Grill", photo: fabioCamargoImg },
];

const BoardSection = () => (
  <section id="diretoria" className="py-20 sm:py-28">
    <div className="container mx-auto px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
        <h2 className="font-display text-4xl sm:text-5xl tracking-wider text-foreground mb-4">DIRETORIA</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">Gestão transparente e comprometida com o futuro do Misto.</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
        {diretoriaExecutiva.map((member, i) => (
          <motion.div
            key={member.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="bg-card border border-border rounded-2xl p-6 text-center hover:border-primary hover:gold-glow-lg transition-all duration-300"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
              {member.photo ? (
                <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <User size={32} className="text-muted-foreground" />
              )}
            </div>
            <h3 className="font-display text-xl tracking-wide text-foreground">{member.name}</h3>
            <p className="text-sm font-semibold text-primary mb-1">{member.role}</p>
            <p className="text-sm text-muted-foreground">{member.profession}</p>
          </motion.div>
        ))}
      </div>

      {/* Conselho Fiscal */}
      <div className="max-w-4xl mx-auto">
        <h3 className="font-display text-2xl sm:text-3xl tracking-wider text-foreground text-center mb-8">CONSELHO FISCAL</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {conselhoFiscal.map((p) => (
            <div key={p.name} className="bg-card border border-border rounded-xl p-4 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                {p.photo ? (
                  <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={20} className="text-muted-foreground" />
                )}
              </div>
              <p className="text-sm font-semibold text-foreground">{p.name}</p>
              <p className="text-xs font-medium text-primary">{p.role}</p>
              <p className="text-xs text-muted-foreground">{p.profession}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default BoardSection;
