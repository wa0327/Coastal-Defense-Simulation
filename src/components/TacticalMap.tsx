import React, { useEffect, useRef } from 'react';
import { Target, Drone, TargetType, LogEntry, SimulationStats, distance, normalize, angleDiff } from '../lib/simulation';

interface Props {
  onLog: (log: LogEntry) => void;
  onStatsUpdate: (stats: SimulationStats) => void;
}

export default function TacticalMap({ onLog, onStatsUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastSpawnTime = 0;
    let lastStatsTime = 0;
    let lastTime = 0;

    let targets: Target[] = [];
    const BASE_POS = { x: 80, y: 300 };
    
    // Define 4 distinct patrol sectors
    const patrolSectors = [
      [{x: 250, y: 100}, {x: 700, y: 100}, {x: 700, y: 250}, {x: 250, y: 250}], // Top
      [{x: 250, y: 350}, {x: 700, y: 350}, {x: 700, y: 500}, {x: 250, y: 500}], // Bottom
    ];

    let drones: Drone[] = Array.from({ length: 4 }).map((_, i) => ({
      id: `VTOL-0${i + 1}`,
      pos: { x: BASE_POS.x, y: BASE_POS.y + (i - 1.5) * 20 },
      vel: { x: 0, y: 0 },
      speed: 5,
      heading: 0,
      state: i < 2 ? 'PATROL' : 'IDLE',
      targetId: null,
      waypoints: patrolSectors[i % 2],
      currentWaypointIndex: 0,
      flightTime: 0,
      maxFlightTime: 180000,
    }));

    const spawnTarget = () => {
      const types: TargetType[] = ['FRIENDLY', 'ENEMY', 'FISHING', 'UNKNOWN'];
      const weights = [0.35, 0.35, 0.2, 0.1];
      const rand = Math.random() * 1.5;
      let sum = 0;
      let selectedType: TargetType = 'FISHING';
      for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (rand < sum) {
          selectedType = types[i];
          break;
        }
      }

      const spawnEdge = Math.random();
      let pos = { x: 0, y: 0 };
      let heading = 0;

      if (spawnEdge < 0.4) {
        // Right edge
        pos = { x: canvas.width + 50, y: Math.random() * canvas.height };
        heading = Math.PI + (Math.random() - 0.5) * Math.PI / 4;
      } else if (spawnEdge < 0.7) {
        // Top edge, right side
        pos = { x: canvas.width / 2 + Math.random() * (canvas.width / 2), y: -50 };
        heading = Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 4;
      } else {
        // Bottom edge, right side
        pos = { x: canvas.width / 2 + Math.random() * (canvas.width / 2), y: canvas.height + 50 };
        heading = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 4;
      }

      let speed = 3 + Math.random() * 4;
      if (selectedType === 'ENEMY') {
        speed = 8 + Math.random() * 2;
      }

      targets.push({
        id: Math.random().toString(36).substring(7),
        type: selectedType,
        pos,
        vel: { x: Math.cos(heading), y: Math.sin(heading) },
        speed,
        heading,
      });
    };

    const update = (time: number) => {
      if (lastTime === 0) lastTime = time;
      const dt = time - lastTime;
      lastTime = time;
      
      const speedMult = dt * 0.01;

      // Spawn logic
      if (time - lastSpawnTime > 2000) { // Spawn every 2 seconds
        if (targets.length < 12 && Math.random() > 0.3) {
          spawnTarget();
        }
        lastSpawnTime = time;
      }

      // Update targets
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i];
        
        // Avoid island (x < 180)
        if (t.pos.x < 180) {
          const desiredHeading = t.pos.y < 300 ? Math.PI / 4 : -Math.PI / 4;
          const diff = angleDiff(t.heading, desiredHeading);
          t.heading += Math.sign(diff) * 0.02;
          t.vel.x = Math.cos(t.heading);
          t.vel.y = Math.sin(t.heading);
        }

        t.pos.x += t.vel.x * t.speed * speedMult;
        t.pos.y += t.vel.y * t.speed * speedMult;

        // Remove if far out of bounds
        if (t.pos.x < -100 || t.pos.x > canvas.width + 100 || t.pos.y < -100 || t.pos.y > canvas.height + 100) {
          targets.splice(i, 1);
        }
      }

      // Update Drones
      let activeCount = drones.filter(d => d.state !== 'IDLE').length;

      drones.forEach(drone => {
        if (drone.state === 'IDLE') {
          // Recharge (assume 1.5x speed recharge)
          drone.flightTime = Math.max(0, drone.flightTime - dt * 1.5);
          
          // Launch if needed
          if (activeCount < 2 && drone.flightTime === 0) {
            drone.state = 'PATROL';
            activeCount++;
            onLog({
              id: Math.random().toString(),
              time: new Date(),
              message: `[調度] ${drone.id} 起飛執行巡邏任務。`,
              type: 'INFO'
            });
          }
        } else {
          drone.flightTime += dt;
          
          const distToBase = distance(drone.pos, BASE_POS);
          // Max return speed is 10 m/s. Speed in pixels per ms = 10 * 0.01 = 0.1 pixels/ms
          const timeToReturn = distToBase / 0.1;
          
          if (drone.state !== 'RETURNING' && drone.flightTime + timeToReturn + 5000 > drone.maxFlightTime) {
            drone.state = 'RETURNING';
            drone.targetId = null;
            onLog({
              id: Math.random().toString(),
              time: new Date(),
              message: `[調度] ${drone.id} 巡航時間即將達標，正在返航。`,
              type: 'WARNING'
            });
          }

          if (drone.state === 'RETURNING') {
            const desiredHeading = Math.atan2(BASE_POS.y - drone.pos.y, BASE_POS.x - drone.pos.x);
            const diff = angleDiff(drone.heading, desiredHeading);
            drone.heading += Math.sign(diff) * Math.min(Math.abs(diff), 0.05);
            drone.speed = 10.0; // Max speed for return
            
            drone.pos.x += Math.cos(drone.heading) * drone.speed * speedMult;
            drone.pos.y += Math.sin(drone.heading) * drone.speed * speedMult;
            
            if (distance(drone.pos, BASE_POS) < 10) {
              drone.state = 'IDLE';
              drone.pos.x = BASE_POS.x;
              drone.pos.y = BASE_POS.y + (parseInt(drone.id.split('-')[1]) - 1.5) * 20;
              drone.heading = 0;
              activeCount--;
              onLog({
                id: Math.random().toString(),
                time: new Date(),
                message: `[調度] ${drone.id} 已降落並開始充電。`,
                type: 'INFO'
              });
            }
          } else if (drone.state === 'PATROL') {
            const targetPos = drone.waypoints[drone.currentWaypointIndex];
            
            // If close enough to waypoint, move to next one
            if (distance(drone.pos, targetPos) < 20) {
              drone.currentWaypointIndex = (drone.currentWaypointIndex + 1) % drone.waypoints.length;
            }

            const desiredHeading = Math.atan2(targetPos.y - drone.pos.y, targetPos.x - drone.pos.x);
            const diff = angleDiff(drone.heading, desiredHeading);
            drone.heading += Math.sign(diff) * Math.min(Math.abs(diff), 0.04);
            drone.speed = 5.0; // Patrol speed

            drone.pos.x += Math.cos(drone.heading) * drone.speed * speedMult;
            drone.pos.y += Math.sin(drone.heading) * drone.speed * speedMult;

            // Check for enemies
            for (const t of targets) {
              if (t.type === 'ENEMY' && distance(drone.pos, t.pos) < 200) {
                const isTracked = drones.some(d => d.targetId === t.id);
                if (!isTracked) {
                  drone.state = 'TRACKING';
                  drone.targetId = t.id;
                  onLog({
                    id: Math.random().toString(),
                    time: new Date(),
                    message: `[警報] ${drone.id} 發現敵方軍艦！距離 ${(distance(drone.pos, t.pos) * 10).toFixed(0)}m。啟動跟監模式。`,
                    type: 'ALERT'
                  });
                  break;
                }
              }
            }
          } else if (drone.state === 'TRACKING') {
            const target = targets.find(t => t.id === drone.targetId);
            if (target) {
              const dist = distance(drone.pos, target.pos);
              let desiredHeading = Math.atan2(target.pos.y - drone.pos.y, target.pos.x - drone.pos.x);
              
              // Orbit behavior: if close enough, turn 90 degrees to orbit
              if (dist < 100) {
                 desiredHeading += Math.PI / 2; // Orbit clockwise
              }
              
              const diff = angleDiff(drone.heading, desiredHeading);
              drone.heading += Math.sign(diff) * Math.min(Math.abs(diff), 0.06);
              drone.speed = target.speed; // Match target speed
              
              drone.pos.x += Math.cos(drone.heading) * drone.speed * speedMult;
              drone.pos.y += Math.sin(drone.heading) * drone.speed * speedMult;

              // Share intelligence: check for other enemies in range while tracking
              for (const t of targets) {
                if (t.type === 'ENEMY' && t.id !== target.id && distance(drone.pos, t.pos) < 200) {
                  const isTracked = drones.some(d => d.targetId === t.id);
                  if (!isTracked) {
                    // Find an available drone to track this new target
                    const availableDrone = drones.find(d => d.state === 'PATROL');
                    if (availableDrone) {
                      availableDrone.state = 'TRACKING';
                      availableDrone.targetId = t.id;
                      onLog({
                        id: Math.random().toString(),
                        time: new Date(),
                        message: `[情報共享] ${drone.id} 發現額外敵艦，指派 ${availableDrone.id} 前往跟監。`,
                        type: 'ALERT'
                      });
                    }
                  }
                }
              }

              // Check if target is out of range of ALL drones
              const isTargetVisible = drones.some(d => distance(d.pos, target.pos) < 200);
              if (!isTargetVisible) {
                drone.state = 'PATROL';
                drone.targetId = null;
                onLog({
                  id: Math.random().toString(),
                  time: new Date(),
                  message: `[資訊] 敵方軍艦脫離偵測範圍。${drone.id} 返回巡邏模式。`,
                  type: 'INFO'
                });
              }
            } else {
              drone.state = 'PATROL';
              drone.targetId = null;
              onLog({
                id: Math.random().toString(),
                time: new Date(),
                message: `[資訊] 敵方軍艦已撤離或消失。${drone.id} 返回巡邏模式。`,
                type: 'INFO'
              });
            }
          }
        }
      });

      // Update stats every 500ms
      if (time - lastStatsTime > 500) {
        const stats = { friendly: 0, enemy: 0, fishing: 0, unknown: 0 };
        targets.forEach(t => {
          if (t.type === 'FRIENDLY') stats.friendly++;
          if (t.type === 'ENEMY') stats.enemy++;
          if (t.type === 'FISHING') stats.fishing++;
          if (t.type === 'UNKNOWN') stats.unknown++;
        });
        onStatsUpdate(stats);
        lastStatsTime = time;
      }
    };

    const draw = () => {
      // Clear
      ctx.fillStyle = '#020617'; // slate-950
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Coastline
      ctx.fillStyle = '#064e3b'; // emerald-900
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(120, 0);
      ctx.lineTo(150, 150);
      ctx.lineTo(100, 300);
      ctx.lineTo(140, 450);
      ctx.lineTo(110, canvas.height);
      ctx.lineTo(0, canvas.height);
      ctx.fill();

      // Draw Grid
      ctx.strokeStyle = '#1e293b'; // slate-800
      ctx.lineWidth = 1;
      for(let i=0; i<canvas.width; i+=50) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke(); }
      for(let i=0; i<canvas.height; i+=50) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke(); }

      // Draw Patrol Routes
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      drones.forEach(drone => {
        ctx.beginPath();
        ctx.moveTo(drone.waypoints[0].x, drone.waypoints[0].y);
        for(let i=1; i<drone.waypoints.length; i++) {
          ctx.lineTo(drone.waypoints[i].x, drone.waypoints[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      });
      ctx.setLineDash([]);

      // Draw Base
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(BASE_POS.x - 20, BASE_POS.y - 40, 40, 80);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(BASE_POS.x - 20, BASE_POS.y - 40, 40, 80);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px monospace';
      ctx.fillText('BASE', BASE_POS.x - 12, BASE_POS.y - 45);

      // Draw Drone Detection Radius
      drones.forEach(drone => {
        if (drone.state !== 'IDLE' && drone.state !== 'RETURNING') {
          ctx.beginPath();
          ctx.arc(drone.pos.x, drone.pos.y, 200, 0, Math.PI * 2);
          ctx.fillStyle = drone.state === 'TRACKING' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(56, 189, 248, 0.05)';
          ctx.fill();
          ctx.strokeStyle = drone.state === 'TRACKING' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.3)';
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      // Draw Targets
      targets.forEach(t => {
        ctx.save();
        ctx.translate(t.pos.x, t.pos.y);
        ctx.rotate(t.heading);

        if (t.type === 'FRIENDLY') {
          ctx.fillStyle = '#3b82f6'; // blue-500
          ctx.fillRect(-10, -5, 20, 10);
        } else if (t.type === 'ENEMY') {
          ctx.fillStyle = '#ef4444'; // red-500
          ctx.beginPath();
          ctx.moveTo(12, 0);
          ctx.lineTo(-12, 8);
          ctx.lineTo(-12, -8);
          ctx.fill();
        } else if (t.type === 'FISHING') {
          ctx.fillStyle = '#f8fafc'; // slate-50
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (t.type === 'UNKNOWN') {
          ctx.fillStyle = '#eab308'; // yellow-500
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(6, 6);
          ctx.lineTo(-6, 6);
          ctx.fill();
        }

        ctx.restore();

        // Draw tracking line
        const trackingDrone = drones.find(d => d.state === 'TRACKING' && d.targetId === t.id);
        if (trackingDrone) {
          ctx.beginPath();
          ctx.moveTo(trackingDrone.pos.x, trackingDrone.pos.y);
          ctx.lineTo(t.pos.x, t.pos.y);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Draw target lock box
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.strokeRect(t.pos.x - 15, t.pos.y - 15, 30, 30);
        }
      });

      // Draw Drones
      drones.forEach(drone => {
        ctx.save();
        ctx.translate(drone.pos.x, drone.pos.y);
        
        if (drone.state !== 'IDLE') {
          ctx.rotate(drone.heading);
        }

        ctx.fillStyle = drone.state === 'IDLE' ? '#64748b' : '#38bdf8'; // sky-400 or slate-500
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-8, 8);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-8, -8);
        ctx.fill();
        
        ctx.restore();
        
        // Drone label
        ctx.fillStyle = drone.state === 'IDLE' ? '#94a3b8' : '#bae6fd';
        ctx.font = '10px monospace';
        ctx.fillText(drone.id, drone.pos.x + 12, drone.pos.y + 4);
        
        if (drone.state === 'TRACKING') {
           ctx.fillStyle = '#fca5a5';
           ctx.fillText('[TRACKING]', drone.pos.x + 12, drone.pos.y + 16);
        } else if (drone.state === 'RETURNING') {
           ctx.fillStyle = '#fde047';
           ctx.fillText('[RETURNING]', drone.pos.x + 12, drone.pos.y + 16);
        } else if (drone.state !== 'IDLE') {
           // Show battery
           const batteryPct = Math.max(0, 100 - (drone.flightTime / drone.maxFlightTime) * 100);
           ctx.fillStyle = batteryPct > 20 ? '#86efac' : '#fca5a5';
           ctx.fillText(`[${batteryPct.toFixed(0)}%]`, drone.pos.x + 12, drone.pos.y + 16);
        }
      });
    };

    const loop = (time: number) => {
      update(time);
      draw();
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [onLog, onStatsUpdate]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="w-full h-full object-contain bg-slate-950 rounded-lg border border-slate-800 shadow-2xl"
    />
  );
}
