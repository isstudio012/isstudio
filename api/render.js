export default async function handler(req, res) {
  // 1. CORS 설정 강화
  res.setHeader('Access-Control-Allow-Origin', '*'); // 프로덕션에서는 실제 도메인으로 변경 권장
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, prompt, image, width, height } = req.body;
  if (!apiKey || !prompt || !image) {
    return res.status(400).json({ error: 'Missing required fields: apiKey, prompt, or image' });
  }

  const finalPrompt = `Transform this 3D interior sketch into a photorealistic architectural render. ${prompt}.

Keep the exact same camera angle, spatial layout, furniture positions, ceiling design, windows, and all architectural geometry identical.

Preserve layout, objects, and all material finishes exactly. Do not change or replace any materials or finishes. No material substitution.

Make the scene much brighter with extremely strong direct sunlight entering from outside. Bright exterior environment, slightly overexposed outdoor view, strong sunlight patches on the floor and interior surfaces, hard shadows, sharp shadow edges, high contrast daylight.

real photograph, DSLR camera, natural lighting, realistic exposure, photographic dynamic range, real lens optics, natural color response, subtle imperfections, no CGI, no render look, ultra realistic, 8K`;

  try {
    // 2. Replicate API 최초 요청 (Prediction 생성)
    const initialResponse = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`, // Token -> Bearer로 수정
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt: finalPrompt,
          input_image: image, // 참고: image 값이 Base64 데이터 URI 형태이거나 URL이어야 합니다.
          output_format: 'jpg',
          output_quality: 95,
          aspect_ratio: getAspectRatio(width, height)
        }
      })
    });

    let prediction = await initialResponse.json();

    if (!initialResponse.ok) {
      throw new Error(prediction.detail || JSON.stringify(prediction));
    }

    // 3. 폴링(Polling) 로직 추가: 완료될 때까지 반복 확인
    while (
      prediction.status !== 'succeeded' &&
      prediction.status !== 'failed' &&
      prediction.status !== 'canceled'
    ) {
      // 1초 대기 후 상태 재확인 (너무 잦은 요청 방지)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const pollResponse = await fetch(prediction.urls.get, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      prediction = await pollResponse.json();
    }

    // 최종 실패 처리
    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      throw new Error(`Replicate generation failed: ${prediction.error}`);
    }

    // 성공 시 결과 반환
    return res.status(200).json(prediction);

  } catch (err) {
    console.error('Generation Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
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
}ㅈ
