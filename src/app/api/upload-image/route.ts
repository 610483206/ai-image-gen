/**
 * 上传图片到 Cloudflare KV
 * 返回可通过 /api/image/[key] 访问的公网 URL
 */

export async function POST(request: Request, context: { env: { IMAGES_BUCKET: KVNamespace } }) {
  const { IMAGES_BUCKET } = context.env;

  if (!IMAGES_BUCKET) {
    return Response.json({ success: false, error: "KV 未配置" }, { status: 500 });
  }

  const body = await request.json();
  const { imageData } = body;

  if (!imageData) {
    return Response.json({ success: false, error: "缺少 imageData 参数" }, { status: 400 });
  }

  const key = `img/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const base64 = imageData.includes(",") ? imageData.split(",")[1] : imageData;
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (IMAGES_BUCKET as any).put(key, arrayBuffer, { expirationTtl: 600 });

  const url = new URL(request.url);
  const imageUrl = `${url.origin}/api/image/${key}`;

  return Response.json({ success: true, url: imageUrl, key });
}
