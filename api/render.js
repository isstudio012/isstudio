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

  const headers = { 'Authorization': `Token ${apiKey}`, 'Content-Type': 'application/json' };

  try {
    // 1단계: Depth Anything
    let depthImageUrl = null;
    try {
      const depthRes = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST', headers,
        body: JSON.stringify({
          version: 'a00d842e0359a8e69a9d55f8c5c2a12ff9c1fef21aef32ae67b3b5fdf3f5a11e',
          input: { image: image, model_size: 'Small' }
        })
      });
      const depthPred = await depthRes.json();
      if (depthRes.ok && depthPred.id) {
        depthImageUrl = await pollForResult(apiKey, depthPred.id);
      }
    } catch (e) { console.log('Depth failed:', e.message); }

    // 2단계: ControlNet + Realistic Vision
    let renderedUrl = null;
    try {
      const controlRes = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST', headers,
        body: JSON.stringify({
          version: 'a8cf60783de7816cff0e1b45416578f15cadb70ffb6be8a2742cbae84b7ee5b5',
          input: {
            prompt: prompt,
            image: depthImageUrl || image,
            negative_prompt: 'ugly, blurry, low quality, distorted, unrealistic, sketch lines, cartoon, flat, oversaturated, anime, text, watermark, 3d render, cgi',
            num_inference_steps: 25,
            guidance_scale: 7.5,
            scheduler: 'euler',
            denoise: strength || 0.75,
            control_type: 'depth',
            control_strength: 0.9
          }
        })
      });
      if (controlRes.ok) {
        const controlPred = await controlRes.json();
        if (controlPred.id) renderedUrl = await pollForResult(apiKey, controlPred.id);
      }
    } catch (e) { console.log('ControlNet failed:', e.message); }

    // 백업: Flux Depth Pro
    if (!renderedUrl) {
      const fluxRes = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-depth-pro/predictions', {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'wait' },
        body: JSON.stringify({
          input: { prompt, control_image: image, steps: 28, guidance: 3.5, control_strength: strength || 0.75 }
        })
      });
      const fluxData = await fluxRes.json();
      if (!fluxRes.ok) throw new Error(fluxData.detail || '렌더링 실패');
      renderedUrl = fluxData.status === 'succeeded'
        ? (Array.isArray(fluxData.output) ? fluxData.output[0] : fluxData.output)
        : await pollForResult(apiKey, fluxData.id);
    }

    // 3단계: Real-ESRGAN 업스케일
    let finalUrl = renderedUrl;
    try {
      const upRes = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST', headers,
        body: JSON.stringify({
          version: 'f121d640bd286e1fdc67f9799164c1d5be36ff74576ee2d209f07e83e9be6625',
          input: { image: renderedUrl, scale: 2, face_enhance: false }
        })
      });
      if (upRes.ok) {
        const upPred = await upRes.json();
        if (upPred.id) {
          const upUrl = await pollForResult(apiKey, upPred.id);
          if (upUrl) finalUrl = upUrl;
        }
      }
    } catch (e) { console.log('Upscale failed:', e.message); }

    return res.status(200).json({ id: 'done', status: 'succeeded', output: finalUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function pollForResult(apiKey, predictionId) {
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Token ${apiKey}` }
    });
    const data = await res.json();
    if (data.status === 'succeeded') return Array.isArray(data.output) ? data.output[0] : data.output;
    if (data.status === 'failed') throw new Error(data.error || '처리 실패');
  }
  throw new Error('시간 초과');
}
