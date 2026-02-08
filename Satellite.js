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
  // Store previous positions for the tail
  tailLength = 16;
  tailAlpha = 90;
  tailColor = [180, 220, 255]; // (kept for tail, can adjust if desired)
  tail = [];

  render() {
    // Add current position to the tail
    this.tail = this.tail || [];
    this.tail.push({x: this.x, y: this.y});
    if (this.tail.length > this.tailLength) this.tail.shift();

    // Draw the tail
    push();
    noFill();
    for (let i = 1; i < this.tail.length; i++) {
      const prev = this.tail[i - 1];
      const curr = this.tail[i];
      const alpha = map(i, 1, this.tail.length, 0, this.tailAlpha);
      stroke(this.tailColor[0], this.tailColor[1], this.tailColor[2], alpha);
      strokeWeight(map(i, 1, this.tail.length, 1, this.size * 0.7));
      line(prev.x, prev.y, curr.x, curr.y);
    }
    pop();

    // Draw the satellite itself
    push();
    noStroke();
    // Grey, space rock color
    fill(120, 120, 130, 230);
    // Draw an irregular, organic rocky shape using a noisy polygon
    let points = 9;
    let rBase = this.size * 0.5;
    let t = frameCount * 0.01 + this.angle; // animate for subtle motion
    beginShape();
    for (let i = 0; i < points; i++) {
      let a = (TWO_PI / points) * i;
      // Use per-vertex noise for organic shape
      let n = noise(this.x * 0.03 + cos(a + t) * 2, this.y * 0.03 + sin(a + t) * 2, i * 0.2 + t);
      let r = rBase * map(n, 0, 1, 0.7, 1.25);
      vertex(this.x + cos(a) * r, this.y + sin(a) * r);
    }
    endShape(CLOSE);
    pop();
  }
}