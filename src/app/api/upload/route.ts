import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getAdminSession } from "@/app/actions/admin-auth";
import { rateLimit } from "@/lib/ratelimit";
import { getCurrentTenantSlug } from "@/lib/base-url";
import { sniffMemberPhotoType } from "@/lib/membership/member-photo";

/** Tipo real pelos primeiros bytes (JPEG/PNG/WebP do helper + GIF). Nunca confiar no file.type. */
function sniffImageType(bytes: Uint8Array): string | null {
  const known = sniffMemberPhotoType(bytes);
  if (known) return known;
  const head = String.fromCharCode(...bytes.slice(0, 6));
  return head === "GIF87a" || head === "GIF89a" ? "image/gif" : null;
}

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
  const tenant = (await getCurrentTenantSlug())?.replace(/[^a-z0-9-]/gi, "");
  if (!tenant) return NextResponse.json({ error: "Clube não identificado." }, { status: 400 });
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
    // O conteúdo precisa ser mesmo do tipo declarado (ex.: HTML/SVG renomeado é recusado).
    if (sniffImageType(new Uint8Array(bytes.slice(0, 16))) !== file.type) {
      return NextResponse.json({ error: "Arquivo não é uma imagem válida." }, { status: 400 });
    }
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
