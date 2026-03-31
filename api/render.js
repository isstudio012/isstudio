export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, prompt, image, refImage, width, height } = req.body;
  if (!apiKey || !prompt || !image) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const basePrompt = `Transform this 3D interior sketch into a photorealistic architectural render.

STRICTLY PRESERVE:
- Exact camera angle and perspective
- All architectural elements: walls, ceiling, floor, windows, doors
- All furniture positions and shapes
- All structural and spatial layout

APPLY EXACTLY AS SPECIFIED:
${prompt}
${refImage ? 'Use the second reference image as a style and material guide for finishes, colors, and atmosphere.' : ''}

ALWAYS:
- Photorealistic material rendering: accurate texture, reflectivity on all surfaces
- Professional architectural photography, ultra realistic 8K`;

  try {
    let modelUrl, inputBody;

    if (refImage) {
      // 레퍼런스 이미지 있으면 multi-image 모델 사용
      modelUrl = 'https://api.replicate.com/v1/models/flux-kontext-apps/multi-image-kontext-pro/predictions';
      inputBody = {
        prompt: basePrompt,
        input_image1: image,
        input_image2: refImage,
        output_format: 'jpg',
        output_quality: 95,
        aspect_ratio: getAspectRatio(width, height)
      };
    } else {
      // 단일 이미지
      modelUrl = 'https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions';
      inputBody = {
        prompt: basePrompt,
        input_image: image,
        output_format: 'jpg',
        output_quality: 95,
        aspect_ratio: getAspectRatio(width, height)
      };
    }

    const response = await fetch(modelUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
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
