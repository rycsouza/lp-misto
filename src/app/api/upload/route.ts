import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getAdminSession } from "@/app/actions/admin-auth";
import { rateLimit } from "@/lib/ratelimit";
import { getCurrentTenantSlug } from "@/lib/base-url";

/**
 * Pastas aceitas: as que o painel usa ("misto", "misto/loja/variantes"…) —
 * só letras minúsculas, números e hífen, até 3 níveis. O arquivo vai para a
 * pasta do CLUBE (prefixo com o slug do tenant), nunca para a de outro.
 */
const FOLDER_RE = /^[a-z0-9-]{1,40}(\/[a-z0-9-]{1,40}){0,2}$/;

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = await rateLimit(`rl:upload:${session.userId}`, 60, 600);
  if (!limit.ok) {
    return NextResponse.json({ error: "Muitos envios. Aguarde alguns minutos." }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const rawFolder = formData.get("folder");
  const folderInput = typeof rawFolder === "string" && rawFolder ? rawFolder : "misto";
  if (!FOLDER_RE.test(folderInput)) {
    return NextResponse.json({ error: "Pasta inválida." }, { status: 400 });
  }
  const tenant = (await getCurrentTenantSlug())?.replace(/[^a-z0-9-]/gi, "") || "sem-clube";
  const folder = `${tenant}/${folderInput}`;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato não permitido. Use JPEG, PNG, WebP ou GIF." }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Imagem deve ter no máximo 10MB." }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(dataUrl, {
      folder,
      resource_type: "image",
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return NextResponse.json({ error: "Erro ao enviar imagem." }, { status: 500 });
  }
}
