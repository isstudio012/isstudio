export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, prompt, image, refImage, width, height } = req.body;
  if (!apiKey || !image) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const basePrompt = prompt || 'Render this image photorealistically';

  const fullPrompt = refImage
    ? `Transform this interior image into a photorealistic architectural render.
STRICTLY PRESERVE:
- Exact camera angle and perspective
- All architectural elements: walls, ceiling, floor, windows, doors
- All furniture positions and shapes
APPLY EXACTLY AS SPECIFIED:
${basePrompt}
Use the reference image on the right side as a style and material guide for finishes, colors, and atmosphere.
ALWAYS:
- Photorealistic material rendering: accurate texture, reflectivity on all surfaces
- Professional architectural photography, ultra realistic 8K`
    : `Transform this interior image into a photorealistic architectural render.
STRICTLY PRESERVE:
- Exact camera angle and perspective
- All architectural elements: walls, ceiling, floor, windows, doors
- All furniture positions and shapes
APPLY EXACTLY AS SPECIFIED:
${basePrompt}
ALWAYS:
- Photorealistic material rendering: accurate texture, reflectivity on all surfaces
- Professional architectural photography, ultra realistic 8K`;

  try {
    let inputImage = image;

    // ref 이미지가 있으면 좌우로 합쳐서 단일 이미지로 보냄
    if (refImage) {
      inputImage = await stitchImages(image, refImage);
    }

    const modelUrl = 'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions';
    const inputBody = {
      prompt: fullPrompt,
      input_image: inputImage,
      output_format: 'jpg',
      output_quality: 95,
      aspect_ratio: getAspectRatio(width, height)
    };

    const response = await fetch(modelUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({ input: inputBody })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || JSON.stringify(data));
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// 두 이미지를 좌우로 합치기 (base64 → canvas → base64)
async function stitchImages(img1, img2) {
  const { createCanvas, loadImage } = await import('canvas').catch(() => null) || {};
  if (!createCanvas) {
    // canvas 모듈 없으면 그냥 img1만 사용
    return img1;
  }
  try {
    const [i1, i2] = await Promise.all([loadImage(img1), loadImage(img2)]);
    const h = Math.max(i1.height, i2.height);
    const w1 = Math.round(i1.width * h / i1.height);
    const w2 = Math.round(i2.width * h / i2.height);
    const cvs = createCanvas(w1 + w2, h);
    const ctx = cvs.getContext('2d');
    ctx.drawImage(i1, 0, 0, w1, h);
    ctx.drawImage(i2, w1, 0, w2, h);
    return cvs.toDataURL('image/jpeg', 0.9);
  } catch {
    return img1;
  }
}

function getAspectRatio(w, h) {
  if (!w || !h) return '16:9';
  const ratio = w / h;
  if (ratio > 1.7) return '16:9';
  if (ratio > 1.4) return '3:2';
  if (ratio > 1.1) return '4:3';
  if (ratio > 0.9) return '1:1';
  if (ratio > 0.7) return '3:4';
  return '9:16';
}
