import saoGabrielCrest from "@/assets/teams/sao-gabriel.png";
import campoGrandeCrest from "@/assets/teams/campo-grande.png";

// Brasões oficiais referenciados direto do CDN da CBF
export const MISTO_CREST = "https://conteudo.cbf.com.br/clubes/21816/escudo.jpg";
const aquidauanenseCrest = "https://conteudo.cbf.com.br/clubes/21944/escudo.jpg";

export type HomeGame = {
  id: string;
  round: string;
  date: string; // ISO
  dateLabel: string;
  weekdayLabel: string;
  timeLabel: string;
  opponent: string;
  opponentCrest: string;
  venue: string;
};

export const HOME_GAMES: HomeGame[] = [
  {
    id: "r2-aquidauanense",
    round: "2ª rodada",
    date: "2026-06-27T15:00:00-04:00",
    dateLabel: "27/06/2026",
    weekdayLabel: "Sábado",
    timeLabel: "15:00",
    opponent: "Aquidauanense FC",
    opponentCrest: aquidauanenseCrest,
    venue: "Estádio Madrugadão — Três Lagoas/MS",
  },
  {
    id: "r4-saogabriel",
    round: "4ª rodada",
    date: "2026-07-11T15:00:00-04:00",
    dateLabel: "11/07/2026",
    weekdayLabel: "Sábado",
    timeLabel: "15:00",
    opponent: "São Gabriel EC",
    opponentCrest: saoGabrielCrest,
    venue: "Estádio Madrugadão — Três Lagoas/MS",
  },
  {
    id: "r6-campogrande",
    round: "6ª rodada",
    date: "2026-07-25T15:00:00-04:00",
    dateLabel: "25/07/2026",
    weekdayLabel: "Sábado",
    timeLabel: "15:00",
    opponent: "EC Campo Grande",
    opponentCrest: campoGrandeCrest,
    venue: "Estádio Madrugadão — Três Lagoas/MS",
  },
];

export const TICKET_PRICES = {
  full: 25,
  half: 12.5,
};

export type RaffleTier = {
  numbers: 0 | 1 | 2 | 3;
  price: number;
  label: string;
};

export const RAFFLE_TIERS: RaffleTier[] = [
  { numbers: 0, price: 0, label: "Não quero participar" },
  { numbers: 1, price: 10, label: "1 número da sorte" },
  { numbers: 2, price: 20, label: "2 números da sorte" },
  { numbers: 3, price: 25, label: "3 números da sorte" },
];

export const WHATSAPP_NUMBER = "5567991360075";

// Chave PIX do clube (atualize com a chave oficial — placeholder = telefone do clube)
export const PIX_KEY = "mistoesporteclubetreslagoas@gmail.com";
export const PIX_RECIPIENT = "Misto Esporte Clube";
export const PIX_CITY = "Três Lagoas";
