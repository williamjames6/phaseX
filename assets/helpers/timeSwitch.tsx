//timeSwitch function only called when sending or receiving data from the database. All frontend operations
//use string format for timestamp. Backend stores as number of seconds.

export const timeSwitch = (time: string | number | null) => {
    if (typeof time === 'number') {
      const minutes = Math.floor(time / 60);
      const seconds = time % 60 < 10 ? `0${time % 60}` : time % 60;
      return `[${minutes}:${seconds}]`;
    } else if (!time) {
      return '[this action has no associated time]';
    } else {
      const [minutes, seconds] = time.split(':').map(Number);
      return minutes * 60 + seconds;
    }
  }