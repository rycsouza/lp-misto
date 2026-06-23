const NEON_BASE = "https://console.neon.tech/api/v2";

export interface NeonProjectResult {
  projectId: string;
  connectionUri: string;
}

export async function createNeonProject(name: string): Promise<NeonProjectResult> {
  const apiKey = process.env.NEON_API_KEY;
  if (!apiKey) throw new Error("NEON_API_KEY is not set");

  const res = await fetch(`${NEON_BASE}/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      project: {
        name,
        region_id: "aws-sa-east-1",
      },
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Neon API ${res.status}: ${text}`);
  }

  const data = await res.json();
  const connectionUri = data.connection_uris?.[0]?.connection_uri;
  if (!connectionUri) throw new Error("Neon API: no connection_uri in response");

  return { projectId: data.project.id, connectionUri };
}
