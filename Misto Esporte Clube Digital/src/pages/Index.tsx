import Header from "@/components/Header";
import TicketHighlight from "@/components/TicketHighlight";
import HeroSection from "@/components/HeroSection";
import NewsSection from "@/components/NewsSection";
import SquadSection from "@/components/SquadSection";
import BoardSection from "@/components/BoardSection";
import HistorySection from "@/components/HistorySection";
import MembershipSection from "@/components/MembershipSection";
import SponsorsSection from "@/components/SponsorsSection";
import ShopSection from "@/components/ShopSection";

import Footer from "@/components/Footer";

const Index = () => {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <TicketHighlight />
        <ShopSection />

        <NewsSection />
        <SquadSection />
        <BoardSection />
        <HistorySection />
        <MembershipSection />
        <SponsorsSection />
        <div className="py-12 text-center">
          <a
            href="https://instagram.com/misto.esporteclube"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-lg hover:bg-primary/80 transition-all"
          >
            Siga-nos no Instagram
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
};

export default Index;
