export interface Program {
  title: string;
  startTime: Date;
  endTime: Date;
  description: string;
}

// Deterministically generate a schedule for a given channel based on the current date
export const generateSchedule = (channelId: string, currentDay: Date): Program[] => {
  const seed = channelId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const shows = [
    "Morning News", "Breakfast Show", "Daily Debate", "Movie: Action Heroes",
    "Docuseries: Planet Earth", "Cooking with Chef", "Afternoon Drama", "Sports Highlights",
    "Evening News", "Primetime Movie", "Late Night Talk Show", "Music Videos",
    "Special Report", "Sitcom Re-runs", "Reality TV Hour", "Tech Review",
    "Cartoons", "Live Sports", "Documentary", "Standup Comedy"
  ];
  
  const schedule: Program[] = [];
  
  // Start from 00:00 today
  const startOfDay = new Date(currentDay);
  startOfDay.setHours(0, 0, 0, 0);
  
  // Generate 24 hours of programming (e.g. 1-2 hour slots)
  let currentTime = new Date(startOfDay);
  const endOfDay = new Date(startOfDay);
  endOfDay.setHours(23, 59, 59, 999);
  
  let i = 0;
  while (currentTime < endOfDay) {
    const showSeed = (seed + i + currentTime.getHours()) % shows.length;
    let durationHours = (showSeed % 2 === 0) ? 1 : 2; // 1 or 2 hour shows
    if (showSeed % 3 === 0) durationHours = 0.5; // Some 30 min shows
    
    const showEndTime = new Date(currentTime);
    showEndTime.setMinutes(showEndTime.getMinutes() + (durationHours * 60));
    
    schedule.push({
      title: shows[showSeed],
      startTime: new Date(currentTime),
      endTime: showEndTime,
      description: `Watch ${shows[showSeed]} live on our network.`
    });
    
    currentTime = showEndTime;
    i++;
  }
  
  return schedule;
};

export const getCurrentlyPlaying = (schedule: Program[], currentTime: Date = new Date()) => {
  return schedule.find(p => currentTime >= p.startTime && currentTime < p.endTime);
};

export const getUpNext = (schedule: Program[], currentTime: Date = new Date()) => {
  return schedule.find(p => p.startTime >= currentTime);
};
