export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, prompt, image, width, height } = req.body;
  if (!apiKey || !prompt || !image) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const finalPrompt = `Transform this 3D interior sketch into a photorealistic architectural render. ${prompt}. Keep the exact same camera angle, spatial layout, furniture positions, 
  ceiling design, windows, and all architectural geometry identical. Preserve layout, objects, and all material finishes exactly. 
  Do not change or replace any materials or finishes. No material substitution. Make the scene much brighter with extremely strong direct sunlight entering from outside. Bright exterior environment, 
  slightly overexposed outdoor view, strong sunlight patches on the floor and interior surfaces, hard shadows, sharp shadow edges, high contrast daylight. real photograph, DSLR camera, natural lighting, 
  realistic exposure, photographic dynamic range, real lens optics, natural color response, subtle imperfections, no CGI, no render look, ultra realistic, 8K`;

  try {
    const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt: finalPrompt,
          input_image: image,
          output_format: 'jpg',
          output_quality: 95,
          aspect_ratio: getAspectRatio(width, height)
        }
      })
    });

    // 💡 에러 방지: JSON 파싱 전에 응답이 정상인지, 텍스트인지 먼저 확인합니다.
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Replicate API Error Text:", errorText);
      throw new Error(`Replicate API failed: ${response.status}`);
    }

    const prediction = await response.json();
    
    // 💡 타임아웃 방지: while 문으로 기다리지 않고, 즉시 프론트엔드로 prediction(ID, 상태 등)을 보냅니다.
    return res.status(200).json(prediction);

  } catch (err) {
    console.error('Generation Error:', err);
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
