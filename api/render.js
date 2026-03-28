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

  const materialPhysics = `
Physically accurate material rendering:
GLASS/WINDOWS: high specular reflection 0.95, slight green tint, fresnel effect, overexposed bright exterior visible through glass, sharp reflections of interior on glass surface, double-pane window frame shadow.
CERAMIC TILE FLOOR: semi-gloss surface, specular reflection 0.4, sharp light reflections from windows on polished tile surface, subtle grout lines with depth.
MARBLE FLOOR: high polish specular 0.7, mirror-like reflections, natural veining pattern, wet-look sheen.
HARDWOOD/WOOD VENEER (무늬목): warm medium specular 0.2, subtle wood grain texture visible, matte lacquer finish, warm amber tones, micro surface texture.
FABRIC SOFA (패브릭): completely matte diffuse 0.0 specular, soft micro-fiber texture, slight subsurface scattering, fabric weave visible up close, dust-free clean look.
LEATHER (가죽): semi-specular 0.35, subtle leather grain texture, slight sheen under light, natural pore detail, rich deep color.
PAINTED WHITE WALLS: very low specular 0.05, flat matte finish, slight imperfection texture, bounce light from windows creating gradient.
METAL FIXTURES (조명/손잡이): high specular 0.9, sharp point light reflections, brushed or polished finish, chrome or matte black.
CURTAINS/SHEER: translucent fabric, light diffusion, soft shadow through fabric, gentle folds.
`;

  const lightingPhysics = `
Physically accurate lighting:
Strong natural daylight through windows - exterior 5-8 stops brighter than interior creating overexposed window glow.
Sharp shadow edges from direct sunlight.
Soft bounce light from white walls and ceiling filling shadows.
Window light creating bright patches on floor and walls.
Ambient occlusion in corners and under furniture.
Color temperature: daylight 5500-6500K through windows, warm 2700-3000K for interior ambient.
`;

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
          prompt: `Transform this interior sketch into a photorealistic architectural render. ${prompt}. 
Keep the EXACT same spatial layout, furniture positions, ceiling structure, windows and all architectural elements unchanged.
Only enhance with photorealistic materials, textures, lighting.
${materialPhysics}
${lightingPhysics}
Shot with Canon EOS R5, 24mm lens, f/8, ISO 400. Professional architectural photography. Ultra sharp 8K resolution.`,
          input_image: image,
          output_format: 'jpg',
          output_quality: 95
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
