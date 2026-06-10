import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import logo from "@/assets/misto-logotipo.jpeg";

const Footer = () => (
  <footer className="bg-card border-t border-border pt-16 pb-8">
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
        {/* Logo & about */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <img src={logo} alt="Misto Esporte Clube" className="h-12 w-12 rounded-full object-cover" />
            <span className="font-display text-lg tracking-wider text-foreground">MISTO EC</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Fundado em 14 de abril de 1993, o Misto Esporte Clube representa Três Lagoas/MS 
            com orgulho e paixão pelo futebol.
          </p>
        </div>

        {/* Links */}
        <div>
          <h4 className="font-display text-lg tracking-wider text-foreground mb-4">INSTITUCIONAL</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><a href="#historia" className="hover:text-primary transition-colors">História</a></li>
            <li><a href="#diretoria" className="hover:text-primary transition-colors">Diretoria</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Estatuto</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Transparência / Atas</a></li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-display text-lg tracking-wider text-foreground mb-4">CONTATO</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin size={16} className="flex-shrink-0 mt-0.5 text-primary" />
              <span>Três Lagoas, MS – Brasil</span>
            </li>
            <li className="flex items-start gap-2">
              <Phone size={16} className="flex-shrink-0 mt-0.5 text-primary" />
              <span>(67) 9999-9999</span>
            </li>
            <li className="flex items-start gap-2">
              <Mail size={16} className="flex-shrink-0 mt-0.5 text-primary" />
              <span>contato@mistoec.com.br</span>
            </li>
          </ul>
        </div>

        {/* Social */}
        <div>
          <h4 className="font-display text-lg tracking-wider text-foreground mb-4">REDES SOCIAIS</h4>
          <div className="flex gap-3">
            <a href="https://instagram.com/misto.esporteclube" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
              <Instagram size={18} />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-6 text-center">
        <p className="text-xs text-muted-foreground">
          CNPJ: 00.000.000/0001-00 · © {new Date().getFullYear()} Misto Esporte Clube. Todos os direitos reservados.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
