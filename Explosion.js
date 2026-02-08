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
