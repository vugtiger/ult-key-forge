 import { useEffect, useRef, useState } from "react";
 import { Card } from "@/components/ui/card";
 
 interface Dot {
   x: number;
   y: number;
   z: number;
   opacity: number;
   blinking: boolean;
   blinkPhase: number;
 }
 
 const GlobeVisualization = () => {
   const canvasRef = useRef<HTMLCanvasElement>(null);
   const [dots, setDots] = useState<Dot[]>([]);
   const rotationRef = useRef(0);
   const animationRef = useRef<number>();
 
   useEffect(() => {
     // Generate dots distributed on a sphere
     const newDots: Dot[] = [];
     const numDots = 200;
     
     for (let i = 0; i < numDots; i++) {
       // Use golden ratio for even distribution
       const phi = Math.acos(1 - 2 * (i + 0.5) / numDots);
       const theta = Math.PI * (1 + Math.sqrt(5)) * i;
       
       const x = Math.sin(phi) * Math.cos(theta);
       const y = Math.sin(phi) * Math.sin(theta);
       const z = Math.cos(phi);
       
       newDots.push({
         x,
         y,
         z,
         opacity: 0.3 + Math.random() * 0.7,
         blinking: Math.random() < 0.15, // 15% of dots will blink
         blinkPhase: Math.random() * Math.PI * 2
       });
     }
     
     setDots(newDots);
   }, []);
 
   useEffect(() => {
     const canvas = canvasRef.current;
     if (!canvas) return;
     
     const ctx = canvas.getContext("2d");
     if (!ctx) return;
 
     const render = () => {
       const width = canvas.width;
       const height = canvas.height;
       const centerX = width / 2;
       const centerY = height / 2;
       const radius = Math.min(width, height) * 0.35;
       
       // Clear canvas
       ctx.clearRect(0, 0, width, height);
       
       // Draw subtle grid/wireframe effect
       ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
       ctx.lineWidth = 0.5;
       
       // Latitude lines
       for (let lat = -60; lat <= 60; lat += 30) {
         const latRad = (lat * Math.PI) / 180;
         const r = radius * Math.cos(latRad);
         const y = centerY - radius * Math.sin(latRad);
         
         ctx.beginPath();
         ctx.ellipse(centerX, y, r, r * 0.3, 0, 0, Math.PI * 2);
         ctx.stroke();
       }
       
       // Longitude lines
       for (let lon = 0; lon < 180; lon += 30) {
         const lonRad = ((lon + rotationRef.current * 50) * Math.PI) / 180;
         ctx.beginPath();
         ctx.ellipse(centerX, centerY, radius * Math.abs(Math.sin(lonRad)), radius, 0, 0, Math.PI * 2);
         ctx.stroke();
       }
       
       // Sort dots by z for proper depth rendering
       const sortedDots = [...dots].sort((a, b) => {
         const rotA = a.x * Math.cos(rotationRef.current) - a.z * Math.sin(rotationRef.current);
         const rotB = b.x * Math.cos(rotationRef.current) - b.z * Math.sin(rotationRef.current);
         return rotA - rotB;
       });
       
       const time = Date.now() / 1000;
       
       // Draw dots
       sortedDots.forEach((dot) => {
         // Rotate around Y axis
         const rotatedX = dot.x * Math.cos(rotationRef.current) + dot.z * Math.sin(rotationRef.current);
         const rotatedZ = -dot.x * Math.sin(rotationRef.current) + dot.z * Math.cos(rotationRef.current);
         
         // Only draw dots on the front half of the sphere
         if (rotatedZ < 0) return;
         
         const screenX = centerX + rotatedX * radius;
         const screenY = centerY - dot.y * radius;
         
         // Calculate opacity based on depth and blinking
         let opacity = dot.opacity * (0.3 + rotatedZ * 0.7);
         
         if (dot.blinking) {
           // Pulsing effect for "active" users
           const blink = Math.sin(time * 2 + dot.blinkPhase) * 0.5 + 0.5;
           opacity = Math.min(1, opacity + blink * 0.5);
         }
         
         const dotSize = 2 + rotatedZ * 2;
         
         // Draw glow for blinking dots
         if (dot.blinking) {
           const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, dotSize * 4);
           gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.3})`);
           gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
           ctx.beginPath();
           ctx.arc(screenX, screenY, dotSize * 4, 0, Math.PI * 2);
           ctx.fillStyle = gradient;
           ctx.fill();
         }
         
         // Draw dot
         ctx.beginPath();
         ctx.arc(screenX, screenY, dotSize, 0, Math.PI * 2);
         ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
         ctx.fill();
       });
       
       // Update rotation
       rotationRef.current += 0.003;
       
       animationRef.current = requestAnimationFrame(render);
     };
     
     render();
     
     return () => {
       if (animationRef.current) {
         cancelAnimationFrame(animationRef.current);
       }
     };
   }, [dots]);
 
   // Generate random user count that slowly increases
   const [userCount, setUserCount] = useState(12847);
   
   useEffect(() => {
     const interval = setInterval(() => {
       setUserCount(prev => prev + Math.floor(Math.random() * 3));
     }, 3000);
     return () => clearInterval(interval);
   }, []);
 
   return (
     <Card className="p-8 cyber-border bg-card/50 backdrop-blur-xl flex flex-col items-center justify-center">
       <div className="relative">
         <canvas
           ref={canvasRef}
           width={300}
           height={300}
           className="opacity-80"
         />
         {/* Glow effect behind globe */}
         <div className="absolute inset-0 -z-10 bg-white/5 rounded-full blur-3xl scale-75" />
       </div>
       
       <div className="text-center mt-4 space-y-2">
         <h3 className="text-3xl font-bold text-foreground">
           {userCount.toLocaleString()}+
         </h3>
         <p className="text-lg text-muted-foreground font-medium">
           Users Worldwide
         </p>
         <p className="text-sm text-muted-foreground max-w-xs">
           Join our growing community of users who trust and use ULT LUA daily.
         </p>
       </div>
     </Card>
   );
 };
 
 export default GlobeVisualization;