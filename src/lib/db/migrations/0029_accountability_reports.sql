-- Prestação de contas: documentos (PDF) exibidos abaixo da Diretoria.
CREATE TABLE IF NOT EXISTS accountability_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  file_url text NOT NULL,
  "order" integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
