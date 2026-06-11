import { v2 as cloudinary } from "cloudinary";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, basename } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

cloudinary.config({
  cloud_name: "df798ispp",
  api_key: "838926254267482",
  api_secret: "K_-lPTDyfUDUUr7GNpG6fnMh9sQ",
});

// Map: local relative path → cloudinary public_id
const FILE_MAP = {
  "misto-logotipo.jpeg": "misto/misto-logotipo",
  "hero-player.jpg": "misto/hero-player",
  "eldorado-brasil.png": "misto/sponsors/eldorado-brasil",
  "nova-estrela-logo.avif": "misto/sponsors/nova-estrela-logo",
  "play55-logo.png": "misto/sponsors/play55-logo",
  "play55-logo.webp": "misto/sponsors/play55-logo-webp",
  "prefeitura-tres-lagoas.png": "misto/sponsors/prefeitura-tres-lagoas",
  "sicoob.png": "misto/sponsors/sicoob",
  "suzano.svg": "misto/sponsors/suzano",
  "tiete-materiais-logo.png": "misto/sponsors/tiete-materiais-logo",
  "unitres-objetivo-logo.png": "misto/sponsors/unitres-objetivo-logo",
  "sponsors/concreluz.png": "misto/sponsors/concreluz",
  "sponsors/daikin.png": "misto/sponsors/daikin",
  "sponsors/nova-estrela.png": "misto/sponsors/nova-estrela",
  "sponsors/sicredi.png": "misto/sponsors/sicredi",
  "sponsors/unopar.png": "misto/sponsors/unopar",
  "news/base-pretemporada.jpg": "misto/news/base-pretemporada",
  "news/charge-carcara.jpeg": "misto/news/charge-carcara",
  "news/misto-contrata-tecnico.jpg": "misto/news/misto-contrata-tecnico",
  "news/misto-corinthians-cidadeverde.jpg": "misto/news/misto-corinthians-cidadeverde",
  "news/misto-corinthians-copa-brasil.jpg": "misto/news/misto-corinthians-copa-brasil",
  "news/misto-corinthians-morenao.jpg": "misto/news/misto-corinthians-morenao",
  "news/misto-desiste-serie-b.jpg": "misto/news/misto-desiste-serie-b",
  "news/misto-eleicao-diretoria.jpg": "misto/news/misto-eleicao-diretoria",
  "news/misto-nova-diretoria-prefeitura.jpg": "misto/news/misto-nova-diretoria-prefeitura",
  "news/misto-representante-tl.jpeg": "misto/news/misto-representante-tl",
  "news/nova-diretoria.jpeg": "misto/news/nova-diretoria",
  "news/patrocinador-master.jpg": "misto/news/patrocinador-master",
  "news/patrocinadores-2026.jpg": "misto/news/patrocinadores-2026",
  "news/plano-gestao.jpg": "misto/news/plano-gestao",
  "news/pretemporada-elenco.jpg": "misto/news/pretemporada-elenco",
  "news/reforcos-estadual.jpg": "misto/news/reforcos-estadual",
  "news/sejuvel-madrugadao.jpg": "misto/news/sejuvel-madrugadao",
  "news/socio-torcedor.jpg": "misto/news/socio-torcedor",
  "news/tecnico-oliveira.webp": "misto/news/tecnico-oliveira",
  "board/adilson-popo.jpg": "misto/board/adilson-popo",
  "board/adriano-ferreira.jpg": "misto/board/adriano-ferreira",
  "board/alessandro.png": "misto/board/alessandro",
  "board/antonio-noia.png": "misto/board/antonio-noia",
  "board/donizetti.png": "misto/board/donizetti",
  "board/fabio-camargo.jpg": "misto/board/fabio-camargo",
  "board/jefferson.png": "misto/board/jefferson",
  "board/joaquim-pedro.png": "misto/board/joaquim-pedro",
  "board/joaquim-romero.png": "misto/board/joaquim-romero",
  "board/jose-roberto.jpg": "misto/board/jose-roberto",
  "board/kuesley-fernandes.png": "misto/board/kuesley-fernandes",
  "board/orlando-vicente.png": "misto/board/orlando-vicente",
  "board/pedro-bonfietti.png": "misto/board/pedro-bonfietti",
  "board/teixeira.png": "misto/board/teixeira",
  "legends/angelo.png": "misto/legends/angelo",
  "legends/arthur.jpg": "misto/legends/arthur",
  "legends/ary-arao.png": "misto/legends/ary-arao",
  "legends/bruno.png": "misto/legends/bruno",
  "legends/celio.jpg": "misto/legends/celio",
  "legends/cristiano.png": "misto/legends/cristiano",
  "legends/digue.jpg": "misto/legends/digue",
  "legends/dr-nivaldo.png": "misto/legends/dr-nivaldo",
  "legends/joel.png": "misto/legends/joel",
  "legends/julio-primavera.jpg": "misto/legends/julio-primavera",
  "legends/kayo.png": "misto/legends/kayo",
  "legends/legend-1.jpg": "misto/legends/legend-1",
  "legends/legend-2.jpg": "misto/legends/legend-2",
  "legends/legend-3.jpg": "misto/legends/legend-3",
  "legends/legend-4.jpg": "misto/legends/legend-4",
  "legends/legend-5.jpg": "misto/legends/legend-5",
  "legends/legend-6.jpg": "misto/legends/legend-6",
  "legends/maringa.jpg": "misto/legends/maringa",
  "legends/mi-santaluzia.jpg": "misto/legends/mi-santaluzia",
  "legends/olair.png": "misto/legends/olair",
  "players/atacante-1.jpg": "misto/players/atacante-1",
  "players/atacante-2.jpg": "misto/players/atacante-2",
  "players/atacante-3.jpg": "misto/players/atacante-3",
  "players/goleiro-1.jpg": "misto/players/goleiro-1",
  "players/goleiro-2.jpg": "misto/players/goleiro-2",
  "players/lateral-direito.jpg": "misto/players/lateral-direito",
  "players/lateral-esquerdo.jpg": "misto/players/lateral-esquerdo",
  "players/meia-1.jpg": "misto/players/meia-1",
  "players/meia-2.jpg": "misto/players/meia-2",
  "players/volante.jpg": "misto/players/volante",
  "players/zagueiro-1.jpg": "misto/players/zagueiro-1",
  "players/zagueiro-2.jpg": "misto/players/zagueiro-2",
  "teams/aquidauanense.png": "misto/teams/aquidauanense",
  "teams/campo-grande.png": "misto/teams/campo-grande",
  "teams/misto.png": "misto/teams/misto",
  "teams/sao-gabriel.png": "misto/teams/sao-gabriel",
  "shop/camiseta-torcedor-preta.png": "misto/shop/camiseta-torcedor-preta",
  "shop/camiseta-torcedor-branca.png": "misto/shop/camiseta-torcedor-branca",
  "shop/camiseta-torcedor-rosa.png": "misto/shop/camiseta-torcedor-rosa",
};

async function uploadFile(localRelPath, publicId) {
  const fullPath = join(PUBLIC_DIR, localRelPath.replace(/\//g, "\\"));
  try {
    const result = await cloudinary.uploader.upload(fullPath, {
      public_id: publicId,
      overwrite: true,
      resource_type: "image",
    });
    return { localRelPath, publicId, url: result.secure_url, ok: true };
  } catch (err) {
    return { localRelPath, publicId, error: err.message, ok: false };
  }
}

async function main() {
  const entries = Object.entries(FILE_MAP);
  const results = [];

  // Upload in batches of 5 to avoid rate limits
  const BATCH = 5;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(([localPath, publicId]) => uploadFile(localPath, publicId))
    );
    results.push(...batchResults);
    const done = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    console.error(`Progress: ${done} ok, ${failed} failed (${i + batch.length}/${entries.length})`);
  }

  const urlMap = {};
  for (const r of results) {
    if (r.ok) {
      urlMap[r.localRelPath] = r.url;
    } else {
      console.error(`FAILED: ${r.localRelPath} — ${r.error}`);
    }
  }

  console.log(JSON.stringify(urlMap, null, 2));
}

main().catch(console.error);
