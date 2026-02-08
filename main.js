let starfield;
let starfieldW;
let starfieldH;
let canvx;
let canvy;
// disable grain background - we'll use planets + satellites instead
let max_speed=3;
let friction = -0.04;
// central gravity parameters (Option 1)
let enableCentralGravity = true;
let centerX = 0;
let centerY = 0;
let GM = 800; // gravitational parameter (tunable) - lowered for gentler central pull
let gravitySoftening = 100; // avoids singularity at r=0
let initOrbitFactor = 1.0; // multiplier for initial tangential velocity
let fr=60;
// global velocity damping to keep motion calm (0.9 - 0.999 range)
let velocityDamping = 0.96;
// planets & satellites
let planets = [];
let satellites = [];
let numPlanets = 3;
let initialSatellites = 12;
// destruction rules
let requiredHits = 5; // number of satellite impacts required to allow full destruction
let explosions = []; // active explosion effects
// behavior when a planet is destroyed: 'debris' will convert its satellites into explosion debris,
// 'reassign' will try to reassign satellites to nearest surviving planet (legacy behavior)
let satelliteDeathBehavior = 'debris';



function setup() {
  // Responsive canvas sizing for mobile/desktop
  canvx = windowWidth;
  canvy = Math.floor(windowHeight * 0.6);
  let canvas = createCanvas(canvx, canvy);
  canvas.parent('top');
  canvas.elt.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  frameRate(fr);
  noStroke();
  // Responsive starfield
  starfieldW = windowWidth * 3;
  starfieldH = Math.floor(windowHeight * 0.6) * 3;
  starfield = createGraphics(starfieldW, starfieldH);
  starfield.background(10, 12, 30);
  for (let i = 0; i < 800; i++) {
    let x = random(starfield.width);
    let y = random(starfield.height);
    let r = random(0.5, 2.2);
    let b = random(180, 255);
    let a = random(120, 255);
    starfield.noStroke();
    starfield.fill(b, b, 255, a);
    starfield.ellipse(x, y, r, r);
    if (random() < 0.08) {
      let c = color(random(180,255), random(180,255), random(200,255), a);
      starfield.fill(c);
      starfield.ellipse(x, y, r * 1.2, r * 1.2);
    }
  }
  centerX = width / 2;
  centerY = height / 2;
  for (let i = 0; i < numPlanets; i++) {
    const orbitR = 80 + i * 90;
    const angle = random(TWO_PI);
    const speed = random(0.002, 0.008) * (i % 2 ? 1 : -1);
    const size = 12 + i * 4;
    const col = [map(i, 0, numPlanets - 1, 120, 255), 180, map(i, 0, numPlanets - 1, 200, 100)];
    planets.push(new Planet(centerX, centerY, orbitR, angle, speed, size, col));
  }
  for (let i = 0; i < initialSatellites; i++) {
    const p = random(planets);
    const satR = p.size + 12 + random(8, 60);
    const a = random(TWO_PI);
    const spd = random(0.005, 0.03) * (random() > 0.5 ? 1 : -1);
    const s = 4 + random(0, 3);
    satellites.push(new Satellite(p, satR, a, spd, s));
  }
  updateZoomMin();
}


function draw() {
  push();
  // Center zoom on canvas
  translate(width / 2, height / 2);
  scale(zoom);
  translate(-width / 2, -height / 2);
  // Calculate the visible region of the starfield so it always covers the canvas
  let sx = (starfield.width - width) / 2;
  let sy = (starfield.height - height) / 2;
  image(starfield, -sx, -sy, starfield.width, starfield.height);
  // ...existing code...

  // update and render planets and satellites behind grains
  planets.forEach(p => p.update());
  satellites.forEach(s => s.update());

  // detect planet-planet collisions: if two planets overlap, cause an explosion and mark them destroyed
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i];
      const b = planets[j];
      if (a.destroyed || b.destroyed) continue;
      const ra = max(4, a.baseSize);
      const rb = max(4, b.baseSize);
      const pd = dist(a.x, a.y, b.x, b.y);
      if (pd <= ra + rb) {
        // collision point approx midpoint
        const cx = (a.x + b.x) * 0.5;
        const cy = (a.y + b.y) * 0.5;
        // blended color for explosion
        const ca = color(a.color[0], a.color[1], a.color[2]);
        const cb = color(b.color[0], b.color[1], b.color[2]);
        const blend = lerpColor(ca, cb, 0.5);
        // spawn a single explosion at collision midpoint
        explosions.push(new Explosion(cx, cy, blend));
        // mark both planets destroyed and set skip flag so removal loop won't spawn duplicates
        a.destroyed = true; a._skipExplosion = true;
        b.destroyed = true; b._skipExplosion = true;
      }
    }
  }

  // check satellite <-> planet collisions and erode planet mass on impact
  for (let i = satellites.length - 1; i >= 0; i--) {
    const s = satellites[i];
    let removed = false;
    // check collision against all planets (not just parent) so cross-impacts count
    for (let j = 0; j < planets.length; j++) {
      const p = planets[j];
      // use visual radius (baseSize) for collision checks so planets don't shrink visually
      const pDisplay = max(4, p.baseSize);
      const pd = dist(s.x, s.y, p.x, p.y);
      if (pd <= pDisplay + s.size * 0.5) {
        // erosion amount: cap per-impact erosion so it takes at least `requiredHits` impacts
        const maxPerHit = (p.initMass || (p.baseSize * 10)) / max(1, requiredHits);
        const erosionAmount = min(s.size * 8, maxPerHit);
        p.erode(erosionAmount);
        // increment impact counter for destruction gating
        p.hitCount = (p.hitCount || 0) + 1;
        // add a crater at impact angle
        const impactAngle = atan2(s.y - p.y, s.x - p.x);
        // compute true impact speed (distance moved per frame)
        const prevX = s.x - (cos(s.angle) * s.orbitRadius - cos(s.angle - s.baseAngularSpeed) * s.orbitRadius);
        const prevY = s.y - (sin(s.angle) * s.orbitRadius - sin(s.angle - s.baseAngularSpeed) * s.orbitRadius);
        const impactSpeed = dist(s.x, s.y, prevX, prevY);
        // crater size reflects particle speed and size
        const craterSize = max(4, s.size * 2, impactSpeed * 30);
        // depth scales with impact speed (but bounded)
        const depth = min(1, impactSpeed / 6);
        p.addCrater(impactAngle, craterSize, depth, s.x, s.y);
        // remove satellite on impact
        satellites.splice(i, 1);
        removed = true;
        // only mark planet destroyed if mass is fully eroded AND enough impacts have occurred
        if (p.mass <= p.minMass && p.hitCount >= requiredHits) {
          p.destroyed = true;
        }
        break;
      }
    }
    if (removed) continue;
  }

  // if any planets were destroyed, reassign or remove their satellites and remove planet entries
  for (let pi = planets.length - 1; pi >= 0; pi--) {
    const p = planets[pi];
    if (p.destroyed) {
      // trigger explosion effect using planet color and position unless already handled by a collision
      if (!p._skipExplosion) {
        explosions.push(new Explosion(p.x, p.y, color(p.color[0], p.color[1], p.color[2])));
      }
      // handle satellites that had this planet as parent according to behavior
      for (let si = satellites.length - 1; si >= 0; si--) {
        const s = satellites[si];
        if (s.planet === p) {
          if (satelliteDeathBehavior === 'reassign') {
            // find nearest surviving planet
            let nearest = null;
            let bestD = Infinity;
            for (let k = 0; k < planets.length; k++) {
              if (k === pi) continue;
              const q = planets[k];
              if (q.destroyed) continue;
              const d = dist(s.x, s.y, q.x, q.y);
              if (d < bestD) { bestD = d; nearest = q; }
            }
            if (nearest) {
              s.planet = nearest;
            } else {
              // no planets left, remove satellite
              satellites.splice(si, 1);
            }
          } else {
            // default: convert satellite into small debris explosion at its position
            const col = color(p.color[0], p.color[1], p.color[2]);
            spawnDebrisAt(s.x, s.y, col, 6);
            satellites.splice(si, 1);
          }
        }
      }
      // finally remove the destroyed planet from list
      planets.splice(pi, 1);
    }
  }

  planets.forEach(p => p.render());
  satellites.forEach(s => s.render());

  // update and render any active explosions
  for (let ei = explosions.length - 1; ei >= 0; ei--) {
    const ex = explosions[ei];
    ex.update();
    ex.render();
    if (ex.isDone()) explosions.splice(ei, 1);
  }

  // ...no grains code...
}

// spawn a rotating gravity well on mouse press inside canvas
// helper: spawn a planet at canvas coords (x,y)
function spawnPlanetAt(mx, my) {
  const dx = mx - centerX;
  const dy = my - centerY;
  let orbitR = sqrt(dx * dx + dy * dy);
  orbitR = max(orbitR, 24);
  const angle = atan2(dy, dx);
  const speed = random(0.002, 0.009) * (random() > 0.5 ? 1 : -1);
  const size = random(10, 22);
  const col = [random(100, 255), random(120, 220), random(80, 220)];
  planets.push(new Planet(centerX, centerY, orbitR, angle, speed, size, col));
}

// helper: spawn a satellite at canvas coords (x,y) orbiting nearest planet
function spawnSatelliteAt(mx, my) {
  if (planets.length === 0) return;
  let nearest = planets[0];
  let bestDist = dist(mx, my, nearest.x, nearest.y);
  for (let i = 1; i < planets.length; i++) {
    const p = planets[i];
    const d = dist(mx, my, p.x, p.y);
    if (d < bestDist) { bestDist = d; nearest = p; }
  }
  const sdx = mx - nearest.x;
  const sdy = my - nearest.y;
  const orbitR = sqrt(sdx * sdx + sdy * sdy);
  const safeR = max(orbitR, nearest.size + 6);
  const sAngle = atan2(sdy, sdx);
  const spd = random(0.008, 0.03) * (random() > 0.5 ? 1 : -1);
  const s = 4 + random(0, 3);
  satellites.push(new Satellite(nearest, safeR, sAngle, spd, s));
}

function mousePressed() {
  // if click is outside canvas ignore
  if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;

  // Convert screen (mouse) coordinates to world coordinates under zoom/pan
  // Undo the draw() transforms: translate(width/2, height/2), scale(zoom), translate(-width/2, -height/2)
  let wx = (mouseX - width / 2) / zoom + width / 2;
  let wy = (mouseY - height / 2) / zoom + height / 2;

  // RIGHT click: create planet
  if (mouseButton === RIGHT) {
    spawnPlanetAt(wx, wy);
    return;
  }
  // LEFT click: spawn satellite
  if (mouseButton === LEFT) {
    spawnSatelliteAt(wx, wy);
    return;
  }
  return;
}



// Responsive resize handler for canvas and starfield
function windowResized() {
  canvx = windowWidth;
  canvy = Math.floor(windowHeight * 0.6);
  resizeCanvas(canvx, canvy);
  centerX = width / 2;
  centerY = height / 2;
  // Regenerate starfield to match new size
  starfieldW = windowWidth * 3;
  starfieldH = Math.floor(windowHeight * 0.6) * 3;
  starfield = createGraphics(starfieldW, starfieldH);
  starfield.background(10, 12, 30);
  for (let i = 0; i < 800; i++) {
    let x = random(starfield.width);
    let y = random(starfield.height);
    let r = random(0.5, 2.2);
    let b = random(180, 255);
    let a = random(120, 255);
    starfield.noStroke();
    starfield.fill(b, b, 255, a);
    starfield.ellipse(x, y, r, r);
    if (random() < 0.08) {
      let c = color(random(180,255), random(180,255), random(200,255), a);
      starfield.fill(c);
      starfield.ellipse(x, y, r * 1.2, r * 1.2);
    }
  }
  updateZoomMin();
}

// spawn a small debris explosion at position
function spawnDebrisAt(x, y, col, count = 8) {
  // create an Explosion and trim its particle list to the requested small count
  const ex = new Explosion(x, y, col);
  while (ex.particles.length > count) ex.particles.pop();
  explosions.push(ex);
}


let zoom = 1.0;
let zoomMin = 0.3;
let zoomMax = 2.5;

function updateZoomMin() {
  // Ensure the background always covers the canvas
  // The minimum zoom is when the canvas fits inside the starfield
  zoomMin = Math.max(width / starfieldW, height / starfieldH);
  // Clamp zoom if needed
  zoom = constrain(zoom, zoomMin, zoomMax);
}

function mouseWheel(event) {
  // Zoom in/out with scroll wheel
  let zoomFactor = 1.05;
  if (event.delta > 0) {
    zoom /= zoomFactor;
  } else {
    zoom *= zoomFactor;
  }
  zoom = constrain(zoom, zoomMin, zoomMax);
  return false; // prevent page scroll
}

// Update starfield and zoom min on resize
function windowResized() {
  canvx = window.innerWidth;
  canvy = Math.floor(window.innerHeight * 0.6);
  resizeCanvas(canvx, canvy);
  centerX = width / 2;
  centerY = height / 2;
  // Regenerate starfield to match new size
  starfieldW = window.innerWidth * 3;
  starfieldH = (window.innerHeight / 2 + window.innerHeight * 0.1) * 3;
  starfield = createGraphics(starfieldW, starfieldH);
  starfield.background(10, 12, 30);
  for (let i = 0; i < 800; i++) {
    let x = random(starfield.width);
    let y = random(starfield.height);
    let r = random(0.5, 2.2);
    let b = random(180, 255);
    let a = random(120, 255);
    starfield.noStroke();
    starfield.fill(b, b, 255, a);
    starfield.ellipse(x, y, r, r);
    if (random() < 0.08) {
      let c = color(random(180,255), random(180,255), random(200,255), a);
      starfield.fill(c);
      starfield.ellipse(x, y, r * 1.2, r * 1.2);
    }
  }
  updateZoomMin();
}