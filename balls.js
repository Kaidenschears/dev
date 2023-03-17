
let canvx=innerWidth;
let canvy=innerHeight/2+innerHeight*.1;
let numGrains = 25;
let spring = 0.07;
let max_speed=3;
let friction = -0.1;
let d=70;
let grains=[];
let fr=60;
function setup() {
  let canvas=createCanvas(canvx, canvy);
  canvas.parent('top');
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
        if(random(100)<=10 & abs(this.x-mouseX)+abs(this.y-mouseY)<=this.diameter){
          this.fill=[random(255),random(255)];
      }
    }
    }
  
  }

  move() {
    console.log(this.lock)
      
    if (abs(mouseX-this.x)<= this.diameter/2 +3 & abs(mouseY-this.y)<=this.diameter/2 +3 & abs(mouseX-pmouseX+abs(mouseY-pmouseY))>max_speed ){
      this.vx=mouseX - pmouseX;
      this.vy=mouseY - pmouseY;
     
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
  grains.forEach(grain =>{
                grain.display();
                grain.move();
                grain.collide();});
  
}