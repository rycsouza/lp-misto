import { neon } from "@neondatabase/serverless";

const sql = neon(
  "postgresql://neondb_owner:npg_7gUH9ZBTKkxz@ep-cold-dream-apzdk4pr.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
);

const BASE = "https://res.cloudinary.com/df798ispp/image/upload";

// Map: local path suffix → cloudinary public_id (no version, no extension)
// The Cloudinary URL: {BASE}/{public_id}.{ext}
// Extension is preserved from upload result
const PATH_TO_CDN = {
  "/news/base-pretemporada.jpg": `${BASE}/misto/news/base-pretemporada.jpg`,
  "/news/charge-carcara.jpeg": `${BASE}/misto/news/charge-carcara.jpg`,
  "/news/misto-contrata-tecnico.jpg": `${BASE}/misto/news/misto-contrata-tecnico.jpg`,
  "/news/misto-corinthians-cidadeverde.jpg": `${BASE}/misto/news/misto-corinthians-cidadeverde.jpg`,
  "/news/misto-corinthians-copa-brasil.jpg": `${BASE}/misto/news/misto-corinthians-copa-brasil.jpg`,
  "/news/misto-corinthians-morenao.jpg": `${BASE}/misto/news/misto-corinthians-morenao.jpg`,
  "/news/misto-desiste-serie-b.jpg": `${BASE}/misto/news/misto-desiste-serie-b.jpg`,
  "/news/misto-eleicao-diretoria.jpg": `${BASE}/misto/news/misto-eleicao-diretoria.png`,
  "/news/misto-nova-diretoria-prefeitura.jpg": `${BASE}/misto/news/misto-nova-diretoria-prefeitura.jpg`,
  "/news/misto-representante-tl.jpeg": `${BASE}/misto/news/misto-representante-tl.jpg`,
  "/news/nova-diretoria.jpeg": `${BASE}/misto/news/nova-diretoria.jpg`,
  "/news/patrocinador-master.jpg": `${BASE}/misto/news/patrocinador-master.jpg`,
  "/news/patrocinadores-2026.jpg": `${BASE}/misto/news/patrocinadores-2026.jpg`,
  "/news/plano-gestao.jpg": `${BASE}/misto/news/plano-gestao.jpg`,
  "/news/pretemporada-elenco.jpg": `${BASE}/misto/news/pretemporada-elenco.jpg`,
  "/news/reforcos-estadual.jpg": `${BASE}/misto/news/reforcos-estadual.jpg`,
  "/news/sejuvel-madrugadao.jpg": `${BASE}/misto/news/sejuvel-madrugadao.jpg`,
  "/news/socio-torcedor.jpg": `${BASE}/misto/news/socio-torcedor.jpg`,
  "/news/tecnico-oliveira.webp": `${BASE}/misto/news/tecnico-oliveira.webp`,
  "/board/adilson-popo.jpg": `${BASE}/misto/board/adilson-popo.jpg`,
  "/board/adriano-ferreira.jpg": `${BASE}/misto/board/adriano-ferreira.jpg`,
  "/board/alessandro.png": `${BASE}/misto/board/alessandro.png`,
  "/board/antonio-noia.png": `${BASE}/misto/board/antonio-noia.png`,
  "/board/donizetti.png": `${BASE}/misto/board/donizetti.png`,
  "/board/fabio-camargo.jpg": `${BASE}/misto/board/fabio-camargo.jpg`,
  "/board/jefferson.png": `${BASE}/misto/board/jefferson.png`,
  "/board/joaquim-pedro.png": `${BASE}/misto/board/joaquim-pedro.png`,
  "/board/joaquim-romero.png": `${BASE}/misto/board/joaquim-romero.png`,
  "/board/jose-roberto.jpg": `${BASE}/misto/board/jose-roberto.jpg`,
  "/board/kuesley-fernandes.png": `${BASE}/misto/board/kuesley-fernandes.png`,
  "/board/orlando-vicente.png": `${BASE}/misto/board/orlando-vicente.png`,
  "/board/pedro-bonfietti.png": `${BASE}/misto/board/pedro-bonfietti.png`,
  "/board/teixeira.png": `${BASE}/misto/board/teixeira.png`,
  "/legends/angelo.png": `${BASE}/misto/legends/angelo.png`,
  "/legends/arthur.jpg": `${BASE}/misto/legends/arthur.jpg`,
  "/legends/ary-arao.png": `${BASE}/misto/legends/ary-arao.png`,
  "/legends/bruno.png": `${BASE}/misto/legends/bruno.png`,
  "/legends/celio.jpg": `${BASE}/misto/legends/celio.jpg`,
  "/legends/cristiano.png": `${BASE}/misto/legends/cristiano.png`,
  "/legends/digue.jpg": `${BASE}/misto/legends/digue.jpg`,
  "/legends/dr-nivaldo.png": `${BASE}/misto/legends/dr-nivaldo.png`,
  "/legends/joel.png": `${BASE}/misto/legends/joel.png`,
  "/legends/julio-primavera.jpg": `${BASE}/misto/legends/julio-primavera.jpg`,
  "/legends/kayo.png": `${BASE}/misto/legends/kayo.png`,
  "/legends/legend-1.jpg": `${BASE}/misto/legends/legend-1.jpg`,
  "/legends/legend-2.jpg": `${BASE}/misto/legends/legend-2.jpg`,
  "/legends/legend-3.jpg": `${BASE}/misto/legends/legend-3.jpg`,
  "/legends/legend-4.jpg": `${BASE}/misto/legends/legend-4.jpg`,
  "/legends/legend-5.jpg": `${BASE}/misto/legends/legend-5.jpg`,
  "/legends/legend-6.jpg": `${BASE}/misto/legends/legend-6.jpg`,
  "/legends/maringa.jpg": `${BASE}/misto/legends/maringa.jpg`,
  "/legends/mi-santaluzia.jpg": `${BASE}/misto/legends/mi-santaluzia.jpg`,
  "/legends/olair.png": `${BASE}/misto/legends/olair.png`,
  "/players/atacante-1.jpg": `${BASE}/misto/players/atacante-1.jpg`,
  "/players/atacante-2.jpg": `${BASE}/misto/players/atacante-2.jpg`,
  "/players/atacante-3.jpg": `${BASE}/misto/players/atacante-3.jpg`,
  "/players/goleiro-1.jpg": `${BASE}/misto/players/goleiro-1.jpg`,
  "/players/goleiro-2.jpg": `${BASE}/misto/players/goleiro-2.jpg`,
  "/players/lateral-direito.jpg": `${BASE}/misto/players/lateral-direito.jpg`,
  "/players/lateral-esquerdo.jpg": `${BASE}/misto/players/lateral-esquerdo.jpg`,
  "/players/meia-1.jpg": `${BASE}/misto/players/meia-1.jpg`,
  "/players/meia-2.jpg": `${BASE}/misto/players/meia-2.jpg`,
  "/players/volante.jpg": `${BASE}/misto/players/volante.jpg`,
  "/players/zagueiro-1.jpg": `${BASE}/misto/players/zagueiro-1.jpg`,
  "/players/zagueiro-2.jpg": `${BASE}/misto/players/zagueiro-2.jpg`,
  "/teams/aquidauanense.png": `${BASE}/misto/teams/aquidauanense.png`,
  "/teams/campo-grande.png": `${BASE}/misto/teams/campo-grande.png`,
  "/teams/misto.png": `${BASE}/misto/teams/misto.png`,
  "/teams/sao-gabriel.png": `${BASE}/misto/teams/sao-gabriel.png`,
  "/shop/camiseta-torcedor-preta.png": `${BASE}/misto/shop/camiseta-torcedor-preta.png`,
  "/shop/camiseta-torcedor-branca.png": `${BASE}/misto/shop/camiseta-torcedor-branca.png`,
  "/shop/camiseta-torcedor-rosa.png": `${BASE}/misto/shop/camiseta-torcedor-rosa.png`,
  // Root sponsor logos referenced in DB
  "/eldorado-brasil.png": `${BASE}/misto/sponsors/eldorado-brasil.png`,
  "/nova-estrela-logo.avif": `${BASE}/misto/sponsors/nova-estrela-logo.avif`,
  "/play55-logo.png": `${BASE}/misto/sponsors/play55-logo.png`,
  "/play55-logo.webp": `${BASE}/misto/sponsors/play55-logo-webp.webp`,
  "/prefeitura-tres-lagoas.png": `${BASE}/misto/sponsors/prefeitura-tres-lagoas.png`,
  "/sicoob.png": `${BASE}/misto/sponsors/sicoob.png`,
  "/suzano.svg": `${BASE}/misto/sponsors/suzano.svg`,
  "/tiete-materiais-logo.png": `${BASE}/misto/sponsors/tiete-materiais-logo.png`,
  "/unitres-objetivo-logo.png": `${BASE}/misto/sponsors/unitres-objetivo-logo.png`,
  "/sponsors/concreluz.png": `${BASE}/misto/sponsors/concreluz.png`,
  "/sponsors/daikin.png": `${BASE}/misto/sponsors/daikin.png`,
  "/sponsors/nova-estrela.png": `${BASE}/misto/sponsors/nova-estrela.png`,
  "/sponsors/sicredi.png": `${BASE}/misto/sponsors/sicredi.png`,
  "/sponsors/unopar.png": `${BASE}/misto/sponsors/unopar.png`,
};

async function main() {
  // First, let's see what image URLs look like in each table
  const newsRows = await sql`SELECT id, image_url FROM news WHERE image_url IS NOT NULL`;
  const boardRows = await sql`SELECT id, photo_url FROM board_members WHERE photo_url IS NOT NULL`;
  const legendRows = await sql`SELECT id, photo_url FROM legends WHERE photo_url IS NOT NULL`;
  const playerRows = await sql`SELECT id, photo_url FROM players WHERE photo_url IS NOT NULL`;
  const personalityRows = await sql`SELECT id, photo_url FROM personalities WHERE photo_url IS NOT NULL`;
  const sponsorRows = await sql`SELECT id, logo_url FROM sponsors WHERE logo_url IS NOT NULL`;
  const gameRows = await sql`SELECT id, opponent_crest_url FROM games WHERE opponent_crest_url IS NOT NULL`;
  const productRows = await sql`SELECT id, image_url FROM products WHERE image_url IS NOT NULL`;
  const variantRows = await sql`SELECT id, color_image_url FROM product_variants WHERE color_image_url IS NOT NULL`;

  let totalUpdated = 0;
  let notFound = [];

  async function updateTable(rows, table, col, idCol = "id") {
    for (const row of rows) {
      const oldUrl = row[col];
      const newUrl = PATH_TO_CDN[oldUrl];
      if (newUrl) {
        await sql.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [newUrl, row[idCol]]);
        console.log(`✓ ${table}.${col}: ${oldUrl} → ${newUrl}`);
        totalUpdated++;
      } else if (oldUrl && !oldUrl.startsWith("http")) {
        notFound.push(`${table}.${col}: "${oldUrl}"`);
      }
      // Already a full URL (http/https) — skip
    }
  }

  await updateTable(newsRows, "news", "image_url");
  await updateTable(boardRows, "board_members", "photo_url");
  await updateTable(legendRows, "legends", "photo_url");
  await updateTable(playerRows, "players", "photo_url");
  await updateTable(personalityRows, "personalities", "photo_url");
  await updateTable(sponsorRows, "sponsors", "logo_url");
  await updateTable(gameRows, "games", "opponent_crest_url");
  await updateTable(productRows, "products", "image_url");
  await updateTable(variantRows, "product_variants", "color_image_url");

  console.log(`\n✅ Total updated: ${totalUpdated}`);
  if (notFound.length) {
    console.log(`\n⚠ Not mapped (check manually):`);
    notFound.forEach(x => console.log("  " + x));
  }
}

main().catch(console.error);
