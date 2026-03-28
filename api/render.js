export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, prompt, image, strength } = req.body;

  if (!apiKey || !prompt || !image) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'a8cf60783de7816cff0e1b45416578f15cadb70ffb6be8a2742cbae84b7ee5b5',
        input: {
          prompt: prompt,
          image: image,
          negative_prompt: 'ugly, blurry, low quality, distorted, unrealistic, sketch lines, cartoon, flat, oversaturated, anime, text, watermark, 3d render look, cgi',
          num_inference_steps: 25,
          guidance_scale: 7.5,
          scheduler: 'euler',
          denoise: strength || 0.75,
          control_type: 'depth',
          control_strength: 0.9
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return await runFluxDepth(apiKey, prompt, image, strength, res);
    }

    return res.status(200).json(data);
  } catch (err) {
    try {
      return await runFluxDepth(apiKey, prompt, image, strength, res);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
}

async function runFluxDepth(apiKey, prompt, image, strength, res) {
  const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-depth-pro/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait'
    },
    body: JSON.stringify({
      input: {
        prompt,
        control_image: image,
        steps: 28,
        guidance: 3.5,
        control_strength: strength || 0.75
      }
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || JSON.stringify(data));
  return res.status(200).json(data);
}
