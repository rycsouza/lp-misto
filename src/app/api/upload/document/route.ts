import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getAdminSession } from "@/app/actions/admin-auth";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_BYTES = 15 * 1024 * 1024; // 15MB

/** Upload de documento (PDF) para prestação de contas. Admin-only. */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "prestacao-contas";

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }

  // Valida tipo declarado E assinatura (magic number %PDF-) — não confia só no MIME.
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const isPdfType = file.type === "application/pdf";
  const isPdfMagic = buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  if (!isPdfType || !isPdfMagic) {
    return NextResponse.json({ error: "Envie um arquivo PDF válido." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "O PDF deve ter no máximo 15MB." }, { status: 400 });
  }

  try {
    const dataUrl = `data:application/pdf;base64,${buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUrl, {
      folder,
      resource_type: "raw", // mantém o PDF original para download
      format: "pdf",
    });
    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error("Cloudinary document upload error:", err);
    return NextResponse.json({ error: "Erro ao enviar o documento." }, { status: 500 });
  }
}
