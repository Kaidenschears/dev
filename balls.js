let canvx=innerWidth;
let canvy=innerHeight/2+innerHeight*.1;
// disable grain background - we'll use planets + satellites instead
let numGrains = 0;
// collision spring (lowered a bit so gravity-driven orbits are less disturbed)
let spring = 0.03;
let max_speed=3;
let friction = -0.1;
let d=70;
let grains=[];
let wells = []; // rotating attractor wells
// central gravity parameters (Option 1)
let enableCentralGravity = true;
let centerX = 0;
let centerY = 0;
let GM = 800; // gravitational parameter (tunable) - lowered for gentler central pull
let gravitySoftening = 100; // avoids singularity at r=0
let initOrbitFactor = 1.0; // multiplier for initial tangential velocity
let fr=60;
// anti-bunching parameters
let repulsionPositionFactor = 0.6; // how strongly positions are corrected when overlapping
let repulsionVelocityFactor = 0.6; // velocity impulse applied to separate overlapping particles
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
// Explosion particle system for planet destruction
class ExplosionParticle {
  constructor(x, y, col) {
    this.x = x;
    this.y = y;
    const a = random(TWO_PI);
    const sp = random(1.5, 6);
    this.vx = cos(a) * sp;
    this.vy = sin(a) * sp;
    this.life = random(40, 90);
    this.age = 0;
    this.size = random(2, 6);
    this.col = col;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.06; // slight gravity
    this.vx *= 0.995;
    this.vy *= 0.995;
    this.age++;
  }
  isDead() { return this.age >= this.life; }
  render() {
    const t = 1 - this.age / this.life;
    noStroke();
    fill(red(this.col), green(this.col), blue(this.col), 200 * t);
    ellipse(this.x, this.y, this.size * t, this.size * t);
  }
}

class Explosion {
  constructor(x, y, col) {
    this.x = x; this.y = y; this.col = col;
    this.particles = [];
    const count = floor(random(24, 48));
    for (let i = 0; i < count; i++) this.particles.push(new ExplosionParticle(x, y, col));
    this.age = 0;
  }
  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update();
      if (p.isDead()) this.particles.splice(i, 1);
    }
    this.age++;
  }
  isDone() { return this.particles.length === 0; }
  render() {
    push();
    blendMode(ADD);
    for (const p of this.particles) p.render();
    blendMode(BLEND);
    pop();
  }
}
function setup() {
  let canvas=createCanvas(canvx, canvy);
  canvas.parent('top');
  // Prevent the browser context menu on the canvas (so right-click won't show 'Inspect')
  // and intercept common devtools shortcuts. Note: this is a UX convenience —
  // it cannot fully prevent a user from opening devtools (they can still use browser UI).
  try {
    // disable right-click context menu on the canvas element
    canvas.elt.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    // intercept some common key combos that open devtools (F12, Ctrl+Shift+I/C, Ctrl+U)
    window.addEventListener('keydown', function(e) {
      const k = e.key || '';
      if (k === 'F12' || (e.ctrlKey && e.shiftKey && (k === 'I' || k === 'i' || k === 'C' || k === 'c')) || (e.ctrlKey && (k === 'U' || k === 'u'))) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  } catch (err) {
    // ignore if canvas.elt not available or addEventListener fails
  }
  // Touch support: map tap -> spawn satellite, long-press -> create planet
  try {
    if ('ontouchstart' in window) {
      let touchTimer = null;
      let tx = 0, ty = 0;
      const longPressMs = 500;
      const rect = () => canvas.elt.getBoundingClientRect();
      canvas.elt.addEventListener('touchstart', (e) => {
        if (!e.touches || e.touches.length === 0) return;
        e.preventDefault();
        const t = e.touches[0];
        const r = rect();
        tx = t.clientX - r.left;
        ty = t.clientY - r.top;
        touchTimer = setTimeout(() => {
          // long-press -> create planet
          spawnPlanetAt(tx, ty);
          touchTimer = null;
        }, longPressMs);
      }, { passive: false });
      canvas.elt.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
          // tap -> spawn satellite
          spawnSatelliteAt(tx, ty);
        }
      }, { passive: false });
      canvas.elt.addEventListener('touchmove', (e) => {
        if (!e.touches || e.touches.length === 0) return;
        const t = e.touches[0];
        const r = rect();
        const mx = t.clientX - r.left;
        const my = t.clientY - r.top;
        // cancel long-press if finger moved significantly
        if (touchTimer && (abs(mx - tx) > 10 || abs(my - ty) > 10)) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
      }, { passive: false });
    }
  } catch (err) {
    // ignore if touch listener registration fails
  }
  frameRate(fr);
  background(80);
  noStroke()
  let i=0
    while(i<numGrains){
      let nx=random(canvx);
      let ny=random(canvy);
      let nw=random(d-d/2,d)
      let set=1;
      for (let j = 0; j < i; j++) {
        // console.log(others[i]);
        let dx = grains[j].x - nx;
        let dy = grains[j].y - ny;
        let distance = sqrt(dx * dx + dy * dy);
        let minDist = grains[j].diameter  + nw;
        if(distance<minDist)
          set=0;
      }
      if(set==1){
      grains[i]= new Grain(nx,ny,nw,i,grains);
      i+=1;}
    }
  // set central gravity center to canvas center
  centerX = width / 2;
  centerY = height / 2;

  // initialize tangential velocities so particles start with orbital motion
  if (enableCentralGravity) {
    for (let i = 0; i < grains.length; i++) {
      const g = grains[i];
      const dx = g.x - centerX;
      const dy = g.y - centerY;
      const r = sqrt(dx * dx + dy * dy) + 0.0001;
      // perpendicular (tangential) unit vector
      const tx = -dy / r;
      const ty = dx / r;
      // target circular orbit speed v = sqrt(GM / r)
      const v = initOrbitFactor * sqrt(GM / (r + 0.0001));
      g.vx += tx * v;
      g.vy += ty * v;
    }
  }

  // create rotating planets that orbit the central gravity center
  for (let i = 0; i < numPlanets; i++) {
    const orbitR = 80 + i * 90; // spread planets outward
    const angle = random(TWO_PI);
    // slower planet angular speeds for calmer motion
    const speed = random(0.002, 0.008) * (i % 2 ? 1 : -1);
    const size = 12 + i * 4;
    const col = [map(i, 0, numPlanets - 1, 120, 255), 180, map(i, 0, numPlanets - 1, 200, 100)];
    planets.push(new Planet(centerX, centerY, orbitR, angle, speed, size, col));
  }

  // create a handful of satellites orbiting random planets
  for (let i = 0; i < initialSatellites; i++) {
    const p = random(planets);
    const satR = p.size + 12 + random(8, 60);
    const a = random(TWO_PI);
    // slower satellite speeds
    const spd = random(0.005, 0.03) * (random() > 0.5 ? 1 : -1);
    const s = 4 + random(0, 3);
    satellites.push(new Satellite(p, satR, a, spd, s));
  }

      
}


class Grain {
  constructor(xin, yin, din, idin, oin) {
    this.x = xin;
    this.y = yin;
    this.vx = 0;
    this.vy = 0;
    this.diameter = din;
    this.id = idin;
    this.others = oin;
  
    this.fill=[100,200];
    // 100, 200
    
    
  }

  collide() {
    for (let i = this.id + 1; i < numGrains; i++) {
      // console.log(others[i]);
      let dx = this.others[i].x - this.x;
      let dy = this.others[i].y - this.y;
      let distance = sqrt(dx * dx + dy * dy);
      let minDist = this.others[i].diameter / 2 + this.diameter / 2;
      //   console.log(distance);
      //console.log(minDist);
      if (distance < minDist) {
        //console.log("2");
        let angle = atan2(dy, dx);
        let targetX = this.x + cos(angle) * minDist;
        let targetY = this.y + sin(angle) * minDist;
        let ax = (targetX - this.others[i].x) * spring;
        let ay = (targetY - this.others[i].y) * spring;
        this.vx -= ax;
        this.vy -= ay;
        this.others[i].vx += ax;
        this.others[i].vy += ay;
        // additional short-range position correction & velocity impulse to prevent bunching
        const overlap = (minDist - distance);
        if (overlap > 0) {
          const ux = dx / (distance + 0.0001); // unit vector from this -> other
          const uy = dy / (distance + 0.0001);
          // position correction: move each particle half the overlap (scaled)
          const shift = overlap * repulsionPositionFactor * 0.5;
          this.x -= ux * shift;
          this.y -= uy * shift;
          this.others[i].x += ux * shift;
          this.others[i].y += uy * shift;
          // velocity impulse away from each other
          const vImpulse = overlap * repulsionVelocityFactor * 0.02;
          this.vx -= ux * vImpulse;
          this.vy -= uy * vImpulse;
          this.others[i].vx += ux * vImpulse;
          this.others[i].vy += uy * vImpulse;
        }
        if (random(100) <= 10 && (abs(this.x - mouseX) + abs(this.y - mouseY)) <= this.diameter) {
          this.fill = [random(255), random(255)];
        }
    }
    }
  
  }

  move() {
    // allow mouse-drag to push particles: detect mouse movement distance
    const md = dist(mouseX, mouseY, pmouseX, pmouseY);
    if (abs(mouseX - this.x) <= this.diameter / 2 + 3 && abs(mouseY - this.y) <= this.diameter / 2 + 3 && md > max_speed) {
      this.vx = mouseX - pmouseX;
      this.vy = mouseY - pmouseY;
    }

    if (this.vx < 0)
    this.x += max(this.vx,-max_speed);
    else
      this.x+=min(this.vx,max_speed);
    if(this.vy<0)
    this.y += max(this.vy,-max_speed);
    else
      this.y+=min(this.vy,max_speed);
    if (this.x + this.diameter / 2 > width) {
      this.x = width - this.diameter / 2;
      this.vx *= friction;
    } else if (this.x - this.diameter / 2 < 0) {
      this.x = this.diameter/2 ;
      this.vx *= friction;
    }
    if (this.y + this.diameter / 2 > height) {
      this.y = height - this.diameter / 2;
      this.vy *= friction;
    } else if (this.y - this.diameter / 2 < 0) {
      this.y = this.diameter / 2;
      this.vy *= friction;
    }
  }
  display(){
    fill(color(this.fill[0],this.fill[1],map(this.vx+this.vy,-max_speed,max_speed,0,255,true)));

    ellipse(this.x, this.y, this.diameter, this.diameter);
  }
}
function draw() {
    background(40,120);
  // apply central gravity to all grains (toward centerX, centerY)
  if (enableCentralGravity) {
    for (let i = 0; i < grains.length; i++) {
      const g = grains[i];
      const rx = centerX - g.x;
      const ry = centerY - g.y;
      const r2 = rx * rx + ry * ry + 0.0001;
      const r = sqrt(r2);
      // softened inverse-square acceleration magnitude
      const aMag = GM / (r2 + gravitySoftening);
      const ax = (rx / r) * aMag;
      const ay = (ry / r) * aMag;
      g.vx += ax;
      g.vy += ay;
    }
  }
  // apply global damping to grain velocities to keep motion calm
  if (grains.length > 0) {
    for (let i = 0; i < grains.length; i++) {
      grains[i].vx *= velocityDamping;
      grains[i].vy *= velocityDamping;
    }
  }
  // update wells (rotating attractors) and apply orbit-friendly forces
  for (let i = wells.length - 1; i >= 0; i--) {
    const w = wells[i];
    w.update();
    // compute current attractor point that rotates around the well center
    const ax = w.x + cos(w.angle) * w.rotRadius;
    const ay = w.y + sin(w.angle) * w.rotRadius;

    // apply softened inverse-square attraction, but give an initial tangential kick
    grains.forEach(g => {
      const dx = ax - g.x;
      const dy = ay - g.y;
      const distSq = dx * dx + dy * dy;
      const distVal = sqrt(distSq) + 0.0001;
      if (distVal > w.radius) return; // out of influence

      // inward (centripetal) acceleration (softened)
      const soft = 300; // softening factor
      const aMag = w.strength / (distSq + soft);
      const ux = dx / distVal;
      const uy = dy / distVal;
      // perpendicular unit vector for tangential direction
      const tx = -uy;
      const ty = ux;

      // apply a small continuous inward pull
      g.vx += ux * aMag;
      g.vy += uy * aMag;

      // apply a small tangential boost to encourage orbiting (decays with distance)
        const tangentialBoost = w.tangential * (1.0 / (1 + distVal / 100)); // reduced initial impulse
      g.vx += tx * tangentialBoost;
      g.vy += ty * tangentialBoost;
    });

    // remove well when expired
    if (w.lifetime <= 0) wells.splice(i, 1);
  }

  // render wells (rings and rotating dense point)
  wells.forEach(w => w.render());

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
  // compute impact speed (approx linear speed = angularVel * radius)
  const speedFactorForSat = max(0.06, (s.planet && s.planet.initMass > 0) ? (s.planet.mass / s.planet.initMass) : 1);
  const angVel = abs(s.baseAngularSpeed * speedFactorForSat);
  const impactSpeed = angVel * s.orbitRadius; // pixels/frame approx
  // crater size reflects particle speed and size
  const craterSize = max(4, s.size * 2, impactSpeed * 30);
  // depth scales with impact speed (but bounded)
  const depth = min(1, impactSpeed / 6);
        p.addCrater(impactAngle, craterSize, depth);
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

  // update and display grains
  grains.forEach(grain =>{
                grain.display();
                grain.move();
                grain.collide();});
  
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

  // RIGHT click: create planet
  if (mouseButton === RIGHT) {
    spawnPlanetAt(mouseX, mouseY);
    return;
  }
  // LEFT click: spawn satellite
  if (mouseButton === LEFT) {
    spawnSatelliteAt(mouseX, mouseY);
    return;
  }
  return;
}

// RotatingWell: center (x,y), rotRadius (small circle for dense point), strength, tangential push, radius of influence, lifetime
class RotatingWell {
  constructor(x, y, rotRadius = 18, strength = 1200, tangential = 1.0, radius = 400, lifetime = 300) {
    this.x = x;
    this.y = y;
    this.rotRadius = rotRadius;
    this.strength = strength;
    this.tangential = tangential;
    this.radius = radius;
    this.lifetime = lifetime;
    this.angle = random(TWO_PI);
    // slower spin for the dense rotating point so it doesn't whip particles too hard
    this.angularSpeed = random(0.02, 0.06);
  }
  update() {
    this.angle += this.angularSpeed;
    this.lifetime -= 1;
  }
  render() {
    push();
    // ring showing influence
    noFill();
    stroke(255, 160);
    strokeWeight(1.5);
    ellipse(this.x, this.y, this.radius * 2 * 0.4);
    // rotating dense point
    const ax = this.x + cos(this.angle) * this.rotRadius;
    const ay = this.y + sin(this.angle) * this.rotRadius;
    noStroke();
    fill(255, 200);
    ellipse(ax, ay, max(6, this.rotRadius));
    pop();
  }
}

// Planet: orbits around the central gravity center and serves as a host for satellites
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
    // mass controls how strongly the planet influences satellites; initialize proportional to size
  this.initMass = this.baseSize * 10;
  this.mass = this.initMass;
  this.minMass = 0; // allow full erosion
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
    this.angle += this.angularSpeed;
    this.x = this.cx + cos(this.angle) * this.orbitRadius;
    this.y = this.cy + sin(this.angle) * this.orbitRadius;
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
    if (this.mass <= this.minMass) {
      this.mass = 0;
    }
  }
  // add a crater at world-space angle (relative to planet center), size in pixels, depth 0..1
  addCrater(angle, size, depth = 1.0) {
    // Merge by physical proximity on the planet surface (world-space) instead of
    // only angular proximity. This prevents an existing crater from being moved
    // to a new angle when nearby impacts occur. Craters accumulate until the
    // planet is destroyed (no forced eviction).
    const displaySize = max(4, this.baseSize);
    const radius = displaySize; // visual radius used for crater placement
    // compute world-space center of the new crater so we can compare distances
    const craterRadius = size * 0.5;
    const centerDist = max(0, radius - craterRadius - 2);
    const nx = this.x + cos(angle) * centerDist;
    const ny = this.y + sin(angle) * centerDist;

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
      const local = ((angle - this.spinAngle) % TWO_PI + TWO_PI) % TWO_PI;
      this.craters.push({ localAngle: local, size, depth });
      // bake into texture so the crater is permanent visually
      this._bakeCraters();
    } else {
      // existing crater was updated — re-bake to reflect merged changes
      this._bakeCraters();
    }
  }
}

// Satellite: orbits a parent Planet at a small radius
class Satellite {
  constructor(planet, orbitRadius = 40, angle = 0, angularSpeed = 0.01, size = 4) {
    this.planet = planet;
    this.orbitRadius = orbitRadius;
    this.angle = angle;
    this.angularSpeed = angularSpeed;
    this.baseAngularSpeed = angularSpeed;
    this.size = size;
    this.x = this.planet.x + cos(this.angle) * this.orbitRadius;
    this.y = this.planet.y + sin(this.angle) * this.orbitRadius;
    // a tiny wobble to keep orbits feeling organic
    this.wobble = random(0.002, 0.01);
  }
  update() {
    // angular speed influenced by planet mass (so erosion slows satellites).
    // Ensure a small minimum speed so satellites never lock to the planet when mass==0.
    let speedFactor = 1.0;
    if (this.planet && this.planet.initMass > 0) {
      speedFactor = this.planet.mass / this.planet.initMass;
    }
    speedFactor = max(0.06, speedFactor); // floor to keep satellites orbiting slowly even at zero mass
    this.angle += this.baseAngularSpeed * speedFactor;
    // slight change in orbit radius for organic motion
    const r = this.orbitRadius + sin(frameCount * this.wobble) * 2;

    // allow small perturbations from other planets' gravity. We compute each
    // other planet's acceleration at the satellite position, project it into
    // radial/tangential components relative to the parent, and apply tiny
    // temporary deltas to the orbit radius and angular motion. This preserves
    // the angle-based orbit model while letting satellites be affected by nearby bodies.
    let rModified = r;
    let angleDelta = 0;
    // conservative scaling factors to keep motion stable
    const accelScale = 0.0009; // scales down raw acceleration magnitude
    const radialScale = 28.0; // converts radial accel into px offset
    const tangentialScale = 0.6; // converts tangential accel into angular offset
    for (const p of planets) {
      if (!p || p === this.planet || p.destroyed) continue;
      const dx = p.x - (this.planet.x + cos(this.angle) * rModified);
      const dy = p.y - (this.planet.y + sin(this.angle) * rModified);
      const dist2 = dx * dx + dy * dy + 1e-6;
      const dist = sqrt(dist2);
      // acceleration magnitude toward other planet (mass already scales with size)
      const aMag = (p.mass) / (dist2 + gravitySoftening);
      // small scaled acceleration vector
      const ax = (dx / dist) * aMag * accelScale;
      const ay = (dy / dist) * aMag * accelScale;

      // radial/tangential basis relative to parent->satellite
      const prx = (this.planet.x + cos(this.angle) * rModified) - this.planet.x;
      const pry = (this.planet.y + sin(this.angle) * rModified) - this.planet.y;
      const prMag = sqrt(prx * prx + pry * pry) + 1e-6;
      const rHatX = prx / prMag;
      const rHatY = pry / prMag;
      const tHatX = -rHatY;
      const tHatY = rHatX;

      // project accel onto radial and tangential directions
      const radial = ax * rHatX + ay * rHatY;
      const tangential = ax * tHatX + ay * tHatY;

      rModified += radial * radialScale;
      angleDelta += tangential * tangentialScale;
    }

    // apply small angle delta from perturbations
    this.angle += angleDelta;

    this.x = this.planet.x + cos(this.angle) * rModified;
    this.y = this.planet.y + sin(this.angle) * rModified;
  }
  render() {
    push();
    noStroke();
    fill(255, 220);
    ellipse(this.x, this.y, this.size);
    pop();
  }
}

// Resize handler to keep canvas responsive on mobile/desktop
function windowResized() {
  const h = floor(window.innerHeight * 0.6);
  resizeCanvas(window.innerWidth, h);
  centerX = width / 2;
  centerY = height / 2;
}

// spawn a small debris explosion at position
function spawnDebrisAt(x, y, col, count = 8) {
  // create an Explosion and trim its particle list to the requested small count
  const ex = new Explosion(x, y, col);
  while (ex.particles.length > count) ex.particles.pop();
  explosions.push(ex);
}