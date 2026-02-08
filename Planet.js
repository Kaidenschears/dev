class Planet {
  constructor(cx, cy, orbitRadius = 120, angle = 0, angularSpeed = 0.01, size = 12, color = [255, 180, 180], spinSpeed = null) {
    this.cx = cx; // central gravity center
    this.cy = cy;
    this.orbitRadius = orbitRadius;
    this.angle = angle;
    this.angularSpeed = angularSpeed;
    this.size = size;
    this.baseSize = size;
    this.color = color;
    this.x = this.cx + cos(this.angle) * this.orbitRadius;
    this.y = this.cy + sin(this.angle) * this.orbitRadius;
    // velocity for planet-planet gravity interactions
    this.vx = 0;
    this.vy = 0;
    // mass controls how strongly the planet influences satellites; initialize proportional to size
  this.initMass = this.baseSize * 10;
  this.mass = this.initMass;
  this.minMass = this.initMass * 0.8; // keep 80% mass after explosion (prevents satellites from being locked)
  this.destroyed = false;
    this.hitCount = 0; // number of satellite impacts received
    this._skipExplosion = false; // internal flag: if true, removal loop won't spawn a duplicate explosion
    // craters: array of {angle, size, depth}
    this.craters = [];
    // procedural surface texture (generated once)
    this.noiseSeed = random(1000);
    this._generateTexture();
    // spin around own axis (visual only)
    this.spinAngle = random(TWO_PI);
    this.spinSpeed = (spinSpeed !== null) ? spinSpeed : random(-0.02, 0.02);
  }
  // generate a per-planet procedural texture using Perlin noise into a p5.Graphics
  _generateTexture() {
    const dispRadius = max(8, this.baseSize);
    const texSize = max(48, floor(dispRadius * 6));
  const g = createGraphics(texSize, texSize);
    g.pixelDensity(1);
    g.noStroke();
    g.loadPixels();
    const cx = texSize / 2;
    const cy = texSize / 2;
    const radius = texSize / 2 - 1;
    // base colors
    const baseR = this.color[0] || 200;
    const baseG = this.color[1] || 180;
    const baseB = this.color[2] || 160;
    const darkR = baseR * 0.35;
    const darkG = baseG * 0.35;
    const darkB = baseB * 0.35;
    const noiseScale = 1.6;
    for (let y = 0; y < texSize; y++) {
      for (let x = 0; x < texSize; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = sqrt(dx * dx + dy * dy);
        const idx = 4 * (y * texSize + x);
        if (d <= radius) {
          const nx = (dx / radius) * noiseScale + this.noiseSeed;
          const ny = (dy / radius) * noiseScale + this.noiseSeed + 10;
          const n = noise(nx, ny);
          const rnorm = d / radius;
          const rim = pow(1 - rnorm, 1.3);
          const rcol = lerp(darkR, baseR, n * 0.9) * (0.6 + 0.6 * rim);
          const gcol = lerp(darkG, baseG, n * 0.9) * (0.6 + 0.6 * rim);
          const bcol = lerp(darkB, baseB, n * 0.9) * (0.6 + 0.6 * rim);
          g.pixels[idx] = constrain(floor(rcol), 0, 255);
          g.pixels[idx + 1] = constrain(floor(gcol), 0, 255);
          g.pixels[idx + 2] = constrain(floor(bcol), 0, 255);
          g.pixels[idx + 3] = 255;
        } else {
          g.pixels[idx] = 0;
          g.pixels[idx + 1] = 0;
          g.pixels[idx + 2] = 0;
          g.pixels[idx + 3] = 0;
        }
      }
    }
    g.updatePixels();
    // keep an immutable base texture (no craters) and a separate mutable texture
    this.baseTexture = g;
    this.texture = createGraphics(texSize, texSize);
    this.texture.pixelDensity(1);
    this.texture.image(this.baseTexture, 0, 0);
  }
  // redraw base texture + all craters into this.texture (bake craters)
  _bakeCraters() {
    if (!this.baseTexture || !this.texture) return;
    const g = this.texture;
    const texSize = g.width;
    g.clear();
    g.push();
    g.imageMode(CORNER);
    g.image(this.baseTexture, 0, 0, texSize, texSize);
    g.pop();

    if (!this.craters || this.craters.length === 0) return;

    // draw each crater into texture-space
    const cx = texSize / 2;
    const cy = texSize / 2;
    const texRadius = texSize / 2 - 1;
    const planetBase = color(this.color[0], this.color[1], this.color[2]);

    for (let c of this.craters) {
      // map crater size from world px to texture px
      const displaySize = max(4, this.baseSize);
      const radiusWorld = displaySize; // same as used elsewhere
      const scale = texSize / (radiusWorld * 2);
      const maxCrater = max(4, texRadius * 0.9);
      let craterSize = min(maxCrater, c.size * scale);

      // compute crater center in texture-space using stored local angle
      const angle = ((c.localAngle) % TWO_PI + TWO_PI) % TWO_PI;
      const craterRadius = craterSize * 0.5;
      const centerDist = max(0, texRadius - craterRadius - 2);
      const px = cx + cos(angle) * centerDist;
      const py = cy + sin(angle) * centerDist;

      // draw soft radial darkening using MULTIPLY blend
      const craterCol = lerpColor(planetBase, color(20, 20, 30), 0.55 * c.depth);
      const rimCol = lerpColor(planetBase, color(255, 255, 255), 0.10);

      g.push();
      g.blendMode(MULTIPLY);
      g.noStroke();
      const steps = 6;
      for (let k = 0; k < steps; k++) {
        const f = 1 - k / steps;
        const sizeFactor = lerp(0.18, 1.0, f);
        const a = (0.18 * (1 + f)) * (200 * c.depth / 255.0);
        g.fill(red(craterCol), green(craterCol), blue(craterCol), a * 255);
        g.ellipse(px, py, craterSize * sizeFactor, craterSize * sizeFactor);
      }
      g.pop();

      // rim
      g.push();
      g.noFill();
      g.stroke(red(rimCol), green(rimCol), blue(rimCol), 80 * c.depth);
      g.strokeWeight(max(1, craterSize * 0.06));
      g.ellipse(px, py, craterSize * 1.02, craterSize * 1.02);
      g.pop();

      // inner shadow
      g.push();
      g.blendMode(MULTIPLY);
      g.noStroke();
      const lightDirX = -0.6;
      const lightDirY = -0.4;
      const sOff = craterSize * 0.06;
      const sx = px - lightDirX * sOff;
      const sy = py - lightDirY * sOff;
      const innerCol = lerpColor(planetBase, color(30, 30, 40), 0.25 * c.depth);
      const shadowAlpha = 70 * c.depth;
      g.fill(red(innerCol), green(innerCol), blue(innerCol), shadowAlpha);
      g.ellipse(sx, sy, craterSize * 0.62, craterSize * 0.62);
      g.pop();
    }
  }
  update() {
    // Apply gravity from other planets
    for (const other of planets) {
      if (!other || other === this || other.destroyed) continue;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const dist2 = dx * dx + dy * dy + 1e-6;
      const dist = sqrt(dist2);
      // acceleration from other planet's mass
      const aMag = (other.mass) / (dist2 + gravitySoftening);
      this.vx += (dx / dist) * aMag * 0.001; // small scaling to keep orbits stable
      this.vy += (dy / dist) * aMag * 0.001;
    }
    
    // Angular orbit motion (original system, still primary)
    this.angle += this.angularSpeed;
    const baseX = this.cx + cos(this.angle) * this.orbitRadius;
    const baseY = this.cy + sin(this.angle) * this.orbitRadius;
    
    // Apply velocity perturbations on top of angular orbit
    this.vx *= 0.98; // damping
    this.vy *= 0.98;
    this.x = baseX + this.vx;
    this.y = baseY + this.vy;
    
    // update spin
    this.spinAngle = (this.spinAngle + this.spinSpeed) % TWO_PI;
  }
  render() {
    push();
    noStroke();
    // size scales with remaining mass
    // keep planet visual size constant; mass only affects physics, not visual radius
    const radius = max(4, this.baseSize);
    // draw procedural texture centered at (x,y) scaled to visual radius
    if (this.texture) {
      // draw the baked texture and rotate it by the planet spin so craters rotate with the planet
      imageMode(CENTER);
      push();
      translate(this.x, this.y);
      rotate(this.spinAngle);
      tint(255, 240);
      image(this.texture, 0, 0, radius * 2, radius * 2);
      noTint();
      pop();
    } else {
      fill(this.color[0], this.color[1], this.color[2], 220);
      ellipse(this.x, this.y, radius * 2);
    }
    // craters are baked into this.texture for performance and permanence
    pop();
  }
  // erode mass by amount; update size indirectly through mass
  erode(amount) {
    this.mass = max(this.minMass, this.mass - amount);
    // do not auto-mark destroyed here; destruction requires both low mass and enough hits
  }
  // add a crater at world-space angle (relative to planet center), size in pixels, depth 0..1
  addCrater(angle, size, depth = 1.0, impactX = null, impactY = null) {
    // Merge by physical proximity on the planet surface (world-space) instead of
    // only angular proximity. This prevents an existing crater from being moved
    // to a new angle when nearby impacts occur. Craters accumulate until the
    // planet is destroyed (no forced eviction).
    const displaySize = max(4, this.baseSize);
    const radius = displaySize; // visual radius used for crater placement
    const craterRadius = size * 0.5;
    // If impactX/Y provided, use that for the impact point, else use angle
    let nx, ny, localAngle;
    if (impactX !== null && impactY !== null) {
      // Vector from planet center to impact
      let dx = impactX - this.x;
      let dy = impactY - this.y;
      let distToCenter = sqrt(dx * dx + dy * dy);
      // Clamp so crater is always inside the planet
      let maxDist = max(0, radius - craterRadius - 2);
      if (distToCenter > maxDist) {
        dx *= maxDist / distToCenter;
        dy *= maxDist / distToCenter;
        distToCenter = maxDist;
      }
      nx = this.x + dx;
      ny = this.y + dy;
      localAngle = (atan2(dy, dx) - this.spinAngle + TWO_PI) % TWO_PI;
    } else {
      // Fallback: use angle
      const centerDist = max(0, radius - craterRadius - 2);
      nx = this.x + cos(angle) * centerDist;
      ny = this.y + sin(angle) * centerDist;
      localAngle = ((angle - this.spinAngle) % TWO_PI + TWO_PI) % TWO_PI;
    }

    let merged = false;
    for (let i = 0; i < this.craters.length; i++) {
      const c = this.craters[i];
      // compute existing crater world center using its stored local angle (rotates with planet)
      const cRadius = c.size * 0.5;
      const cCenterDist = max(0, radius - cRadius - 2);
      const cWorldAngle = ((c.localAngle + this.spinAngle) % TWO_PI + TWO_PI) % TWO_PI;
      const cx = this.x + cos(cWorldAngle) * cCenterDist;
      const cy = this.y + sin(cWorldAngle) * cCenterDist;
      const d = dist(nx, ny, cx, cy);
      // merge tuning that scales with planet visual size so small planets
      // don't end up absorbing most strikes.
      const refRadius = 40; // reference planet radius for scaling
      const sizeScale = constrain(radius / refRadius, 0.25, 2.0);
      // very small distance to treat hits as exactly the same spot (scaled)
      const exactMergeDist = max(0.5, 1 * sizeScale);
      // general merge threshold scaled down for smaller planets to favor new craters
      const mergeThresh = max(1.2, (craterRadius + cRadius) * 0.12 * sizeScale);
      if (d <= exactMergeDist) {
        // very close hit: enlarge existing crater regardless of size ratio
        c.size = min(displaySize * 1.6, c.size + size * 0.9);
        c.depth = min(1, c.depth + depth * 0.7);
        merged = true;
        break;
      } else if (d <= mergeThresh) {
        // Prevent large craters from absorbing all small hits: only merge when sizes are similar
        const sizeRatio = max(c.size, size) / max(1, min(c.size, size));
        // require closer size similarity to merge; slightly stricter on small planets
        const sizeRatioThresh = 1.15 + 0.15 * sizeScale; // ~1.3 at scale=1
        if (sizeRatio <= sizeRatioThresh) {
          // merge: grow existing crater but DO NOT move its angle — preserve original crater location
          c.size = min(displaySize * 1.6, c.size + size * 0.8);
          c.depth = min(1, c.depth + depth * 0.6);
          merged = true;
          break;
        }
      }
    }
    if (!merged) {
      // store the crater's local angle (relative to the planet's rotation at creation)
      // so the crater will rotate visually with the planet: local = worldAngle - spinAngle
      this.craters.push({ localAngle, size, depth });
      // bake into texture so the crater is permanent visually
      this._bakeCraters();
    } else {
      // existing crater was updated — re-bake to reflect merged changes
      this._bakeCraters();
    }
  }
}