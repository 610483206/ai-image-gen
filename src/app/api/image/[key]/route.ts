/**
 * 从 Cloudflare KV 读取并返回图片
 */

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ key: string }>; env: { IMAGES_BUCKET: KVNamespace } }
) {
  const { IMAGES_BUCKET } = context.env;
  const { key } = await context.params;

  if (!IMAGES_BUCKET) {
    return new Response("KV 未配置", { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const object = await (IMAGES_BUCKET as any).get(key, "arrayBuffer");

  if (!object) {
    return new Response("图片不存在或已过期", { status: 404 });
  }

  return new Response(object, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=600",
    },
  });
}
