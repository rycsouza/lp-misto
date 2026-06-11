import { neon } from "@neondatabase/serverless";

const sql = neon(
  "postgresql://neondb_owner:npg_7gUH9ZBTKkxz@ep-cold-dream-apzdk4pr.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
);

const CDN_HERO = "https://res.cloudinary.com/df798ispp/image/upload/misto/hero-player.jpg";

const result = await sql`
  UPDATE site_config SET value = ${CDN_HERO} WHERE key = 'hero.image_url'
`;
console.log("Updated hero.image_url →", CDN_HERO);
