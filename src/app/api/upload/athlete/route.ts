import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";

/** Detecta o tipo real da imagem pelos magic bytes (JPEG/PNG/GIF/WebP). null = não é imagem suportada. */
function sniffImageType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  if (buf.length >= 6 && buf.toString("ascii", 0, 6).match(/^GIF8[79]a$/)) return "image/gif";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) return "image/webp";
  return null;
}

export async function POST(request: Request) {
  // Configure inside the handler to ensure env vars are resolved at request time
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato não permitido. Use JPEG, PNG, WebP ou GIF." }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Imagem deve ter no máximo 5MB." }, { status: 400 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validação por magic bytes: o file.type é só o MIME informado pelo client
    // (forjável). Como este endpoint é anônimo, confirmamos a assinatura real do
    // arquivo antes de subir ao Cloudinary.
    if (!sniffImageType(buffer)) {
      return NextResponse.json({ error: "Arquivo não é uma imagem válida." }, { status: 400 });
    }

    const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(dataUrl, {
      folder: "misto/atletas",
      resource_type: "image",
      transformation: [{ width: 600, height: 600, crop: "limit" }],
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error("Cloudinary athlete upload error:", err);
    return NextResponse.json({ error: "Erro ao enviar imagem." }, { status: 500 });
  }
}
