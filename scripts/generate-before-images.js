const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const demoDir = path.join(__dirname, '..', 'public', 'demo');
const images = ['nature.jpg', 'city.jpg', 'portrait.jpg', 'coffee.jpg'];

async function addWatermark(inputPath, outputPath, text, options = {}) {
  const {
    fontSize = 48,
    opacity = 0.35,
    rotation = -25,
    color = 'white',
    position = 'center'
  } = options;

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const { width, height } = metadata;

  // Create SVG overlay with watermark text
  const svgText = `
    <svg width="${width}" height="${height}">
      <defs>
        <style>
          .watermark {
            font-family: Arial, sans-serif;
            font-size: ${fontSize}px;
            font-weight: bold;
            fill: ${color};
            opacity: ${opacity};
          }
        </style>
      </defs>
      <g transform="rotate(${rotation}, ${width/2}, ${height/2})">
        <text x="${width/2}" y="${height/2}" text-anchor="middle" dominant-baseline="middle" class="watermark">${text}</text>
      </g>
    </svg>
  `;

  await image
    .composite([{
      input: Buffer.from(svgText),
      gravity: 'center'
    }])
    .toFile(outputPath);
  
  console.log(`Created: ${outputPath}`);
}

async function generateAll() {
  for (const img of images) {
    const inputPath = path.join(demoDir, img);
    const outputPath = path.join(demoDir, `before-${img}`);
    
    if (!fs.existsSync(inputPath)) {
      console.log(`Skipping ${img} - not found`);
      continue;
    }

    await addWatermark(inputPath, outputPath, 'WATERMARK', {
      fontSize: 64,
      opacity: 0.4,
      rotation: -20,
      color: 'white'
    });
  }
  console.log('Done!');
}

generateAll().catch(console.error);
