import { ImageSlide } from '../types';

export function createProceduralArtImage(index: number, width = 1920, height = 1080): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const aspect = width / height;

  // Different palette and theme for each of the 10 default slides
  switch (index % 10) {
    case 0: {
      // 01 晨雾群山 (Mist Mountain Dawn)
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1a2238');
      grad.addColorStop(0.4, '#4d5d7e');
      grad.addColorStop(0.7, '#a3b5c8');
      grad.addColorStop(1, '#e5d9c5');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Subtle sun
      const sunGrad = ctx.createRadialGradient(width * 0.7, height * 0.45, 10, width * 0.7, height * 0.45, 180);
      sunGrad.addColorStop(0, 'rgba(255, 230, 200, 0.9)');
      sunGrad.addColorStop(0.3, 'rgba(255, 210, 160, 0.4)');
      sunGrad.addColorStop(1, 'rgba(255, 210, 160, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(width * 0.7, height * 0.45, 180, 0, Math.PI * 2);
      ctx.fill();

      // Mountain layers (distant to near)
      const layers = [
        { y: 0.55, h: 120, color: 'rgba(90, 105, 130, 0.5)' },
        { y: 0.65, h: 180, color: 'rgba(55, 70, 95, 0.75)' },
        { y: 0.78, h: 240, color: 'rgba(28, 38, 56, 0.95)' }
      ];

      layers.forEach((l, idx) => {
        ctx.fillStyle = l.color;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, height * l.y);
        for (let x = 0; x <= width; x += 60) {
          const ny = height * l.y - Math.sin((x + idx * 400) * 0.003) * l.h - Math.cos(x * 0.007) * 40;
          ctx.lineTo(x, ny);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      });
      break;
    }

    case 1: {
      // 02 晚霞暮光 (Sunset Horizon Twilight)
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#2c1654');
      grad.addColorStop(0.3, '#782869');
      grad.addColorStop(0.6, '#d45d55');
      grad.addColorStop(0.85, '#f79d65');
      grad.addColorStop(1, '#f9d29b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Vast calm sea reflection
      const seaGrad = ctx.createLinearGradient(0, height * 0.65, 0, height);
      seaGrad.addColorStop(0, 'rgba(30, 20, 50, 0.85)');
      seaGrad.addColorStop(0.2, 'rgba(180, 70, 80, 0.5)');
      seaGrad.addColorStop(1, 'rgba(20, 10, 30, 0.95)');
      ctx.fillStyle = seaGrad;
      ctx.fillRect(0, height * 0.65, width, height * 0.35);

      // Low sun on horizon
      const sunGrad = ctx.createRadialGradient(width * 0.45, height * 0.65, 10, width * 0.45, height * 0.65, 260);
      sunGrad.addColorStop(0, 'rgba(255, 250, 220, 0.95)');
      sunGrad.addColorStop(0.2, 'rgba(255, 170, 80, 0.6)');
      sunGrad.addColorStop(1, 'rgba(240, 100, 60, 0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(width * 0.45, height * 0.65, 260, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 2: {
      // 03 翡翠林海 (Emerald Forest Canopy)
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#092520');
      grad.addColorStop(0.5, '#134e40');
      grad.addColorStop(0.85, '#2e7d66');
      grad.addColorStop(1, '#6ba388');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Atmospheric God rays
      ctx.save();
      ctx.translate(width * 0.3, -50);
      ctx.rotate(0.35);
      for (let i = 0; i < 7; i++) {
        const rayGrad = ctx.createLinearGradient(0, 0, 0, height * 1.4);
        rayGrad.addColorStop(0, 'rgba(240, 255, 230, 0.25)');
        rayGrad.addColorStop(0.7, 'rgba(200, 250, 200, 0.05)');
        rayGrad.addColorStop(1, 'rgba(200, 250, 200, 0)');
        ctx.fillStyle = rayGrad;
        ctx.fillRect(i * 140 - 150, 0, 70, height * 1.4);
      }
      ctx.restore();

      // Tree silhouettes in fog
      ctx.fillStyle = 'rgba(7, 24, 20, 0.92)';
      for (let x = 40; x < width; x += 110) {
        const th = height * 0.45 + (Math.sin(x * 12) * 80);
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.lineTo(x, height - th);
        ctx.lineTo(x + 25, height - th + 60);
        ctx.lineTo(x - 20, height - th + 120);
        ctx.lineTo(x + 35, height - th + 180);
        ctx.lineTo(x + 10, height);
        ctx.fill();
      }
      break;
    }

    case 3: {
      // 04 极光幽谷 (Northern Aurora Glow)
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#040b17');
      grad.addColorStop(0.5, '#0c1a2e');
      grad.addColorStop(1, '#07101e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Aurora curtain
      ctx.save();
      for (let a = 0; a < 3; a++) {
        ctx.beginPath();
        ctx.moveTo(0, height * (0.2 + a * 0.1));
        for (let x = 0; x <= width; x += 30) {
          const wave = Math.sin(x * 0.004 + a) * 90 + Math.cos(x * 0.008) * 50;
          ctx.lineTo(x, height * (0.25 + a * 0.1) + wave);
        }
        ctx.lineTo(width, height * 0.7);
        ctx.lineTo(0, height * 0.7);
        ctx.closePath();

        const aGrad = ctx.createLinearGradient(0, height * 0.1, 0, height * 0.7);
        aGrad.addColorStop(0, 'rgba(40, 255, 170, 0.45)');
        aGrad.addColorStop(0.4, 'rgba(80, 210, 240, 0.25)');
        aGrad.addColorStop(0.9, 'rgba(120, 50, 220, 0.1)');
        aGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = aGrad;
        ctx.fill();
      }
      ctx.restore();

      // Distant snowy peaks
      ctx.fillStyle = '#081423';
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 80) {
        ctx.lineTo(x, height * 0.75 - Math.abs(Math.sin(x * 0.005)) * 140);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 4: {
      // 05 金色沙丘 (Golden Desert Dunes)
      const grad = ctx.createLinearGradient(0, 0, 0, height * 0.5);
      grad.addColorStop(0, '#426b9a');
      grad.addColorStop(0.6, '#98b0c8');
      grad.addColorStop(1, '#f0d9b5');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height * 0.5);

      // Curved flowing dunes
      const dunes = [
        { y: 0.48, cp1x: 0.3, cp1y: 0.42, cp2x: 0.7, cp2y: 0.58, color: '#e6a457' },
        { y: 0.62, cp1x: 0.25, cp1y: 0.70, cp2x: 0.65, cp2y: 0.55, color: '#d38b41' },
        { y: 0.76, cp1x: 0.4, cp1y: 0.70, cp2x: 0.8, cp2y: 0.85, color: '#b96c2a' }
      ];

      dunes.forEach((d) => {
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, height * d.y);
        ctx.bezierCurveTo(
          width * d.cp1x, height * d.cp1y,
          width * d.cp2x, height * d.cp2y,
          width, height * d.y
        );
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      });
      break;
    }

    case 5: {
      // 06 深海微澜 (Deep Ocean Ripples)
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#08172c');
      grad.addColorStop(0.4, '#0f2f53');
      grad.addColorStop(0.8, '#1b527e');
      grad.addColorStop(1, '#348cb5');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Caustic ripples
      ctx.strokeStyle = 'rgba(160, 230, 255, 0.12)';
      ctx.lineWidth = 3;
      for (let r = 0; r < 14; r++) {
        ctx.beginPath();
        const cy = height * 0.3 + r * 50;
        ctx.moveTo(0, cy);
        for (let x = 0; x <= width; x += 40) {
          ctx.quadraticCurveTo(
            x + 20, cy + Math.sin(x * 0.01 + r) * 25,
            x + 40, cy
          );
        }
        ctx.stroke();
      }
      break;
    }

    case 6: {
      // 07 星野梦境 (Starry Cosmos Field)
      const grad = ctx.createRadialGradient(width * 0.5, height * 0.35, 50, width * 0.5, height * 0.5, width * 0.8);
      grad.addColorStop(0, '#261b47');
      grad.addColorStop(0.4, '#15112a');
      grad.addColorStop(0.8, '#080816');
      grad.addColorStop(1, '#020206');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Nebula cloud
      const neb = ctx.createRadialGradient(width * 0.6, height * 0.4, 20, width * 0.6, height * 0.4, 380);
      neb.addColorStop(0, 'rgba(235, 90, 160, 0.3)');
      neb.addColorStop(0.5, 'rgba(120, 60, 200, 0.2)');
      neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = neb;
      ctx.fillRect(0, 0, width, height);

      // Star dots
      ctx.fillStyle = '#ffffff';
      for (let s = 0; s < 250; s++) {
        const sx = ((s * 7919) % width);
        const sy = ((s * 4909) % (height * 0.8));
        const r = (s % 3 === 0) ? 1.8 : 0.9;
        ctx.globalAlpha = 0.3 + (s % 7) * 0.1;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
      break;
    }

    case 7: {
      // 08 樱落庭院 (Sakura Garden Breeze)
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#f9ebea');
      grad.addColorStop(0.5, '#f4d6d2');
      grad.addColorStop(0.85, '#e8b4b8');
      grad.addColorStop(1, '#a37081');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Gentle petals in the wind
      ctx.fillStyle = 'rgba(255, 230, 235, 0.85)';
      for (let p = 0; p < 80; p++) {
        const px = (p * 137) % width;
        const py = (p * 223) % height;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((p * 0.3) % (Math.PI * 2));
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 8: {
      // 09 几何流光 (Prism Ray & Minimal Geometry)
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#111317');
      grad.addColorStop(0.5, '#1e232d');
      grad.addColorStop(1, '#2c3545');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Diagonal prism spectrum line
      ctx.save();
      ctx.translate(width * 0.5, height * 0.5);
      ctx.rotate(-0.45);
      const colors = ['#ff5376', '#ffb049', '#ffd449', '#4de49c', '#33b3ff', '#9b59ff'];
      colors.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(-width, (i - 3) * 16, width * 2, 12);
      });
      ctx.restore();
      ctx.globalAlpha = 1.0;
      break;
    }

    case 9:
    default: {
      // 10 琥珀暖阳 (Amber Sunbeam Horizon)
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#664323');
      grad.addColorStop(0.3, '#9d6836');
      grad.addColorStop(0.65, '#d89b4f');
      grad.addColorStop(0.9, '#f6c579');
      grad.addColorStop(1, '#fae1a8');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Radial warmth
      const warm = ctx.createRadialGradient(width * 0.5, height * 0.4, 50, width * 0.5, height * 0.4, width * 0.5);
      warm.addColorStop(0, 'rgba(255, 255, 240, 0.7)');
      warm.addColorStop(0.3, 'rgba(255, 210, 120, 0.4)');
      warm.addColorStop(1, 'rgba(255, 200, 100, 0)');
      ctx.fillStyle = warm;
      ctx.fillRect(0, 0, width, height);
      break;
    }
  }

  // Add subtle frame line & artistic minimal title on bottom-left for fine aesthetic feel
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif';
  ctx.letterSpacing = '2px';
  const labels = [
    '01 // 晨雾群山 · MIST DAWN',
    '02 // 晚霞暮光 · SUNSET TWILIGHT',
    '03 // 翡翠林海 · EMERALD FOREST',
    '04 // 极光幽谷 · AURORA VALLEY',
    '05 // 金色沙丘 · GOLDEN DUNES',
    '06 // 深海微澜 · OCEAN RIPPLE',
    '07 // 星野梦境 · STARRY COSMOS',
    '08 // 樱落庭院 · SAKURA GARDEN',
    '09 // 几何流光 · PRISM BEAM',
    '10 // 琥珀暖阳 · AMBER SUNSET'
  ];
  ctx.fillText(labels[index % 10], 80, height - 70);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

export function getDefaultImageSlides(): ImageSlide[] {
  const titles = [
    '晨雾群山',
    '晚霞暮光',
    '翡翠林海',
    '极光幽谷',
    '金色沙丘',
    '深海微澜',
    '星野梦境',
    '樱落庭院',
    '几何流光',
    '琥珀暖阳'
  ];

  return titles.map((title, i) => ({
    id: `slide_${i + 1}`,
    title: `${i + 1}. ${title}`,
    dataUrl: createProceduralArtImage(i, 1920, 1080),
    aspectRatio: 16 / 9
  }));
}
