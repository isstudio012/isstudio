export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { apiKey, prompt, image, width, height } = req.body;
  if (!apiKey || !prompt || !image) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const finalPrompt = `Transform this 3D interior sketch into a photorealistic architectural render. ${prompt}.

Keep the exact same camera angle, spatial layout, furniture positions, ceiling design, windows, and all architectural elements unchanged.

Preserve all materials exactly as in the original SketchUp model. Do not reinterpret, redesign, upgrade, or replace any materials. No material substitution. Keep wall, floor, ceiling, glass, metal, fabric, wood, and furniture finishes identical to the original model.

Lighting and exposure must be completely changed. Ignore the original lighting and replace it with a new lighting setup.

Apply extremely strong direct sunlight from the exterior, with high-intensity daylight entering deeply through the windows. Make the exterior environment very bright and slightly overexposed. Create strong sunlight patches inside the room, with high-contrast hard shadows and clear directional daylight.

Use neutral color grading, pure white balance, 6500K daylight, no yellow tint, no orange cast, and no warm color shift.

Physically accurate materials:
Walls: smooth white painted finish, matte, flat surface, very low reflectivity, subtle diffuse response, minimal roughness, no tile, no stone, no concrete texture
Floor: ceramic tile finish, realistic reflections, medium gloss, subtle roughness variation, clear specular highlights, clean joints
Glass: clear transparent glass, high light transmission, realistic reflections, subtle refraction, IOR 1.5
Metal: realistic metallic reflection, controlled gloss, sharp specular highlights, brushed or smooth metal response depending on original material
Fabric: soft textile material, high roughness, diffuse light absorption, visible fine fibers, no gloss
Wood: natural wood grain, semi-matte finish, subtle reflection, realistic roughness variation
Stone surfaces: realistic depth, subtle reflection, micro roughness, controlled specular highlights

Render quality must look like high-end architectural visualization, V-Ray / Corona render quality, physically accurate rendering, ray-traced global illumination, realistic light bounce, advanced material shading, micro surface detail, ultra sharp, ultra realistic, 8K.`;
  try {
    const response = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
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
